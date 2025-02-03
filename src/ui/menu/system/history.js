import { getIcon } from "../../assets.js";

/**
 * @param {Engine} engine
 * @param {import("../../lib/index.js").AnyUIContainer} container
 */
export default (engine, container) => {
  const undoIcon = getIcon('undo');
  const redoIcon = getIcon('redo');

  const undoTooltip = engine.input.tooltip('Undo', engine.config.get('shortcuts.undo', 'key'));
  const redoTooltip = engine.input.tooltip('Redo', engine.config.get('shortcuts.redo', 'key'));

  const undoButton = container.addButton(undoIcon.text, () => engine.history.undo(), undoTooltip);
  const redoButton = container.addButton(redoIcon.text, () => engine.history.redo(), redoTooltip);
  undoButton.toggleDisabled();
  redoButton.toggleDisabled();

  undoButton.$element({ style: undoIcon.style });
  redoButton.$element({ style: redoIcon.style });

  engine.on('historychange', () => {
    undoButton.toggleDisabled(!engine.history.canUndo);
    redoButton.toggleDisabled(!engine.history.canRedo);
  });
};
