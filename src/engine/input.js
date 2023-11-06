/**
 * @typedef {"left"|"middle"|"right"} MouseButton
 * 
 * @typedef InputState
 * @property {vec3} position
 * @property {boolean} leftButton
 * @property {boolean} middleButton
 * @property {boolean} rightButton
 * @property {MouseButton|null} button
 * @property {boolean} shift
 * @property {boolean} ctrl
 * @property {boolean} alt
 * @property {string|null} key
 * @property {(x: number, y: number, dX: number, dY: number) => void} setPosition
 * @property {(button: number, down: boolean) => void} setButton
 * @property {(key: string, down: boolean) => void} setKey
 */

/** @type {(engine: Engine) => InputState} */
export default (engine) => {
  const { vec3 } = engine.math;
  return {
    position: vec3.fromValues(0, 0, 0),
    leftButton: false,
    middleButton: false,
    rightButton: false,
    button: null,
    shift: false,
    ctrl: false,
    alt: false,
    key: null,
    setPosition(x, y, dX, dY) {
      const previous = vec3.clone(this.position);
      this.position[0] = x;
      this.position[1] = y;
      engine.emit('mousemove', this.position, vec3.fromValues(dX, dY, 0), previous);
    },
    setButton(button, down) {
      switch (button) {
        case 0:
          this.leftButton = down;
          this.button = "left";
          break;
        case 1:
          this.middleButton = down;
          this.button = "middle";
          break;
        case 2:
          this.rightButton = down;
          this.button = "right";
          break;
      }
      if (this.button) {
        engine.emit(down ? 'mousedown' : 'mouseup', this.button);
      }
    },
    setKey(key, down) {
      switch (key) {
        case 'Alt': this.alt = down; break;
        case 'Shift': this.shift = down; break
        case 'Control': this.ctrl = down; break
      }
      this.key = key;
      engine.emit(down ? 'keydown' : 'keyup', key);
    },
  };
};