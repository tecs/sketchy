const { vec3 } = glMatrix;

const PLUS_TOKEN = ' [+] ';
const THEN_TOKEN = ' [THEN] ';

/** @typedef {"left"|"middle"|"right"} MouseButton */
/** @typedef {[string, ...string[]]} NonNullKeyboardShortcut */
/** @typedef {string[]} KeyboardShortcut */
/** @typedef {[KeyboardShortcut] | [NonNullKeyboardShortcut, KeyboardShortcut]} KeyboardSequence */
/** @typedef {KeyboardSequence | KeyboardShortcut | string} KeyboardShortcutRepresentation */

/** @type {(shortcut: KeyboardShortcutRepresentation) => shortcut is KeyboardShortcut} */
export const isKeyboardShortcut = (shortcut) => Array.isArray(shortcut) && !Array.isArray(shortcut[0]);

/** @type {(sequence: KeyboardShortcutRepresentation) => sequence is KeyboardSequence} */
export const isKeyboardSequence = (sequence) => Array.isArray(sequence) && Array.isArray(sequence[0]);

export default class Input {
  /** @type {Engine} */
  #engine;

  /** @type {MouseButton|null} */
  button = null;

  /** @type {string|null} */
  key = null;

  /** @type {{ id: string, handler: Function, sequence: string[], index: number }[]} */
  shortcuts = [];

  shortcutIndex = 0;

  position = vec3.create();
  lastClickedPosition = vec3.create();

  leftButton = false;
  middleButton = false;
  rightButton = false;
  shift = false;
  ctrl = false;
  alt = false;

  /**
   * @param {string} key
   * @returns {string}
   */
  static normalizeKey(key) {
    key = key.toLowerCase();
    switch (key) {
      case ' ': return 'space';
      case 'control': return 'ctrl';
      case 'escape': return 'esc';
    }
    return key;
  }

  /**
   * @param {string} combo
   * @returns {KeyboardSequence}
   */
  static parse(combo) {
    const sequence = /** @type {KeyboardSequence} */ ([[]]);
    if (combo.length === 0) return sequence;

    const shortcuts = combo.split(THEN_TOKEN);
    for (let i = 0; i < shortcuts.length; ++i) {
      sequence[i] = [];
      if (shortcuts[i].length === 0) continue;

      const keys = shortcuts[i].split(PLUS_TOKEN);
      for (let k = 0; k < keys.length; ++k) {
        sequence[i][k] = this.normalizeKey(keys[k]);
      }
    }

    return sequence;
  }

  /**
   * @param {KeyboardShortcutRepresentation} sequence
   * @returns {string}
   */
  static stringify(sequence) {
    if (!Array.isArray(sequence)) sequence = /** @type {KeyboardSequence} */ ([[sequence]]);
    else if (isKeyboardShortcut(sequence)) sequence = /** @type {KeyboardSequence} */ ([sequence]);

    for (const shortcut of sequence) {
      for (let i = 0; i < shortcut.length; ++i) {
        shortcut[i] = this.normalizeKey(shortcut[i]);
      }
    }

    return sequence.map(shortcut => shortcut.join(PLUS_TOKEN)).join(THEN_TOKEN);
  }

  /**
   * @param {string} combo
   * @returns {string[]}
   */
  static stringifyShortcuts(combo) {
    return this.parse(combo).filter(shortcut => shortcut.length > 0).map(shortcut => this.stringify(shortcut));
  }

  /**
   * @param {Engine} engine
   */
  constructor(engine) {
    this.#engine = engine;

    engine.on('settingchange', (setting) => {
      if (setting.type !== 'key') return;

      const affectedShortcuts = this.shortcuts.filter(({ id }) => id === setting.id);
      if (!affectedShortcuts) return;

      for (const shortcut of affectedShortcuts) {
        shortcut.sequence = Input.stringifyShortcuts(setting.value);
        shortcut.index = 0;
      }
    });
  }

  /**
   * @param {number} x
   * @param {number} y
   * @param {number} dX
   * @param {number} dY
   */
  setPosition(x, y, dX, dY) {
    const previous = vec3.clone(this.position);
    this.position[0] = x;
    this.position[1] = y;
    this.#engine.emit('mousemove', this.position, vec3.fromValues(dX, dY, 0), previous);
  }

  /**
   * @param {number} button
   * @param {boolean} down
   * @param {number} count
   */
  setButton(button, down, count) {
    switch (button) {
      case 0:
        this.leftButton = down;
        this.button = 'left';
        break;
      case 1:
        this.middleButton = down;
        this.button = 'middle';
        break;
      case 2:
        this.rightButton = down;
        this.button = 'right';
        break;
      default:
        this.button = null;
        return;
    }

    if (down) {
      this.#engine.emit('mousedown', this.button, count);
      vec3.copy(this.lastClickedPosition, this.position);
    } else this.#engine.emit('mouseup', this.button, count);
  }

  /**
   * @param {string} key
   * @param {boolean} down
   */
  setKey(key, down) {
    /** @type {string[]} */
    const combo = [];

    const originalKey = key;
    key = Input.normalizeKey(key);
    switch (key) {
      case 'alt':
      case 'shift':
      case 'ctrl':
        this[key] = down;
        break;
      default: combo.push(key);
    }

    this.key = key;

    if (this.shift || key === 'shift') combo.unshift('shift');
    if (this.alt || key === 'alt') combo.unshift('alt');
    if (this.ctrl || key === 'ctrl') combo.unshift('ctrl');
    const keyCombo = Input.stringify(combo);

    if (key === 'esc') this.#resetShortcuts();
    else if (originalKey.length === 1 && down) this.#triggerShortcuts(keyCombo);

    if (down) this.#engine.emit('keydown', key, keyCombo);
    else this.#engine.emit('keyup', key, keyCombo);
  }

  /**
   * @param {-1|1} direction
   */
  scroll(direction) {
    this.#engine.emit('mousescroll', direction);
  }

  /**
   * @param {Readonly<import("./config").StringSetting>} setting
   * @param {Function} handler
   */
  onShortcut({ id, value }, handler) {
    this.shortcuts.push({ id, handler, sequence: Input.stringifyShortcuts(value), index: 0 });
  }

  /**
   * @param {string} keyCombo
   */
  #triggerShortcuts(keyCombo) {
    let found = false;
    let matched = false;

    for (const shortcut of this.shortcuts) {
      if (shortcut.index !== this.shortcutIndex || shortcut.sequence[this.shortcutIndex] !== keyCombo) {
        continue;
      }

      matched = true;

      if (shortcut.sequence.length === ++shortcut.index) {
        found = true;
        shortcut.handler();
      }
    }

    this.shortcutIndex++;
    if (found || !matched) this.#resetShortcuts();
  }

  #resetShortcuts() {
    for (const shortcut of this.shortcuts) {
      shortcut.index = 0;
    }
    this.shortcutIndex = 0;
  }
}
