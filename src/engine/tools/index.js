import LineTool from './line.js';
import RectangleTool from './rectangle.js';
import SelectTool from './select.js';
import MoveTool from './move.js';
import OrbitTool from './orbit.js';
import ZoomTool from './zoom.js';

/** @typedef {"select"|"line"|"rectangle"|"orbit"|"move"|"zoom"} ToolType */

/**
 * @typedef Tool
 * @property {ToolType} type
 * @property {string} name
 * @property {string} shortcut
 * @property {string} icon
 * @property {string} [cursor]
 * @property {boolean} [active]
 * @property {number[]} [distance]
 * @property {(distance: number[]) => void} [setDistance]
 * @property {() => void} start
 * @property {(delta: ReadonlyVec3) => void} update
 * @property {() => void} end
 * @property {() => void} abort
 */

export default class Tools {
  /** @type {Engine} */
  #engine;

  /** @type {Tool} */
  selected;

  /** @type {Tool[]} */
  tools = [];

  /**
   * @param {Engine} engine
   */
  constructor(engine) {
    this.#engine = engine;

    this.tools.push(SelectTool(engine));
    this.tools.push(LineTool(engine));
    this.tools.push(RectangleTool(engine));
    this.tools.push(MoveTool(engine));
    this.tools.push(OrbitTool(engine));
    this.tools.push(ZoomTool(engine));

    this.selected = this.tools[0];

    const shortcuts = this.tools.map(({ name, type, shortcut }) => engine.config.createString(
      `shortcuts.${type}Tool`,
      `${name} tool shortcut`,
      'key',
      shortcut,
    ));

    engine.on('keyup', (key) => {
      const index = shortcuts.findIndex(({ value }) => value === key);
      if (index > -1) this.setTool(this.tools[index]);
    });
  }

  /**
   * @param {Tool} tool
   */
  setTool(tool) {
    const previous = this.selected;
    if (previous === tool) return;

    this.selected = tool;

    this.#engine.emit('toolchange', tool, previous);
  }

  /**
   * @param  {...ToolType} toolTypes
   * @returns {boolean}
   */
  isActive(...toolTypes) {
    for (const { type, active } of this.tools) {
      if (active && toolTypes.includes(type)) return true;
    }
    return false;
  }
}
