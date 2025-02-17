import Sketch from '../engine/cad/sketch.js';
import SubInstance from '../engine/cad/subinstance.js';

/** @type {(engine: Engine) => BaseTool} */
export default (engine) => {
  const { editor: { selection, temp }, scene, input } = engine;
  let lasso = false;

  /**
   * @param {Parameters<typeof selection["add"]>[0]} elements
   * @param {boolean} [shouldToggle]
   */
  const toggleOrSet = (elements, shouldToggle = false) => {
    if (shouldToggle) selection.toggle(elements);
    else selection.set(elements);
  };

  /** @type {import("../engine/editor.js").Element[]} */
  let oldSelection = [];

  /** @type {BaseTool} */
  const select = {
    type: 'select',
    name: 'Select',
    shortcut: 'space',
    icon: 'pointer-simplified',
    active: false,
    start() {
      if (!input.leftButton) return;
      lasso = false;
      this.active = true;
    },
    update() {
      if (!this.active) return;

      if (lasso) {
        selection.set(temp.elements);
        if (input.ctrl) selection.toggle(oldSelection);
        return;
      }

      oldSelection = selection.elements.slice();
      lasso = true;
    },
    end(count = 1) {
      if (!this.active) return;
      this.active = false;

      if (lasso) {
        lasso = false;
        return;
      }

      const {
        enteredInstance,
        hoveredInstance,
        hoveredPointId,
        hoveredLineId,
        hoveredFaceId,
        hoveredConstraintIndex,
        hoveredAxisId,
        currentStep,
      } = scene;
      const toggle = input.ctrl;

      const hoveredSelf = hoveredInstance === enteredInstance;
      if (!currentStep && enteredInstance && hoveredSelf && hoveredFaceId !== null) {
        toggleOrSet({ type: 'face', id: hoveredFaceId, instance: enteredInstance }, toggle);
        return;
      } else if (currentStep && enteredInstance) {
        if (hoveredSelf && hoveredLineId !== null) {
          toggleOrSet({ type: 'line', id: hoveredLineId, instance: enteredInstance }, toggle);
        } else if (hoveredSelf && hoveredPointId !== null) {
          toggleOrSet({ type: 'point', id: hoveredPointId, instance: enteredInstance }, toggle);
        } else if (hoveredConstraintIndex !== null && currentStep instanceof Sketch) {
          toggleOrSet({ type: 'constraint', id: hoveredConstraintIndex, instance: enteredInstance }, toggle);
        } else if (hoveredAxisId !== null) {
          toggleOrSet({ type: 'axis', id: hoveredAxisId, instance: enteredInstance }, toggle);
        } else if (!toggle) selection.clear();
        return;
      }

      let clicked = hoveredInstance;
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
        else if (clickedOwn) toggleOrSet(clicked ? { type: 'instance', id: clicked.Id.int, instance: clicked } : [], toggle);
        else if (!toggle) selection.clear();
        return;
      }

      if (clicked && selectedInstances.includes(clicked)) scene.setEnteredInstance(clicked);
      else if (clicked !== enteredInstance) {
        scene.setEnteredInstance(enteredInstance ? SubInstance.getParent(enteredInstance)?.instance ?? null : null);
      }
    },
    abort() {
      if (!this.active) return;
      this.active = false;

      if (lasso) {
        lasso = false;
        selection.set(oldSelection);
        input.setButton(0, false, 1);
        return;
      }

      if (selection.elements.length) {
        selection.clear();
      } else if (scene.enteredInstance && !engine.scene.currentStep) {
        scene.setEnteredInstance(SubInstance.getParent(scene.enteredInstance)?.instance ?? null);
      }
    },
  };

  return select;
};
