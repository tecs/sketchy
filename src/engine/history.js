import Input from './input.js';

/**
 * @typedef HistoryEvent
 * @property {string} name
 * @property {Function} execute
 * @property {Function} revert
 */

/**
 * @template T
 * @typedef HistoryAction
 * @property {T} data
 * @property {() => void} commit
 * @property {() => void} discard
 * @property {(up: (data: T) => void, down: (data: T) => void) => void} append
 * @property {HistoryAction<T>["append"]} replace
 */

export default class History {
  /** @type {Engine} */
  #engine;

  /** @type {HistoryEvent[]} */
  #stack = [];

  #current = -1;

  #locked = false;

  get canUndo() {
    return this.#current >= 0;
  }

  get canRedo() {
    return this.#current + 1 < this.#stack.length;
  }

  get current() {
    return this.#current;
  }

  /**
   * @returns {Readonly<HistoryEvent[]>}
   */
  get list() {
    return this.#stack;
  }

  /**
   * @param {Engine} engine
   */
  constructor(engine) {
    this.#engine = engine;

    const undoKey = engine.config.createString('shortcuts.undo', 'Undo', 'key', Input.stringify(['ctrl', 'z']));
    const redoKey = engine.config.createString('shortcuts.redo', 'Redo', 'key', Input.stringify(['ctrl', 'shift', 'z']));

    engine.input.registerShortcuts(undoKey, redoKey);

    engine.on('shortcut', (setting) => {
      switch (setting) {
        case undoKey: this.undo(); break;
        case redoKey: this.redo(); break;
      }
    });
  }

  /**
   * @returns {boolean}
   */
  #lock() {
    const wasLocked = this.#locked;
    this.#locked = true;
    return !wasLocked;
  }

  #unlock() {
    this.#locked = false;
  }

  drop() {
    this.#stack.splice(0);
    this.#current = -1;
    this.#locked = false;

    this.#engine.emit('historychange');
  }

  /**
   * @template T
   * @param {string} name
   * @param {T} data
   * @param {Function} [onClose]
   * @returns {HistoryAction<T>|undefined}
   */
  createAction(name, data, onClose) {
    if (!this.#lock()) return undefined;

    /** @type {[Function, Function][]} */
    const stack = [];

    const execute = () => { for (let i = 0; i < stack.length; ++i) stack[i][0](data); };
    const revert = () => { for (let i = stack.length - 1; i >= 0; --i) stack[i][1](data); };

    let finalized = false;
    /**
     * @param {string} action
     */
    const assertOpen = (action) => {
      if (finalized) throw new Error(`Cannot ${action} HistoryAction as it has already been finalized.`);
    };

    const commit = () => {
      assertOpen('commit');
      finalized = true;

      if (this.canRedo) {
        this.#stack.splice(this.#current + 1);
      }

      this.#current++;
      this.#stack.push({ name, execute, revert });

      this.#unlock();
      onClose?.();

      this.#engine.emit('historychange');
    };

    const discard = () => {
      assertOpen('discard');
      finalized = true;
      revert();
      this.#unlock();
      onClose?.();
    };

    /** @type {HistoryAction<T>["append"]} */
    const append = (up, down) => {
      assertOpen('append to');
      stack.push([up, down]);
      up(data);
    };

    /** @type {HistoryAction<T>["append"]} */
    const replace = (up, down) => {
      assertOpen('replace in');
      stack.pop()?.[1](data);
      append(up, down);
    };

    return { data, commit, discard, append, replace };
  }

  undo() {
    if (this.canUndo && this.#lock()) {
      this.#stack[this.#current--].revert();
      this.#engine.emit('historychange');
      this.#unlock();
    }
  }

  redo() {
    if (this.canRedo && this.#lock()) {
      this.#stack[++this.#current].execute();
      this.#engine.emit('historychange');
      this.#unlock();
    }
  }
}
