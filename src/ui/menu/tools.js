import { UIMenu } from '../lib/index.js';

/**
 * @param {Engine} engine
 * @returns {UIMenu}
 */
export default (engine) => {
  const menu = new UIMenu({ position: 'left' });

  /** @type {Record<string, import("../lib").UIButton>} */
  const toolMap = {};
  for (const tool of engine.tools.tools) {
    toolMap[tool.type] = menu.addButton(tool.icon, () => engine.tools.setTool(tool), tool.name);
  }
  if (engine.tools.selected) menu.select(toolMap[engine.tools.selected.type]);
  engine.on('toolchange', (current) => {
    engine.driver.canvas.style.cursor = current.cursor ?? 'default';
    menu.select(toolMap[current.type]);
  });

  return menu;
};
