const { vec3 } = glMatrix;

/** @type {(engine: Engine) => Tool} */
export default (engine) => {
  const { scene, history } = engine;

  /** @type {Instance | null} */
  let instance = null;

  // cached structures
  const origin = vec3.create();
  const translation = vec3.create();

  /** @type {Tool} */
  const move = {
    type: 'move',
    name: 'Move',
    shortcut: 'm',
    icon: '🕀',
    cursor: 'move',
    start() {
      if (instance || !history.lock()) return;

      const { selectedInstance, hoveredInstance, currentInstance } = scene;

      const candidateInstance = selectedInstance ?? hoveredInstance;
      if (!candidateInstance) return;

      if (!candidateInstance.belongsTo(currentInstance)) return;

      vec3.copy(origin, scene.hoveredGlobal);
      vec3.zero(translation);

      instance = candidateInstance;
    },
    update() {
      if (!instance) return;

      vec3.subtract(origin, scene.hoveredGlobal, origin);
      vec3.subtract(translation, translation, origin);

      instance.translateGlobal(origin);

      vec3.copy(origin, scene.hoveredGlobal);

      engine.emit('scenechange');
    },
    end() {
      if (!instance || vec3.length(translation) < 0.1) return;

      const translationInstance = instance;
      const translationRevert = vec3.clone(translation);
      const translationForward = vec3.clone(translation);
      vec3.scale(translationForward, translationForward, -1);

      history.push({
        name: `Move instance #${translationInstance.id.int}`,
        skip: true,
        execute() {
          translationInstance?.translateGlobal(translationForward);
          engine.emit('scenechange');
        },
        revert() {
          translationInstance?.translateGlobal(translationRevert);
          engine.emit('scenechange');
        },
      });
      instance = null;
    },
    abort() {
      if (engine.tools.selected.type === 'orbit' || !instance) return;

      history.unlock();
      instance.translateGlobal(translation);
      instance = null;
      engine.emit('scenechange');
    },
  };

  return move;
};
