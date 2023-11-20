/**
 * @typedef {"left"|"middle"|"right"} MouseButton
 */

export default class Input {
  /** @type {Engine} */
  #engine;

  /** @type {MouseButton|null} */
  button = null;

  /** @type {string|null} */
  key = null;

  // TODO store decimal values as well (0.0 - 1.0 and -1.0 to 1.0)
  /** @type {vec3} */
  position;

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
    this.position = engine.math.vec3.fromValues(0, 0, 0);
  }

  /**
   * @param {number} x
   * @param {number} y
   * @param {number} dX
   * @param {number} dY
   */
  setPosition(x, y, dX, dY) {
    const previous = this.#engine.math.vec3.clone(this.position);
    this.position[0] = x;
    this.position[1] = y;
    this.#engine.emit('mousemove', this.position, this.#engine.math.vec3.fromValues(dX, dY, 0), previous);
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
    }
    if (this.button) {
      this.#engine.emit(down ? 'mousedown' : 'mouseup', this.button);
    }
  }

  /**
   * @param {string} key
   * @param {boolean} down
   */
  setKey(key, down) {
    switch (key) {
      case 'Alt': this.alt = down; break;
      case 'Shift': this.shift = down; break;
      case 'Control': this.ctrl = down; break;
    }
    this.key = key;
    this.#engine.emit(down ? 'keydown' : 'keyup', key);
  }
}
