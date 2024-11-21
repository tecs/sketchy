import { UIMenu } from '../lib/index.js';

/** @typedef {import("../lib").UIButton} UIButton */

/**
 * @param {Engine} engine
 * @returns {UIMenu}
 */
export default (engine) => {
  const menu = new UIMenu({ position: 'left' });

  /** @type {Record<string, UIButton>} */
  const toolMap = {};
  for (const tool of engine.tools.list()) {
    toolMap[tool.type] = menu.addButton(tool.icon, () => engine.tools.setTool(tool), tool.name);
  }
  if (engine.tools.selected) menu.select(toolMap[engine.tools.selected.type]);
  engine.on('toolchange', tool => {
    if (tool) menu.select(toolMap[tool.type]);
  });

  const contextMenu = menu.addMenu();
  contextMenu.hide();

  /** @type {Map<import("../../engine/tools.js").Action, UIButton>} */
  const contextActions = new Map();

  engine.on('contextactions', actions => {
    contextActions.clear();
    if (!actions) {
      contextMenu.hide();
      contextMenu.clearChildren();
      return;
    }

    contextMenu.show();
    for (const action of actions) {
      contextActions.set(action, contextMenu.addButton(action.icon, action.call, action.name));
    }
  });

  engine.on('contextactionchange', action => {
    if (!action) {
      contextMenu.select(null);
      return;
    }

    const button = contextActions.get(action);
    if (!button) return;

    contextMenu.select(button);
  });

  return menu;
};
