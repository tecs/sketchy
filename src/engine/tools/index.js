import LineTool from "./line.js";
import RectangleTool from "./rectangle.js";
import SelectTool from "./select.js";
import MoveTool from './move.js';
import OrbitTool from "./orbit.js";

/**
 * @typedef {"select"|"line"|"rectangle"|"orbit"|"move"} ToolType
 * 
 * @typedef Tool
 * @property {ToolType} type
 * @property {string} name
 * @property {string} shortcut
 * @property {string} icon
 * @property {string} [cursor]
 * @property {() => void} start
 * @property {(delta: Readonly<vec3>) => void} update
 * @property {() => void} end
 * @property {() => void} abort
 * 
 * @typedef Tools
 * @property {Tool} selected
 * @property {Tool[]} tools
 * @property {(tool: Readonly<Tool>) => void} setTool
 */

/** @type {(engine: Engine) => Tools} */
export default (engine) => {
  const defaultTool = SelectTool(engine);

  /** @type {Tools} */
  const tools = {
    selected: defaultTool,
    tools: [
      defaultTool,
      LineTool(engine),
      RectangleTool(engine),
      MoveTool(engine),
      OrbitTool(engine),
    ],
    setTool(tool) {
      const previous = this.selected;
      if (previous === tool) return;

      tools.selected = tool;
      engine.driver.canvas.style.cursor = tool.cursor ?? 'default';
  
      engine.emit('toolchange', tool, previous);
    },
  };

  engine.on('keyup', () => {
    for (const tool of tools.tools) {
      if (tool.shortcut === engine.input.key) {
        tools.setTool(tool);
        break;
      }
    }
  });

  return tools;
};