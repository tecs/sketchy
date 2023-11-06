/**
 * @typedef State
 * @property {boolean} orbiting
 * @property {boolean} drawing
 * @property {vec3} hovered
 * @property {vec3} hoveredGlobal
 * @property {Instance | null} hoveredInstance
 * @property {(orbiting: boolean) => void} setOrbiting
 * @property {(drawing: boolean) => void} setDrawing
 * @property {(position: Readonly<vec3>) => void} setHovered
 * @property {(position: Readonly<vec3>) => void} setHoveredGlobal
 * @property {(hoveredInstance: Instance) => void} setHoveredInstance
 */

/** @type {(engine: Engine) => State} */
export default (engine) => {
  /** @type {State} */
  const state = {
    orbiting: false,
    drawing: false,
    hovered: engine.math.vec3.fromValues(0, 0, 5),
    hoveredGlobal: engine.math.vec3.create(),
    hoveredInstance: null,
    setOrbiting(orbiting) {
      this.orbiting = orbiting;
    },
    setDrawing(drawing) {
      this.drawing = drawing;
    },
    setHovered(position) {
      this.hovered[0] = position[0];
      this.hovered[1] = position[1];
      this.hovered[2] = position[2];
    },
    setHoveredGlobal(position) {
      this.hoveredGlobal[0] = position[0];
      this.hoveredGlobal[1] = position[1];
      this.hoveredGlobal[2] = position[2];
    },
    setHoveredInstance(hoveredInstance) {
      this.hoveredInstance = hoveredInstance;
    },
  };

  return state;
};
