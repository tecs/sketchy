/**
 * @typedef HistoryEvent
 * @property {string} name
 * @property {boolean} [skip]
 * @property {Function} execute
 * @property {Function} revert
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
  }

  lock() {
    const wasLocked = this.#locked;
    this.#locked = true;
    return !wasLocked;
  }

  unlock() {
    this.#locked = false;
  }

  drop() {
    this.#stack.splice(0);
    this.#current = -1;
    this.#locked = false;

    this.#engine.emit('historychange');
  }

  /**
   * @param {HistoryEvent} event
   */
  push(event) {
    if (!this.#locked) return;

    if (this.canRedo) {
      this.#stack.splice(this.#current + 1);
    }

    this.#current++;
    this.#stack.push(event);
    if (!event.skip) event.execute();

    this.unlock();

    this.#engine.emit('historychange');
  }

  undo() {
    if (this.canUndo && this.lock()) {
      this.#stack[this.#current--].revert();
      this.#engine.emit('historychange');
      this.unlock();
    }
  }

  redo() {
    if (this.canRedo && this.lock()) {
      this.#stack[++this.#current].execute();
      this.#engine.emit('historychange');
      this.unlock();
    }
  }
}
