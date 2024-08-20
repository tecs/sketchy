const { vec3 } = glMatrix;

/** @typedef {"left"|"middle"|"right"} MouseButton */

export default class Input {
  /** @type {Engine} */
  #engine;

  /** @type {MouseButton|null} */
  button = null;

  /** @type {string|null} */
  key = null;

  position = vec3.create();

  leftButton = false;
  middleButton = false;
  rightButton = false;
  shift = false;
  ctrl = false;
  alt = false;

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
   */
  setButton(button, down) {
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

    if (down) this.#engine.emit('mousedown', this.button);
    else this.#engine.emit('mouseup', this.button);
  }

  /**
   * @param {string} key
   * @param {boolean} down
   */
  setKey(key, down) {
    /** @type {string[]} */
    const combo = [];

    if (key === 'GroupNext') {
      key = this.shift === down ? 'Alt' : 'Shift';
    }

    switch (key) {
      case 'Alt':
      case 'AltGraph':
        key = 'Alt';
        this.alt = down;
        break;
      case 'Shift': this.shift = down; break;
      case 'Control': this.ctrl = down; break;
      default: combo.push(key);
    }

    this.key = key;

    if (this.shift || key === 'Shift') combo.unshift('Shift');
    if (this.alt || key === 'Alt') combo.unshift('Alt');
    if (this.ctrl || key === 'Control') combo.unshift('Control');
    const keyCombo = combo.join(' + ');

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
