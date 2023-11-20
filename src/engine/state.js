export default class State {
  /** @type {vec3} */
  hovered;

  /** @type {vec3} */
  hoveredGlobal;

  /** @type {Instance | null} */
  hoveredInstance = null;

  orbiting = false;
  drawing = false;

  /**
   * @param {Engine} engine
   */
  constructor(engine) {
    this.hovered = engine.math.vec3.fromValues(0, 0, 5);
    this.hoveredGlobal = engine.math.vec3.create();
  }

  /**
   * @param {boolean} orbiting
   */
  setOrbiting(orbiting) {
    this.orbiting = orbiting;
  }

  /**
   * @param {boolean} drawing
   */
  setDrawing(drawing) {
    this.drawing = drawing;
  }

  /**
   * @param {Readonly<vec3>} position
   */
  setHovered(position) {
    this.hovered[0] = position[0];
    this.hovered[1] = position[1];
    this.hovered[2] = position[2];
  }

  /**
   * @param {Readonly<vec3>} position
   */
  setHoveredGlobal(position) {
    this.hoveredGlobal[0] = position[0];
    this.hoveredGlobal[1] = position[1];
    this.hoveredGlobal[2] = position[2];
  }

  /**
   * @param {Instance | null} hoveredInstance
   */
  setHoveredInstance(hoveredInstance) {
    this.hoveredInstance = hoveredInstance;
  }
}
