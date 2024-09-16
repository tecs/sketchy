import Placement from '../engine/3d/placement.js';
import Sketch from '../engine/cad/sketch.js';
import SubInstance from '../engine/cad/subinstance.js';

const { vec3, mat4 } = glMatrix;

/** @type {(engine: Engine) => Tool} */
export default (engine) => {
  const { scene, history, emit } = engine;

  /**
   * @typedef InstanceSelection
   * @property {"instance"} type
   * @property {Instance} instance
   */

  /**
   * @typedef LineSelection
   * @property {"line"} type
   * @property {import("../engine/cad/sketch.js").LineConstructionElement} line
   * @property {number} index
   * @property {Instance} instance
   * @property {Sketch} sketch
   */

  /**
   * @typedef PointSelection
   * @property {"point"} type
   * @property {import("../engine/cad/sketch.js").LineConstructionElement} line
   * @property {number} offset
   * @property {number} index
   * @property {Instance} instance
   * @property {Sketch} sketch
   */

  /** @typedef {InstanceSelection | LineSelection | PointSelection} Selection */

  /**
   * @typedef MoveData
   * @property {Selection[]} selection
   * @property {vec3} translation
   */

  /** @type {import("../engine/history.js").HistoryAction<MoveData>|undefined} */
  let historyAction;
  let released = true;

  // cached structures
  const transformation = mat4.create();
  const origin = vec3.create();
  const diff = vec3.create();

  /** @type {Tool} */
  const move = {
    type: 'move',
    name: 'Move',
    shortcut: 'm',
    icon: '🕀',
    cursor: 'move',
    get active() {
      return !!historyAction;
    },
    get distance() {
      return historyAction ? [vec3.length(historyAction.data.translation)] : undefined;
    },
    setDistance([distance]) {
      if (!historyAction) return;

      const { selection, translation } = historyAction.data;

      vec3.copy(diff, translation);
      vec3.normalize(translation, translation);
      vec3.scale(translation, translation, distance);
      vec3.subtract(diff, translation, diff);

      for (const selectionElement of selection) {
        switch (selectionElement.type) {
          case 'instance':
            selectionElement.instance.translateGlobal(diff);
            break;
          case 'line':
            Placement.toLocalRelativeCoords(diff, translation, transformation);
            selectionElement.line.data[0] += diff[0];
            selectionElement.line.data[1] += diff[1];
            selectionElement.line.data[2] += diff[0];
            selectionElement.line.data[3] += diff[1];
            selectionElement.sketch.update();
            break;
          case 'point':
            Placement.toLocalRelativeCoords(diff, translation, transformation);
            selectionElement.line.data[0 + selectionElement.offset] += diff[0];
            selectionElement.line.data[1 + selectionElement.offset] += diff[1];
            selectionElement.sketch.update();
            break;
        }
      }

      this.end();
      emit('scenechange');
    },
    start() {
      released = false;
      const { currentStep, hoveredInstance, enteredInstance, hoveredPointIndex, hoveredLineIndex } = scene;

      const sketch = currentStep ?? enteredInstance?.body.step ?? null;
      const movementSelection = /** @type {Selection[]} */ ([]);

      const selectedInstances = scene.getSelectionByType('instance').map(({ instance }) => instance);
      const candidatePoints = scene.getSelectionByType('point');
      const candidateLines = scene.getSelectionByType('line');

      if (!selectedInstances.length && hoveredInstance === enteredInstance && hoveredInstance) {
        if (!candidatePoints.length && hoveredPointIndex !== null) {
          candidatePoints.push({ type: 'point', index: hoveredPointIndex, instance: hoveredInstance });
        }

        if (!candidateLines.length && hoveredLineIndex !== null) {
          candidateLines.push({ type: 'line', index: hoveredLineIndex, instance: hoveredInstance });
        }
      }

      mat4.identity(transformation);
      if (sketch instanceof Sketch) {
        for (const candidate of candidateLines) {
          const line = sketch.getLine(candidate.index);
          if (line) {
            mat4.multiply(transformation, candidate.instance.Placement.inverseTrs, sketch.toSketch);
            movementSelection.push({ ...candidate, sketch, line });
          }
        }

        for (const candidate of candidatePoints) {
          const line = sketch.getLineForPoint(candidate.index);
          if (line && movementSelection.every((el => !(el.type === 'line' && el.line === line[0])))) {
            mat4.multiply(transformation, candidate.instance.Placement.inverseTrs, sketch.toSketch);
            movementSelection.push({ ...candidate, sketch, line: line[0], offset: line[1] });
          }
        }
      } else {
        if (!selectedInstances.length && hoveredInstance) {
          selectedInstances.push(hoveredInstance);
        }

        for (let i = 0; i < selectedInstances.length; ++i) {
          let parent = SubInstance.getParent(selectedInstances[i]);
          while (parent && parent.instance !== enteredInstance) {
            selectedInstances[i] = parent.instance;
            parent = SubInstance.getParent(selectedInstances[i]);
          }

          if (SubInstance.belongsTo(selectedInstances[i], enteredInstance)) {
            movementSelection.push({ type: 'instance', instance: selectedInstances[i] });
          }
        }
      }

      if (!movementSelection.length) return;
      const originalSelection = scene.selection.slice();

      const title = `Move ${
        movementSelection
          .map(el => `${el.type} ${el.type === 'instance' ? `#${el.instance.Id.str}` : `in ${el.sketch.name}`}`)
          .join(', ')
      }`;

      historyAction = history.createAction(title, { selection: movementSelection, translation: vec3.create() }, () => {
        historyAction = undefined;
        scene.setSelection(originalSelection);
        emit('toolinactive', move);
      });
      if (!historyAction) return;

      if (!currentStep && movementSelection.some(({ type }) => type !== 'instance')) scene.setCurrentStep(sketch);

      scene.setSelection(movementSelection.map(selection => ({
        type: selection.type,
        index: selection.type === 'instance' ? selection.instance.Id.int : selection.index,
        instance: selection.instance,
      })));

      vec3.transformMat4(origin, scene.hovered, transformation);
      emit('toolactive', move);

      historyAction.append(
        ({ selection, translation }) => {
          for (const selectionElement of selection) {
            switch (selectionElement.type) {
              case 'instance':
                selectionElement.instance.translateGlobal(translation);
                break;
              case 'line':
                Placement.toLocalRelativeCoords(diff, translation, transformation);
                selectionElement.line.data[0] += diff[0];
                selectionElement.line.data[1] += diff[1];
                selectionElement.line.data[2] += diff[0];
                selectionElement.line.data[3] += diff[1];
                selectionElement.sketch.update();
                break;
              case 'point':
                Placement.toLocalRelativeCoords(diff, translation, transformation);
                selectionElement.line.data[0 + selectionElement.offset] += diff[0];
                selectionElement.line.data[1 + selectionElement.offset] += diff[1];
                selectionElement.sketch.update();
                break;
            }
          }
          emit('scenechange');
        },
        ({ selection, translation }) => {
          const translationVecReverse = vec3.create();
          vec3.scale(translationVecReverse, translation, -1);
          for (const selectionElement of selection) {
            switch (selectionElement.type) {
              case 'instance':
                selectionElement.instance.translateGlobal(translationVecReverse);
                break;
              case 'line':
                Placement.toLocalRelativeCoords(diff, translation, transformation);
                selectionElement.line.data[0] -= diff[0];
                selectionElement.line.data[1] -= diff[1];
                selectionElement.line.data[2] -= diff[0];
                selectionElement.line.data[3] -= diff[1];
                selectionElement.sketch.update();
                break;
              case 'point':
                Placement.toLocalRelativeCoords(diff, translation, transformation);
                selectionElement.line.data[0 + selectionElement.offset] -= diff[0];
                selectionElement.line.data[1 + selectionElement.offset] -= diff[1];
                selectionElement.sketch.update();
                break;
            }
          }
          emit('scenechange');
        },
      );
    },
    update() {
      if (!historyAction) return;

      const { selection, translation } = historyAction.data;

      const old = vec3.clone(translation);
      vec3.transformMat4(diff, scene.hovered, transformation);
      vec3.subtract(translation, diff, origin);
      vec3.subtract(diff, translation, old);

      for (const selectionElement of selection) {
        switch (selectionElement.type) {
          case 'instance':
            selectionElement.instance.translateGlobal(diff);
            break;
          case 'line':
            Placement.toLocalRelativeCoords(diff, diff, transformation);
            selectionElement.line.data[0] += diff[0];
            selectionElement.line.data[1] += diff[1];
            selectionElement.line.data[2] += diff[0];
            selectionElement.line.data[3] += diff[1];
            selectionElement.sketch.update();
            break;
          case 'point':
            Placement.toLocalRelativeCoords(diff, diff, transformation);
            selectionElement.line.data[0 + selectionElement.offset] += diff[0];
            selectionElement.line.data[1 + selectionElement.offset] += diff[1];
            selectionElement.sketch.update();
            break;
        }
      }

      emit('scenechange');
    },
    end() {
      const tooShort = !released && !this.distance?.every(v => v >= 0.1);
      released = true;
      if (tooShort) return;

      historyAction?.commit();
    },
    abort() {
      if (engine.tools.selected?.type === 'orbit') return;

      historyAction?.discard();
    },
  };

  return move;
};
