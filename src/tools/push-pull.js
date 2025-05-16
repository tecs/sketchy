import PushPull from "../engine/cad/push-pull.js";

const { vec3 } = glMatrix;

/** @typedef {Tool<"distance">} PullTool */

/**
 * @typedef PushPullAction
 * @property {PushPull?} step
 * @property {PushPull["data"]?} originalData
 * @property {ReadonlyVec3} origin
 * @property {vec3} target
 * @property {vec3} normalMask
 * @property {boolean} reverse
 */

// cached structures
const tempVec3 = vec3.create();

/** @type {(engine: Engine) => PullTool} */
export default (engine) => {
  const {
    editor: { selection, edited },
    history,
    scene,
    tools,
    emit,
    on,
  } = engine;
  /** @type {import("../engine/history.js").HistoryAction<PushPullAction>|undefined} */
  let historyAction;
  let released = true;

  /** @type {PullTool} */
  const pushPull = {
    type: 'push-pull',
    name: 'Push/Pull',
    shortcut: 'p',
    icon: 'pull',
    cursor: 'action-pull',
    get active() {
      return !!historyAction;
    },
    get value() {
      return historyAction?.data.step?.data.distance;
    },
    valueType: 'distance',
    setValue(distance) {
      if (!historyAction?.data.step) return;
      const { step } = historyAction.data;
      historyAction.data.reverse = distance < 0;
      step.data.reverse = historyAction.data.reverse;
      step.data.distance = Math.abs(distance);
      step.recompute();

      this.end();
    },
    start() {
      released = false;

      const { enteredInstance, hoveredFaceId } = scene;

      const originalSelection = selection.elements.slice();

      const faceId = originalSelection
        .filter(({ instance, type }) => instance === enteredInstance && type === 'face')
        .map(({ id }) => id).at(0) ?? hoveredFaceId;

      if (!enteredInstance || faceId === null) return;

      const { body } = enteredInstance;
      const step = body.step instanceof PushPull && body.step.newFaceId === faceId ? body.step : null;
      const origin = vec3.clone(scene.hovered);
      const target = vec3.clone(scene.hovered);

      if (step) vec3.scaleAndAdd(origin, origin, step.normal, step.data.distance * (step.data.reverse ? 1 : -1));

      historyAction = history.createAction(`Pull face #${faceId} in "${body.name}"`, {
        step,
        originalData: step ? { ...step.data } : null,
        origin,
        target,
        normalMask: vec3.create(),
        reverse: step?.data.reverse ?? false,
      }, () => {
        historyAction = undefined;
        selection.set(originalSelection);
        edited.clear();
        emit('toolinactive', pushPull);
        emit('cursorchange', pushPull.cursor);
      });
      if (!historyAction) return;

      emit('toolactive', pushPull);
      emit('cursorchange', 'pull');

      selection.clear();
      edited.set({ id: enteredInstance.Id.int, type: 'instance', instance: enteredInstance });

      historyAction.append(
        (data) => {
          if (!data.step) {
            const distance = vec3.distance(data.origin, data.target);
            data.step = body.createStep(PushPull, { distance, faceId, reverse: data.reverse });
          }

          const { normal } = data.step;
          vec3.set(data.normalMask, Math.abs(normal[0]), Math.abs(normal[1]), Math.abs(normal[2]));

          if (data.originalData) {
            vec3.subtract(tempVec3, target, origin);
            vec3.multiply(tempVec3, tempVec3, data.normalMask);
            data.step.data.distance = vec3.length(tempVec3);
            data.step.data.reverse = data.reverse;
            data.step.recompute();
          }
        },
        (data) => {
          if (!data.step) return;

          if (data.originalData) {
            data.step.data.distance = data.originalData.distance;
            data.step.data.reverse = data.originalData.reverse;
            data.step.recompute();
          } else {
            body.removeStep(data.step);
            data.step = null;
          }
        },
      );
    },
    update() {
      if (!historyAction) return;

      const { data: { target, origin, normalMask, step } } = historyAction;
      if (!step) return;

      vec3.copy(target, scene.hovered);
      vec3.subtract(tempVec3, target, origin);
      vec3.multiply(tempVec3, tempVec3, normalMask);
      historyAction.data.reverse = vec3.dot(tempVec3, step.normal) < 0;
      step.data.reverse = historyAction.data.reverse;
      step.data.distance = vec3.length(tempVec3);
      step.recompute();
    },
    end() {
      const { value } = this;
      const originalDistance = historyAction?.data.originalData?.distance ?? 0;
      const tooShort = !released && (!value || Math.abs(value - originalDistance) < 0.1);
      released = true;
      if (tooShort) return;

      historyAction?.commit();
    },
    abort() {
      if (tools.selected?.type === 'orbit') return;

      historyAction?.discard();
    },
  };

  on('stepchange', (current, previous) => {
    if (current !== scene.currentStep) return;
    if (current && !previous) tools.disable(pushPull);
    else if (!current && previous) tools.enable(pushPull);
  });

  return pushPull;
};
