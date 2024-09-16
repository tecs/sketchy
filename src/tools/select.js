import SubInstance from '../engine/cad/subinstance.js';

/** @type {(engine: Engine) => Tool} */
export default (engine) => {
  const { scene } = engine;

  /** @type {Tool} */
  const select = {
    type: 'select',
    name: 'Select',
    shortcut: ' ',
    icon: '🮰',
    start() {},
    update() {},
    end(count = 1) {
      const { enteredInstance, hoveredPointIndex, hoveredLineIndex, currentStep } = scene;

      if (currentStep && enteredInstance) {
        if (hoveredLineIndex !== null) {
          scene.setSelection([{ type: 'line', index: hoveredLineIndex, instance: enteredInstance }]);
        } else if (hoveredPointIndex !== null) {
          scene.setSelection([{ type: 'point', index: hoveredPointIndex, instance: enteredInstance }]);
        }
        return;
      }

      let clicked = scene.hoveredInstance;
      let parent = clicked ? SubInstance.getParent(clicked) : undefined;
      while (clicked && clicked !== enteredInstance && (parent?.instance ?? null) !== enteredInstance) {
        clicked = parent?.instance ?? null;
        parent = clicked ? SubInstance.getParent(clicked) : undefined;
      }

      const selectedInstances = scene.getSelectionByType('instance').map(({ instance }) => instance);

      if (count === 1) {
        if (selectedInstances.length && clicked && selectedInstances.includes(clicked)) {
          scene.setSelection([{ type: 'instance', index: clicked.Id.int, instance: clicked }]);
          return;
        }
        const clickedOwn = SubInstance.belongsTo(clicked, enteredInstance);

        if (clicked === enteredInstance) scene.clearSelection();
        else if (clickedOwn) scene.setSelection(clicked ? [{ type: 'instance', index: clicked.Id.int, instance: clicked }] : []);
        else if (selectedInstances.length) scene.clearSelection();

        return;
      }

      if (clicked && selectedInstances.includes(clicked)) scene.setEnteredInstance(clicked);
      else if (clicked !== enteredInstance) {
        scene.setEnteredInstance(enteredInstance ? SubInstance.getParent(enteredInstance)?.instance ?? null : null);
      }
    },
    abort() {
      if (engine.tools.selected !== this) return;

      if (scene.selection.length) {
        scene.clearSelection();
      } else if (scene.enteredInstance && !engine.scene.currentStep) {
        scene.setEnteredInstance(SubInstance.getParent(scene.enteredInstance)?.instance ?? null);
      }
    },
  };

  return select;
};
