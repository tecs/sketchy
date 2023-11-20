/** @type {(engine: Engine) => Tool} */
export default (engine) => {
  const { scene, math: { vec3 } } = engine;

  /** @type {Instance | null} */
  let instance = null;
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
      if (instance) return;

      const { selectedInstance, hoveredInstance, currentInstance, rootInstance } = scene;

      const candidateInstance = selectedInstance ?? hoveredInstance;
      if (!candidateInstance) return;

      if (!candidateInstance.belongsTo(currentInstance ?? rootInstance)) return;

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

      instance = null;
    },
    abort() {
      if (engine.tools.selected.type === 'orbit' || !instance) return;

      instance.translateGlobal(translation);
      instance = null;
      engine.emit('scenechange');
    },
  };

  return move;
};
