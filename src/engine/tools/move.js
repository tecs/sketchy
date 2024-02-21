const { vec3 } = glMatrix;

/** @type {(engine: Engine) => Tool} */
export default (engine) => {
  const { scene, history } = engine;

  /** @type {Instance | null} */
  let instance = null;

  // cached structures
  const origin = vec3.create();
  const diff = vec3.create();
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

      vec3.copy(diff, translation);
      vec3.normalize(translation, translation);
      vec3.scale(translation, translation, distance);
      vec3.subtract(diff, translation, diff);
      instance.translateGlobal(diff);

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

      vec3.copy(diff, translation);
      vec3.subtract(translation, scene.hoveredGlobal, origin);
      vec3.subtract(diff, translation, diff);
      instance.translateGlobal(diff);

      engine.emit('scenechange');
    },
    end() {
      if (!instance || !this.distance?.every(v => v >= 0.1)) return;

      const translationInstance = instance;
      const translationVec = vec3.clone(translation);

      history.push({
        name: `Move instance #${translationInstance.id.int}`,
        skip: true,
        execute() {
          translationInstance.translateGlobal(translationVec);
          engine.emit('scenechange');
        },
        revert() {
          const translationVecReverse = vec3.create();
          vec3.scale(translationVecReverse, translationVec, -1);
          translationInstance.translateGlobal(translationVecReverse);
          engine.emit('scenechange');
        },
      });

      this.active = false;
      instance = null;
      engine.emit('toolinactive', move);
    },
    abort() {
      if (engine.tools.selected.type === 'orbit' || !instance) return;

      history.unlock();
      vec3.scale(translation, translation, -1);
      instance.translateGlobal(translation);
      instance = null;

      this.active = false;
      engine.emit('toolinactive', move);
      engine.emit('scenechange');
    },
  };

  return move;
};
