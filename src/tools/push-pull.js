import PushPull from "../engine/cad/push-pull.js";

const { vec3 } = glMatrix;

/** @typedef {Tool<"distance">} PullTool */

/**
 * @typedef PushPullAction
 * @property {PushPull?} step
 * @property {ReadonlyVec3} origin
 * @property {vec3} target
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
    icon: '↥',
    cursor: 'row-resize',
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
      step.data.reverse = distance < 0;
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

      historyAction = history.createAction(`Pull face #${faceId} in "${body.name}"`, {
        step: null,
        origin: vec3.clone(scene.hovered),
        target: vec3.clone(scene.hovered),
      }, () => {
        historyAction = undefined;
        selection.set(originalSelection);
        edited.clear();
        emit('toolinactive', pushPull);
      });
      if (!historyAction) return;

      emit('toolactive', pushPull);

      selection.clear();
      edited.set({ id: enteredInstance.Id.int, type: 'instance', instance: enteredInstance });

      historyAction.append(
        (data) => {
          const distance = vec3.distance(data.origin, data.target);
          data.step = body.createStep(PushPull, { distance, faceId, reverse: false });
        },
        (data) => {
          if (data.step) {
            body.removeStep(data.step);
            data.step = null;
          }
        },
      );
    },
    update() {
      if (!historyAction) return;

      const { data: { target, origin, step } } = historyAction;
      if (!step) return;

      vec3.copy(target, scene.hovered);
      vec3.subtract(tempVec3, target, origin);
      vec3.multiply(tempVec3, tempVec3, step.normal);
      step.data.reverse = vec3.dot(tempVec3, step.normal) < 0;
      step.data.distance = vec3.length(tempVec3);
      step.recompute();
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

  on('stepchange', (current, previous) => {
    if (current !== scene.currentStep) return;
    if (current && !previous) tools.disable(pushPull);
    else if (!current && previous) tools.enable(pushPull);
  });

  return pushPull;
};
