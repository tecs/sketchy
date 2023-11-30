export default class State {
  /** @type {Instance | null} */
  hoveredInstance = null;
  drawing = false;

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
