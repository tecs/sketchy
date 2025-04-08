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
    shortcut.onChange(() => toolMap[tool.type].$element({ title: engine.input.tooltip(tool.name, shortcut) }));
  }
  if (engine.tools.selected) menu.select(toolMap[engine.tools.selected.type]);
  engine.on('toolchange', tool => {
    if (tool) menu.select(toolMap[tool.type]);
  });

  engine.on('toolenabled', tool => void(toolMap[tool.type].show()));
  engine.on('tooldisabled', tool => void(toolMap[tool.type].hide()));

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
      if (!action) {
        contextMenu.addSeparator();
        continue;
      }
      const icon = getIcon(action.icon);
      const tooltip = engine.input.tooltip(action.name, action.key);
      const button = contextMenu.addButton(icon.text, action.call, tooltip, { ...icon.style, ...action.style });
      action.key?.onChange(() => button.$element({ title: engine.input.tooltip(action.name, action.key) }));
      contextActions.set(action, button);
      if (action.active) contextMenu.activate(button);
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

  engine.on('contextactionactivate', action => {
    const button = contextActions.get(action);
    if (!button) return;

    contextMenu.activate(button);
  });

  engine.on('contextactiondeactivate', action => {
    const button = contextActions.get(action);
    if (!button) return;

    contextMenu.deactivate(button);
  });

  return menu;
};
