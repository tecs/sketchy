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
      const { enteredInstance, selectedInstance, hoveredPointIndex, hoveredLineIndex, currentStep } = scene;

      if (currentStep) {
        scene.setSelectedPoint(hoveredPointIndex);
        scene.setSelectedLine(hoveredLineIndex);
        return;
      }

      let clicked = scene.hoveredInstance;
      let parent = clicked ? SubInstance.getParent(clicked) : undefined;
      while (clicked && clicked !== enteredInstance && (parent?.instance ?? null) !== enteredInstance) {
        clicked = parent?.instance ?? null;
        parent = clicked ? SubInstance.getParent(clicked) : undefined;
      }

      if (count === 1) {
        if (selectedInstance && clicked === selectedInstance) return;
        const clickedOwn = SubInstance.belongsTo(clicked, enteredInstance);

        if (clicked === enteredInstance) scene.setSelectedInstance(null);
        else if (clickedOwn) scene.setSelectedInstance(clicked);
        else if (selectedInstance) scene.setSelectedInstance(null);

        return;
      }

      if (clicked && clicked === selectedInstance) scene.setEnteredInstance(clicked);
      else if (clicked !== enteredInstance) {
        scene.setEnteredInstance(enteredInstance ? SubInstance.getParent(enteredInstance)?.instance ?? null : null);
      }
    },
    abort() {
      if (engine.tools.selected !== this || engine.scene.currentStep) return;

      if (scene.selectedInstance) {
        scene.setSelectedInstance(null);
      } else if (scene.enteredInstance) {
        scene.setEnteredInstance(SubInstance.getParent(scene.enteredInstance)?.instance ?? null);
      }
    },
  };

  return select;
};
