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
   * @property {Sketch} sketch
   */

  /**
   * @typedef PointSelection
   * @property {"point"} type
   * @property {import("../engine/cad/sketch.js").LineConstructionElement} line
   * @property {number} offset
   * @property {Sketch} sketch
   */

  /** @typedef {InstanceSelection | LineSelection | PointSelection} Selection */

  /**
   * @typedef MoveData
   * @property {Selection} selection
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

      switch (selection.type) {
        case 'instance':
          selection.instance.translateGlobal(diff);
          break;
        case 'line':
          Placement.toLocalRelativeCoords(diff, translation, transformation);
          selection.line.data[0] += diff[0];
          selection.line.data[1] += diff[1];
          selection.line.data[2] += diff[0];
          selection.line.data[3] += diff[1];
          selection.sketch.update();
          break;
        case 'point':
          Placement.toLocalRelativeCoords(diff, translation, transformation);
          selection.line.data[0 + selection.offset] += diff[0];
          selection.line.data[1 + selection.offset] += diff[1];
          selection.sketch.update();
          break;
      }

      this.end();
      emit('scenechange');
    },
    start() {
      released = false;
      const { selectedInstance, hoveredInstance, enteredInstance } = scene;

      const sketch = scene.currentStep ?? enteredInstance?.body.step ?? null;
      let movementSelection = /** @type {Selection | null} */ (null);

      const candidatePointIndex = scene.selectedPointIndex ?? (selectedInstance ? null : scene.hoveredPointIndex);
      const candidateLineIndex = scene.selectedLineIndex ?? (selectedInstance ? null : scene.hoveredLineIndex);

      mat4.identity(transformation);
      if (sketch instanceof Sketch && candidatePointIndex !== null) {
        const line = sketch.getLineForPoint(candidatePointIndex);
        if (line) {
          const instance = scene.currentStep?.body.instances[0] ?? enteredInstance;
          mat4.multiply(transformation, instance?.Placement.inverseTrs ?? mat4.create(), sketch.toSketch);
          movementSelection = { type: 'point', sketch, line: line[0], offset: line[1] };
        }
      } else if (sketch instanceof Sketch && candidateLineIndex !== null) {
        const line = sketch.getLine(candidateLineIndex);
        if (line) {
          const instance = scene.currentStep?.body.instances[0] ?? enteredInstance;
          mat4.multiply(transformation, instance?.Placement.inverseTrs ?? mat4.create(), sketch.toSketch);
          movementSelection = { type: 'line', sketch, line };
        }
      } else {
        let candidateInstance = selectedInstance ?? hoveredInstance;
        let parent = candidateInstance ? SubInstance.getParent(candidateInstance) : undefined;
        while (parent && parent.instance !== enteredInstance) {
          candidateInstance = parent.instance;
          parent = SubInstance.getParent(candidateInstance);
        }

        if (candidateInstance && SubInstance.belongsTo(candidateInstance, enteredInstance)) {
          movementSelection = { type: 'instance', instance: candidateInstance };
        }
      }

      if (!movementSelection) return;

      if (movementSelection.type !== 'instance' && !scene.currentStep) scene.setCurrentStep(sketch);

      const title = `Move ${movementSelection.type} ${movementSelection.type === 'instance' ?
        `#${movementSelection.instance.Id.str}` :
        `in ${movementSelection.sketch.name}`
      }`;

      historyAction = history.createAction(title, { selection: movementSelection, translation: vec3.create() }, () => {
        historyAction = undefined;
        emit('toolinactive', move);
      });
      if (!historyAction) return;

      vec3.transformMat4(origin, scene.hovered, transformation);
      emit('toolactive', move);

      historyAction.append(
        ({ selection, translation }) => {
          switch (selection.type) {
            case 'instance':
              selection.instance.translateGlobal(translation);
              break;
            case 'line':
              Placement.toLocalRelativeCoords(diff, translation, transformation);
              selection.line.data[0] += diff[0];
              selection.line.data[1] += diff[1];
              selection.line.data[2] += diff[0];
              selection.line.data[3] += diff[1];
              selection.sketch.update();
              break;
            case 'point':
              Placement.toLocalRelativeCoords(diff, translation, transformation);
              selection.line.data[0 + selection.offset] += diff[0];
              selection.line.data[1 + selection.offset] += diff[1];
              selection.sketch.update();
              break;
          }
          emit('scenechange');
        },
        ({ selection, translation }) => {
          const translationVecReverse = vec3.create();
          vec3.scale(translationVecReverse, translation, -1);
          switch (selection.type) {
            case 'instance':
              selection.instance.translateGlobal(translationVecReverse);
              break;
            case 'line':
              Placement.toLocalRelativeCoords(diff, translation, transformation);
              selection.line.data[0] -= diff[0];
              selection.line.data[1] -= diff[1];
              selection.line.data[2] -= diff[0];
              selection.line.data[3] -= diff[1];
              selection.sketch.update();
              break;
            case 'point':
              Placement.toLocalRelativeCoords(diff, translation, transformation);
              selection.line.data[0 + selection.offset] -= diff[0];
              selection.line.data[1 + selection.offset] -= diff[1];
              selection.sketch.update();
              break;
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
      switch (selection.type) {
        case 'instance':
          selection.instance.translateGlobal(diff);
          break;
        case 'line':
          Placement.toLocalRelativeCoords(diff, diff, transformation);
          selection.line.data[0] += diff[0];
          selection.line.data[1] += diff[1];
          selection.line.data[2] += diff[0];
          selection.line.data[3] += diff[1];
          selection.sketch.update();
          break;
        case 'point':
          Placement.toLocalRelativeCoords(diff, diff, transformation);
          selection.line.data[0 + selection.offset] += diff[0];
          selection.line.data[1 + selection.offset] += diff[1];
          selection.sketch.update();
          break;
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
