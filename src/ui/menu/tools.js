import { getIcon } from '../assets.js';
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
  for (const { tool, shortcut } of engine.tools.getConfig()) {
    const icon = getIcon(tool.icon);
    const tooltip = engine.input.tooltip(tool.name, shortcut);
    toolMap[tool.type] = menu.addButton(icon.text, () => engine.tools.setTool(tool), tooltip, icon.style);
  }
  if (engine.tools.selected) menu.select(toolMap[engine.tools.selected.type]);
  engine.on('toolchange', tool => {
    if (tool) menu.select(toolMap[tool.type]);
  });

  engine.on('toolenabled', tool => toolMap[tool.type].show());
  engine.on('tooldisabled', tool => toolMap[tool.type].hide());

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
    contextMenu.clearChildren();
    for (const action of actions) {
      const icon = getIcon(action.icon);
      const tooltip = engine.input.tooltip(action.name, action.key);
      contextActions.set(
        action,
        contextMenu.addButton(icon.text, action.call, tooltip, {
          ...icon.style,
          ...action.style,
        }),
      );
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
