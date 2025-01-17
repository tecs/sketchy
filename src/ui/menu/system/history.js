import { getIcon } from "../../assets.js";

/**
 * @param {Engine} engine
 * @param {import("../../lib/index.js").AnyUIContainer} container
 */
export default (engine, container) => {
  const undoIcon = getIcon('undo');
  const redoIcon = getIcon('redo');

  const undoButton = container.addButton(undoIcon.text, () => engine.history.undo(), 'Undo');
  const redoButton = container.addButton(redoIcon.text, () => engine.history.redo(), 'Redo');
  undoButton.toggleDisabled();
  redoButton.toggleDisabled();

  undoButton.$element({ style: undoIcon.style });
  redoButton.$element({ style: redoIcon.style });

  engine.on('historychange', () => {
    undoButton.toggleDisabled(!engine.history.canUndo);
    redoButton.toggleDisabled(!engine.history.canRedo);
  });
};
