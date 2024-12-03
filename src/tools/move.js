import Placement from '../engine/3d/placement.js';
import Sketch from '../engine/cad/sketch.js';
import SubInstance from '../engine/cad/subinstance.js';

const { vec3, mat4 } = glMatrix;

/** @typedef {Tool<"distance">} MoveTool */

/** @type {(engine: Engine) => MoveTool} */
export default (engine) => {
  const { editor: { edited: active, selection }, scene, history, emit } = engine;

  /**
   * @typedef InstanceElement
   * @property {"instance"} type
   * @property {Instance} instance
   */

  /**
   * @typedef LineElement
   * @property {"line"} type
   * @property {import("../engine/cad/sketch.js").LineConstructionElement} line
   * @property {number} index
   * @property {Instance} instance
   * @property {Sketch} sketch
   */

  /**
   * @typedef PointElement
   * @property {"point"} type
   * @property {import("../engine/cad/sketch.js").LineConstructionElement} line
   * @property {number} offset
   * @property {number} index
   * @property {Instance} instance
   * @property {Sketch} sketch
   */

  /** @typedef {InstanceElement | LineElement | PointElement} Elements */

  /**
   * @typedef MoveData
   * @property {Elements[]} elements
   * @property {vec3} translation
   * @property {number[]} lockedIndices
   */

  /** @type {import("../engine/history.js").HistoryAction<MoveData>|undefined} */
  let historyAction;
  let released = true;

  // cached structures
  const transformation = mat4.create();
  const origin = vec3.create();
  const diff = vec3.create();

  /** @type {MoveTool} */
  const move = {
    type: 'move',
    name: 'Move',
    shortcut: 'm',
    icon: '🕀',
    cursor: 'move',
    get active() {
      return !!historyAction;
    },
    get value() {
      return historyAction ? vec3.length(historyAction.data.translation) : undefined;
    },
    valueType: 'distance',
    setValue(distance) {
      if (!historyAction) return;

      const { elements, translation, lockedIndices } = historyAction.data;

      vec3.copy(diff, translation);
      vec3.normalize(translation, translation);
      vec3.scale(translation, translation, distance);
      vec3.subtract(diff, translation, diff);
      Placement.toRelativeCords(diff, translation, transformation);

      for (const element of elements) {
        switch (element.type) {
          case 'instance':
            element.instance.translate(diff);
            break;
          case 'line':
            element.line.data[0] += diff[0];
            element.line.data[1] += diff[1];
            element.line.data[2] += diff[0];
            element.line.data[3] += diff[1];
            element.sketch.update(lockedIndices);
            break;
          case 'point':
            element.line.data[0 + element.offset] += diff[0];
            element.line.data[1 + element.offset] += diff[1];
            element.sketch.update(lockedIndices);
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
      const movementSelection = /** @type {Elements[]} */ ([]);

      const selectedInstances = selection.getByType('instance').map(({ instance }) => instance);
      const candidatePoints = selection.getByType('point');
      const candidateLines = selection.getByType('line');

      if (!selectedInstances.length && hoveredInstance === enteredInstance && hoveredInstance) {
        if (!candidatePoints.length && hoveredPointIndex !== null) {
          candidatePoints.push({ type: 'point', index: hoveredPointIndex, instance: hoveredInstance });
        }

        if (!candidateLines.length && hoveredLineIndex !== null) {
          candidateLines.push({ type: 'line', index: hoveredLineIndex, instance: hoveredInstance });
        }
      }

      mat4.identity(transformation);
      const pointIndices = /** @type {number[]} */ ([]);
      if (sketch instanceof Sketch) {
        for (const candidate of candidateLines) {
          const line = sketch.getLine(candidate.index);
          if (!line) continue;

          mat4.multiply(transformation, candidate.instance.Placement.inverseTrs, sketch.toSketch);
          movementSelection.push({ ...candidate, sketch, line });
          pointIndices.push(...sketch.getPoints(line).map(({ index }) => index));
        }

        for (const candidate of candidatePoints) {
          if (pointIndices.includes(candidate.index)) continue;

          const line = sketch.getLineForPoint(candidate.index);
          if (!line) continue;

          mat4.multiply(transformation, candidate.instance.Placement.inverseTrs, sketch.toSketch);
          movementSelection.push({ ...candidate, sketch, line: line[0], offset: line[1] });
          pointIndices.push(candidate.index);
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
      const originalSelection = selection.elements.slice();

      const title = `Move ${
        movementSelection
          .map(el => `${el.type} ${el.type === 'instance' ? `#${el.instance.Id.str}` : `in ${el.sketch.name}`}`)
          .join(', ')
      }`;

      if (!currentStep && movementSelection.some(({ type }) => type !== 'instance')) scene.setCurrentStep(sketch);

      historyAction = history.createAction(title, {
        elements: movementSelection,
        translation: vec3.create(),
        lockedIndices: pointIndices,
      }, () => {
        historyAction = undefined;
        selection.set(originalSelection);
        active.clear();
        emit('toolinactive', move);
      });
      if (!historyAction) return;

      selection.set(movementSelection.map(element => ({
        type: element.type,
        index: element.type === 'instance' ? element.instance.Id.int : element.index,
        instance: element.instance,
      })));

      active.set(selection.elements);

      vec3.copy(origin, scene.hovered);
      emit('toolactive', move);

      historyAction.append(
        ({ elements, translation, lockedIndices }) => {
          Placement.toRelativeCords(diff, translation, transformation);
          for (const element of elements) {
            switch (element.type) {
              case 'instance':
                element.instance.translate(translation);
                break;
              case 'line':
                element.line.data[0] += diff[0];
                element.line.data[1] += diff[1];
                element.line.data[2] += diff[0];
                element.line.data[3] += diff[1];
                element.sketch.update(lockedIndices);
                break;
              case 'point':
                element.line.data[0 + element.offset] += diff[0];
                element.line.data[1 + element.offset] += diff[1];
                element.sketch.update(lockedIndices);
                break;
            }
          }
          emit('scenechange');
        },
        ({ elements, translation, lockedIndices }) => {
          const translationVecReverse = vec3.create();
          vec3.negate(translationVecReverse, translation);
          Placement.toRelativeCords(diff, translation, transformation);
          for (const element of elements) {
            switch (element.type) {
              case 'instance':
                element.instance.translate(translationVecReverse);
                break;
              case 'line':
                element.line.data[0] -= diff[0];
                element.line.data[1] -= diff[1];
                element.line.data[2] -= diff[0];
                element.line.data[3] -= diff[1];
                element.sketch.update(lockedIndices);
                break;
              case 'point':
                element.line.data[0 + element.offset] -= diff[0];
                element.line.data[1 + element.offset] -= diff[1];
                element.sketch.update(lockedIndices);
                break;
            }
          }
          emit('scenechange');
        },
      );
    },
    update() {
      if (!historyAction) return;

      const { elements, translation, lockedIndices } = historyAction.data;

      vec3.subtract(diff, scene.hovered, origin);
      vec3.subtract(diff, diff, translation);
      vec3.subtract(translation, scene.hovered, origin);
      Placement.toRelativeCords(diff, diff, transformation);

      for (const element of elements) {
        switch (element.type) {
          case 'instance':
            element.instance.translate(diff);
            break;
          case 'line':
            element.line.data[0] += diff[0];
            element.line.data[1] += diff[1];
            element.line.data[2] += diff[0];
            element.line.data[3] += diff[1];
            element.sketch.update(lockedIndices);
            break;
          case 'point':
            element.line.data[0 + element.offset] += diff[0];
            element.line.data[1 + element.offset] += diff[1];
            element.sketch.update(lockedIndices);
            break;
        }
      }

      emit('scenechange');
    },
    end() {
      const { value } = this;
      const tooShort = !released && (!value || value < 0.1);
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
