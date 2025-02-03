import Input from './input.js';

/** @typedef {import("./general/properties.js").PropertyData} PropertyData */

/**
 * @typedef BaseTool
 * @property {string} type
 * @property {string} name
 * @property {import("./input.js").KeyboardShortcutRepresentation} shortcut
 * @property {string} icon
 * @property {Parameters<typeof import("../ui/assets.js").getCursor>[0]} [cursor]
 * @property {boolean} [active]
 * @property {(count?: number) => void} start
 * @property {(delta: ReadonlyVec3) => void} update
 * @property {(count?: number) => void} end
 * @property {() => void} abort
 */

/**
 * @typedef ToolConfig
 * @property {AnyTool} tool
 * @property {import("./config").StringSetting} shortcut
 * @property {boolean }enabled
 */

/**
 * @template {PropertyData["type"]} T
 * @typedef ToolValue
 * @property {Find<PropertyData, "type", T>["value"]} [value]
 * @property {(value: Find<PropertyData, "type", T>["value"]) => void} setValue
 * @property {T} valueType
 */

/**
 * @typedef Action
 * @property {string} name
 * @property {string} icon
 * @property {Record<string, string>} [style]
 * @property {ToolConfig["shortcut"]} [key]
 * @property {() => void} call
 */

/**
 * @template {PropertyData["type"] | never} [T=never]
 * @typedef {IfExtends<T, PropertyData["type"], BaseTool & ToolValue<T>, BaseTool>} Tool
 */

export default class Tools {
  /** @type {Engine} */
  #engine;

  /** @type {ToolConfig[]} */
  #tools = [];

  /** @type {AnyTool?} */
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

    engine.on('keyup', (_, keyCombo) => {
      if (keyCombo === 'esc' && this.selected?.active !== false) this.selected?.abort();
    });

    engine.on('shortcut', setting => {
      const tool = this.#tools.find(({ shortcut }) => shortcut === setting);
      if (tool?.enabled) this.setTool(tool.tool);
    });
  }

  /**
   * @param {(engine: Engine) => AnyTool} Tool
   */
  addTool(Tool) {
    const tool = Tool(this.#engine);
    const shortcut = this.#engine.config.createString(
      `shortcuts.${tool.type}Tool`,
      `${tool.name} tool shortcut`,
      'key',
      Input.stringify(tool.shortcut),
    );
    this.#tools.push({ tool, shortcut, enabled: true });
    this.#engine.input.registerShortcuts(shortcut);
    if (!this.selected) this.setTool(tool);
  }

  /**
   * @param {AnyTool?} tool
   */
  setTool(tool) {
    const previous = this.selected;
    if (previous === tool) return;

    this.selected = tool;

    if (previous && previous.active !== false) previous.abort();

    this.#engine.emit('cursorchange', tool?.cursor);
    this.#engine.emit('toolchange', tool, previous);
  }

  /**
   * @param {AnyTool} tool
   */
  enable(tool) {
    const toolSettings = this.#tools.find(toolSetting => toolSetting.tool === tool);
    if (toolSettings?.enabled !== false) return;

    toolSettings.enabled = true;
    this.#engine.emit('toolenabled', tool);

    if (!this.selected) this.setTool(tool);
  }

  /**
   * @param {AnyTool} tool
   */
  disable(tool) {
    const toolSettings = this.#tools.find(toolSetting => toolSetting.tool === tool);
    if (toolSettings?.enabled !== true) return;

    toolSettings.enabled = false;
    this.#engine.emit('tooldisabled', tool);
    if (tool === this.selected) {
      const nextTool = this.#tools.find(({ enabled }) => enabled)?.tool;
      this.setTool(nextTool ?? null);
    }
  }

  /**
   * @param {Action[] | null} actions
   */
  setContextActions(actions) {
    this.#engine.emit('contextactions', actions);
  }

  /**
   * @param {Action | null} action
   */
  activateContextAction(action) {
    this.#engine.emit('contextactionchange', action);
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
   * @returns {AnyTool[]}
   */
  list() {
    return this.#tools.map(({ tool }) => tool);
  }

  /**
   * @param {string} type
   * @returns {AnyTool?}
   */
  get(type) {
    return this.#tools.find(({ tool }) => tool.type === type)?.tool ?? null;
  }

  /**
   * @returns {Readonly<Readonly<ToolConfig>[]>}
   */
  getConfig() {
    return this.#tools;
  }
}
