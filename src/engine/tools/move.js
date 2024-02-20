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
    active: false,
    get distance() {
      return this.active ? [vec3.length(translation)] : undefined;
    },
    setDistance([distance]) {
      if (!this.active || !instance) return;

      instance.translateGlobal(translation);

      const direction = vec3.create();
      vec3.normalize(direction, translation);
      vec3.scale(translation, direction, -distance);

      instance.translateGlobal(translation);

      vec3.scale(translation, translation, -1);

      this.end();
      engine.emit('scenechange');
    },
    start() {
      if (instance) return;

      const { selectedInstance, hoveredInstance, currentInstance } = scene;

      const candidateInstance = selectedInstance ?? hoveredInstance;
      if (!candidateInstance) return;

      if (!candidateInstance.belongsTo(currentInstance) || this.active || !history.lock()) return;
      this.active = true;
      engine.emit('toolactive', move);

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
      if (!instance || !this.distance?.every(v => v >= 0.1)) return;

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

      this.active = false;
      engine.emit('toolinactive', move);
      instance = null;
    },
    abort() {
      if (engine.tools.selected.type === 'orbit' || !instance) return;

      history.unlock();
      instance.translateGlobal(translation);
      instance = null;

      this.active = false;
      engine.emit('toolinactive', move);
      engine.emit('scenechange');
    },
  };

  return move;
};
