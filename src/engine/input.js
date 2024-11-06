const { vec3 } = glMatrix;

const PLUS_TOKEN = ' [+] ';

/** @typedef {"left"|"middle"|"right"} MouseButton */

export default class Input {
  /** @type {Engine} */
  #engine;

  /** @type {MouseButton|null} */
  button = null;

  /** @type {string|null} */
  key = null;

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
    }
    return key;
  }

  /**
   * @param {string} combo
   * @returns {string[]}
   */
  static parse(combo) {
    if (combo.length === 0) return [];
    const keys = combo.split(PLUS_TOKEN);
    for (let i = 0; i < keys.length; ++i) {
      keys[i] = this.normalizeKey(keys[i]);
    }
    return keys;
  }

  /**
   * @param {string[] | string} keys
   * @returns {string}
   */
  static stringify(keys) {
    if (!Array.isArray(keys)) keys = [keys];
    for (let i = 0; i < keys.length; ++i) {
      keys[i] = this.normalizeKey(keys[i]);
    }
    return keys.join(PLUS_TOKEN);
  }

  /**
   * @param {Engine} engine
   */
  constructor(engine) {
    this.#engine = engine;
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

    if (down) this.#engine.emit('keydown', key, keyCombo);
    else this.#engine.emit('keyup', key, keyCombo);
  }

  /**
   * @param {-1|1} direction
   */
  scroll(direction) {
    this.#engine.emit('mousescroll', direction);
  }
}
