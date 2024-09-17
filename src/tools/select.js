import SubInstance from '../engine/cad/subinstance.js';

/** @type {(engine: Engine) => Tool} */
export default (engine) => {
  const { editor: { selection }, scene, input } = engine;

  /**
   * @param {Parameters<typeof selection["add"]>[0]} elements
   * @param {boolean} [shouldToggle]
   */
  const toggleOrSet = (elements, shouldToggle = false) => {
    if (shouldToggle) selection.toggle(elements);
    else selection.set(elements);
  };

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
      const toggle = input.ctrl;

      if (currentStep && enteredInstance) {
        if (hoveredLineIndex !== null) {
          toggleOrSet([{ type: 'line', index: hoveredLineIndex, instance: enteredInstance }], toggle);
        } else if (hoveredPointIndex !== null) {
          toggleOrSet([{ type: 'point', index: hoveredPointIndex, instance: enteredInstance }], toggle);
        } else if (!toggle) selection.clear();
        return;
      }

      let clicked = scene.hoveredInstance;
      let parent = clicked ? SubInstance.getParent(clicked) : undefined;
      while (clicked && clicked !== enteredInstance && (parent?.instance ?? null) !== enteredInstance) {
        clicked = parent?.instance ?? null;
        parent = clicked ? SubInstance.getParent(clicked) : undefined;
      }

      const selectedInstances = selection.getByType('instance').map(({ instance }) => instance);

      if (count === 1) {
        const clickedOwn = SubInstance.belongsTo(clicked, enteredInstance);

        if (clicked === enteredInstance && !toggle) selection.clear();
        else if (clicked === enteredInstance) return;
        else if (clickedOwn) toggleOrSet(clicked ? [{ type: 'instance', index: clicked.Id.int, instance: clicked }] : [], toggle);
        else if (selectedInstances.length && !toggle) selection.clear();

        return;
      }

      if (clicked && selectedInstances.includes(clicked)) scene.setEnteredInstance(clicked);
      else if (clicked !== enteredInstance) {
        scene.setEnteredInstance(enteredInstance ? SubInstance.getParent(enteredInstance)?.instance ?? null : null);
      }
    },
    abort() {
      if (engine.tools.selected !== this) return;

      if (selection.elements.length) {
        selection.clear();
      } else if (scene.enteredInstance && !engine.scene.currentStep) {
        scene.setEnteredInstance(SubInstance.getParent(scene.enteredInstance)?.instance ?? null);
      }
    },
  };

  return select;
};
