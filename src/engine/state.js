export default class State {
  /** @type {Instance | null} */
  hoveredInstance = null;

  /**
   * @param {Instance | null} hoveredInstance
   */
  setHoveredInstance(hoveredInstance) {
    this.hoveredInstance = hoveredInstance;
  }
}
