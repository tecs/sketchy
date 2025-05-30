import Placement from '../engine/3d/placement.js';
import Sketch from '../engine/cad/sketch.js';
import SubInstance from '../engine/cad/subinstance.js';

const { vec3, mat4 } = glMatrix;

/** @typedef {Tool<"distance">} MoveTool */

/** @type {(engine: Engine) => MoveTool} */
export default (engine) => {
  const {
    editor: { edited: active, selection },
    scene,
    tools,
    history,
    emit,
    on,
  } = engine;

  /**
   * @typedef InstanceElement
   * @property {"instance"} type
   * @property {Instance} instance
   */

  /**
   * @typedef LineElement
   * @property {"line"} type
   * @property {import("../engine/cad/sketch.js").LineConstructionElement} line
   * @property {number} id
   * @property {Instance} instance
   * @property {Sketch} sketch
   */

  /**
   * @typedef PointElement
   * @property {"point"} type
   * @property {import("../engine/cad/sketch.js").LineConstructionElement} line
   * @property {number} offset
   * @property {number} id
   * @property {Instance} instance
   * @property {Sketch} sketch
   */

  /** @typedef {import("../engine/cad/sketch.js").Constraints} Constraints */

  /**
   * @typedef ConstraintElement
   * @property {"constraint"} type
   * @property {Find<Constraints, "type", "distance" | "width" | "height" | "angle">} constraint
   * @property {number} id
   * @property {Instance} instance
   * @property {Sketch} sketch
   */

  /** @typedef {InstanceElement | LineElement | PointElement | ConstraintElement} Elements */

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
  const alignedHovered = vec3.create();

  /** @type {MoveTool} */
  const move = {
    type: 'move',
    name: 'Move',
    shortcut: 'm',
    icon: 'translate',
    cursor: 'action-translate',
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
          case 'constraint':
            element.constraint.labelOffset[0] += diff[0];
            element.constraint.labelOffset[1] += diff[1];
        }
      }

      this.end();
      emit('scenechange');
    },
    start() {
      released = false;
      const {
        currentStep,
        enteredInstance,
        hoveredInstance,
        hoveredPointId,
        hoveredLineId,
        hoveredConstraintIndex,
      } = scene;

      const sketch = currentStep ?? enteredInstance?.body.step ?? null;
      const movementSelection = /** @type {Elements[]} */ ([]);

      const selectedInstances = selection.getByType('instance').map(({ instance }) => instance);
      const candidatePoints = selection.getByType('point');
      const candidateLines = selection.getByType('line');
      const candidateConstraints = selection.getByType('constraint');

      if (!selectedInstances.length && hoveredInstance === enteredInstance && hoveredInstance) {
        if (!candidatePoints.length && hoveredPointId !== null) {
          candidatePoints.push({ type: 'point', id: hoveredPointId, instance: hoveredInstance });
        }

        if (!candidateLines.length && hoveredLineId !== null) {
          candidateLines.push({ type: 'line', id: hoveredLineId, instance: hoveredInstance });
        }
      }

      mat4.identity(transformation);
      const pointIndices = /** @type {number[]} */ ([]);
      if (sketch instanceof Sketch) {
        for (const candidate of candidateLines) {
          const line = sketch.getLine(candidate.id);
          if (!line) continue;

          mat4.multiply(transformation, candidate.instance.Placement.inverseTrs, sketch.toSketch);
          movementSelection.push({ ...candidate, sketch, line });
          pointIndices.push(...sketch.getPoints(line).map(({ id }) => id));
        }

        for (const candidate of candidatePoints) {
          if (pointIndices.includes(candidate.id)) continue;

          const line = sketch.getLineForPoint(candidate.id);
          if (!line) continue;

          mat4.multiply(transformation, candidate.instance.Placement.inverseTrs, sketch.toSketch);
          movementSelection.push({ ...candidate, sketch, line: line[0], offset: line[1] });
          pointIndices.push(candidate.id);
        }

        if (candidateConstraints.length === 0 && enteredInstance && hoveredConstraintIndex !== null) {
          candidateConstraints.push({ type: 'constraint', id: hoveredConstraintIndex, instance: enteredInstance });
        }

        if (movementSelection.length === 0) {
          for (const candidate of candidateConstraints) {
            const constraint = sketch.getConstraint(candidate.id);
            if (!constraint) continue;

            switch (constraint.type) {
              case 'distance':
              case 'width':
              case 'height':
              case 'angle':
                mat4.multiply(transformation, candidate.instance.Placement.inverseTrs, sketch.toSketch);
                movementSelection.push({ ...candidate, sketch, constraint });
            }
          }
        }
      } else {
        if (!selectedInstances.length && hoveredInstance) {
          selectedInstances.push(hoveredInstance);
        }

        for (const selectedInstance of selectedInstances) {
          const instance = SubInstance.asDirectChildOf(selectedInstance, enteredInstance);
          if (instance) movementSelection.push({ type: 'instance', instance });
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
        emit('cursorchange', move.cursor);
      });
      if (!historyAction) return;

      selection.set(movementSelection.map(element => ({
        type: element.type,
        id: element.type === 'instance' ? element.instance.Id.int : element.id,
        instance: element.instance,
      })));

      active.set(selection.elements);

      vec3.copy(origin, scene.hovered);
      emit('toolactive', move);
      emit('cursorchange', 'translate');

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
              case 'constraint':
                element.constraint.labelOffset[0] += diff[0];
                element.constraint.labelOffset[1] += diff[1];
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
              case 'constraint':
                element.constraint.labelOffset[0] -= diff[0];
                element.constraint.labelOffset[1] -= diff[1];
            }
          }
          emit('scenechange');
        },
      );
    },
    update() {
      if (!historyAction) return;

      const { elements, translation, lockedIndices } = historyAction.data;

      if (scene.axisAlignedNormal) {
        alignedHovered[0] = scene.axisAlignedNormal[0] ? scene.hovered[0] : origin[0];
        alignedHovered[1] = scene.axisAlignedNormal[1] ? scene.hovered[1] : origin[1];
        alignedHovered[2] = scene.axisAlignedNormal[2] ? scene.hovered[2] : origin[2];
      } else {
        vec3.copy(alignedHovered, scene.hovered);
      }
      vec3.subtract(diff, alignedHovered, origin);
      vec3.subtract(diff, diff, translation);
      vec3.subtract(translation, alignedHovered, origin);
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
          case 'constraint':
            element.constraint.labelOffset[0] += diff[0];
            element.constraint.labelOffset[1] += diff[1];
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
      if (tools.selected?.type === 'orbit') return;

      historyAction?.discard();
    },
  };

  /**
   * @param {Readonly<import("../engine/cad/body.js").AnyStep>?} tool
   * @returns {boolean}
   */
  const shouldShow = (tool) => !tool || tool instanceof Sketch;

  on('stepchange', (current, previous) => {
    if (current !== scene.currentStep) return;
    if (!shouldShow(current) && shouldShow(previous)) tools.disable(move);
    else if (shouldShow(current) && !shouldShow(previous)) tools.enable(move);
  });

  return move;
};
