import Input from './input.js';

/**
 * @typedef Tool
 * @property {string} type
 * @property {string} name
 * @property {import('./input.js').KeyboardShortcutRepresentation} shortcut
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

  /** @type {{ tool: Tool, shortcut: import("./config").StringSetting }[]} */
  #tools = [];

  /** @type {Tool?} */
  selected = null;

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
      if (keyCombo === 'esc' && this.selected?.active !== false) this.selected?.abort();
    });

    engine.on('shortcut', setting => {
      const tool = this.#tools.find(({ shortcut }) => shortcut === setting);
      if (tool) this.setTool(tool.tool);
    });
  }

  /**
   * @param {(engine: Engine) => Tool} Tool
   */
  addTool(Tool) {
    const tool = Tool(this.#engine);
    const shortcut = this.#engine.config.createString(
      `shortcuts.${tool.type}Tool`,
      `${tool.name} tool shortcut`,
      'key',
      Input.stringify(tool.shortcut),
    );
    this.#tools.push({ tool, shortcut });
    this.#engine.input.registerShortcuts(shortcut);
    if (!this.selected) this.setTool(tool);
  }

  /**
   * @param {Tool} tool
   */
  setTool(tool) {
    const previous = this.selected;
    if (previous === tool) return;

    this.selected = tool;

    this.#engine.emit('cursorchange', tool.cursor);
    this.#engine.emit('toolchange', tool, previous);
  }

  /**
   * @param  {...string} toolTypes
   * @returns {boolean}
   */
  isActive(...toolTypes) {
    for (const { tool: { type, active }} of this.#tools) {
      if (active && toolTypes.includes(type)) return true;
    }
    return false;
  }

  /**
   * @returns {Tool[]}
   */
  list() {
    return this.#tools.map(({ tool }) => tool);
  }

  /**
   * @param {string} type
   * @returns {Tool?}
   */
  get(type) {
    return this.#tools.find(({ tool }) => tool.type === type)?.tool ?? null;
  }
}
