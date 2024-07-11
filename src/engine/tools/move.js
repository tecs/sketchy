const { vec3 } = glMatrix;

/** @type {(engine: Engine) => Tool} */
export default (engine) => {
  const { scene, history, emit } = engine;

  /**
   * @typedef MoveData
   * @property {Instance} instance
   * @property {vec3} translation
   */

  /** @type {import("../history").HistoryAction<MoveData>|undefined} */
  let historyAction;

  // cached structures
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

      const { instance, translation } = historyAction.data;

      vec3.copy(diff, translation);
      vec3.normalize(translation, translation);
      vec3.scale(translation, translation, distance);
      vec3.subtract(diff, translation, diff);
      instance.translateGlobal(diff);

      this.end();
      emit('scenechange');
    },
    start() {
      const { selectedInstance, hoveredInstance, currentInstance } = scene;

      let candidateInstance = selectedInstance ?? hoveredInstance;
      while (candidateInstance?.parent && candidateInstance.parent.instance !== currentInstance) {
        candidateInstance = candidateInstance.parent.instance;
      }

      if (!candidateInstance?.belongsTo(currentInstance)) return;

      historyAction = history.createAction(`Move instance #${candidateInstance.Id.int}`, {
        instance: candidateInstance,
        translation: vec3.create(),
      }, () => {
        historyAction = undefined;
        emit('toolinactive', move);
      });
      if (!historyAction) return;

      vec3.copy(origin, scene.hovered);
      emit('toolactive', move);

      historyAction.append(
        ({ instance, translation }) => {
          instance.translateGlobal(translation);
          emit('scenechange');
        },
        ({ instance, translation }) => {
          const translationVecReverse = vec3.create();
          vec3.scale(translationVecReverse, translation, -1);
          instance.translateGlobal(translationVecReverse);
          emit('scenechange');
        },
      );
    },
    update() {
      if (!historyAction) return;

      const { instance, translation } = historyAction.data;

      vec3.copy(diff, translation);
      vec3.subtract(translation, scene.hovered, origin);
      vec3.subtract(diff, translation, diff);
      instance.translateGlobal(diff);

      emit('scenechange');
    },
    end() {
      if (!this.distance?.every(v => v >= 0.1)) return;

      historyAction?.commit();
    },
    abort() {
      if (engine.tools.selected.type === 'orbit') return;

      historyAction?.discard();
    },
  };

  return move;
};
