export default class State {
  /** @type {Instance | null} */
  hoveredInstance = null;

  orbiting = false;
  drawing = false;

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
   * @param {Instance | null} hoveredInstance
   */
  setHoveredInstance(hoveredInstance) {
    this.hoveredInstance = hoveredInstance;
  }
}
