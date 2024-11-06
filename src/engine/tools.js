import Input from './input.js';

/**
 * @typedef Tool
 * @property {string} type
 * @property {string} name
 * @property {string | string[]} shortcut
 * @property {string} icon
 * @property {string} [cursor]
 * @property {boolean} [active]
 * @property {number[]} [distance]
 * @property {(distance: number[]) => void} [setDistance]
 * @property {(count?: number) => void} start
 * @property {(delta: ReadonlyVec3) => void} update
 * @property {(count?: number) => void} end
 * @property {() => void} abort
 */

export default class Tools {
  /** @type {Engine} */
  #engine;

  /** @type {Readonly<import("./config").StringSetting>[]} */
  #shortcuts = [];

  /** @type {Tool | null} */
  selected = null;

  /** @type {Tool[]} */
  tools = [];

  /**
   * @param {Engine} engine
   */
  constructor(engine) {
    this.#engine = engine;

    engine.on('mousedown', (button, click) => {
      if (button === 'left' && !this.selected?.active) this.selected?.start(click);
    });

    engine.on('mouseup', (button, click) => {
      if (button === 'left' && this.selected?.active !== false) this.selected?.end(click);
    });

    engine.on('mousemove', (_, delta) => {
      if (this.selected?.active !== false) this.selected?.update(delta);
    });

    engine.on('toolchange', (_, tool) => {
      if (tool?.active !== false) tool?.abort();
    });

    engine.on('keyup', (_, keyCombo) => {
      const index = this.#shortcuts.findIndex(({ value }) => value === keyCombo);
      if (index > -1) this.setTool(this.tools[index]);
      else if (keyCombo === 'escape' && this.selected?.active !== false) this.selected?.abort();
    });
  }

  /**
   * @param {(engine: Engine) => Tool} Tool
   */
  addTool(Tool) {
    const tool = Tool(this.#engine);
    this.tools.push(tool);
    this.#shortcuts.push(this.#engine.config.createString(
      `shortcuts.${tool.type}Tool`,
      `${tool.name} tool shortcut`,
      'key',
      Input.stringify(tool.shortcut),
    ));
    if (!this.selected) this.setTool(tool);
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
   * @param  {...string} toolTypes
   * @returns {boolean}
   */
  isActive(...toolTypes) {
    for (const { type, active } of this.tools) {
      if (active && toolTypes.includes(type)) return true;
    }
    return false;
  }
}
