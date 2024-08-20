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
    }
    this.key = key;
    if (down) this.#engine.emit('keydown', key);
    else this.#engine.emit('keyup', key);
  }

  /**
   * @param {-1|1} direction
   */
  scroll(direction) {
    this.#engine.emit('mousescroll', direction);
  }
}
