import Sketch from '../engine/cad/sketch.js';
import SubInstance from '../engine/cad/subinstance.js';

/** @typedef {import("../engine/editor.js").Element} Element */

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
    setCursor();
  };

  /**
   * @returns {Element | undefined}
   */
  const getHovered = () => {
    const {
      enteredInstance: instance,
      hoveredPointId: pointId,
      hoveredLineId: lineId,
      hoveredFaceId: faceId,
      hoveredConstraintIndex: constraintId,
      hoveredAxisId: axisId,
      hoveredInstance,
      currentStep,
    } = scene;

    const hoveredSelf = instance === hoveredInstance;

    if (currentStep instanceof Sketch && instance) {
      if (hoveredSelf && lineId !== null) return { type: 'line', id: lineId, instance };
      if (hoveredSelf && pointId !== null) return { type: 'point', id: pointId, instance };
      if (constraintId !== null) return { type: 'constraint', id: constraintId, instance };
      if (axisId !== null) return { type: 'axis', id: axisId, instance };
      return;
    }
    if (instance && hoveredSelf && faceId !== null) return { type: 'face', id: faceId, instance };
    if (hoveredSelf) return;

    const hovered = SubInstance.asDirectChildOf(hoveredInstance, instance);
    if (hovered) return { type: 'instance', id: hovered.Id.int, instance: hovered };
  };

  /** @type {Element[]} */
  let oldSelection = [];

  /** @type {BaseTool} */
  const select = {
    type: 'select',
    name: 'Select',
    shortcut: 'space',
    icon: 'pointer-simplified',
    cursor: 'select',
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

      const { enteredInstance, currentStep } = scene;
      const toggle = input.ctrl;

      const hoveredElement = getHovered();
      switch (hoveredElement?.type) {
        case 'instance':
          // ignore double-clicking on instances while holding ctrl
          if (count > 1 && !toggle) break;
        case 'face':
        case 'line':
        case 'point':
        case 'constraint':
        case 'axis':
          return toggleOrSet(hoveredElement, toggle);
      }

      // ctrl-clicked on nothing
      if (toggle) return;

      // clicked on nothing
      if (count === 1) return selection.clear();

      // double-clicked outside active step
      if (currentStep) return currentStep.exitStep();

      // double-clicked on a child instance
      if (hoveredElement && selection.getElement(hoveredElement)) {
        return scene.setEnteredInstance(hoveredElement.instance);
      }

      // double-clicked outside entered instance
      if (!hoveredElement && enteredInstance) {
        return scene.setEnteredInstance(SubInstance.getParent(enteredInstance)?.instance ?? null);
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

  let cursorListener = false;

  const setCursor = () => {
    if (!cursorListener) return;
    if (!input.ctrl) return engine.emit('cursorchange', select.cursor);

    const hovered = getHovered();
    if (lasso || !hovered) return engine.emit('cursorchange', 'add-remove-selection');
    if (selection.getElement(hovered)) return engine.emit('cursorchange', 'remove-selection');
    engine.emit('cursorchange', 'add-selection');
  };

  engine.on('toolchange', tool => void(cursorListener = tool === select));
  engine.on('contextactionchange', action => void(cursorListener = engine.tools.selected === select && action === null));

  engine.on('keydown', setCursor);
  engine.on('keyup', setCursor);
  engine.on('mousemove', setCursor);

  return select;
};
