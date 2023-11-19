/** @type {(engine: Engine) => Tool} */
export default (engine) => {
  const { scene, math: { mat4, vec3 } } = engine;

  let instance = scene.rootInstance;
  const trs = mat4.create();
  const origin = vec3.create();

  /** @type {Tool} */
  const move = {
    type: 'move',
    name: 'Move',
    shortcut: 'm',
    icon: '🕀',
    cursor: 'move',
    start() {
      if (instance.id.int) return;

      const { selectedInstance, hoveredInstance } = scene;
      
      if (!selectedInstance.id.int && !hoveredInstance.id.int) return;
      
      vec3.copy(origin, scene.hoveredGlobal);
      
      instance = selectedInstance.id.int ? selectedInstance : hoveredInstance;
      mat4.copy(trs, instance.globalTrs);
    },
    update() {
      if (!instance.id.int) return;

      const delta = vec3.clone(origin);
      vec3.subtract(delta, scene.hoveredGlobal, delta);

      const translate = mat4.create();
      mat4.fromTranslation(translate, delta);
      mat4.multiply(instance.globalTrs, translate, trs);

      engine.emit('scenechange');
    },
    end() {
      if (!instance.id.int || vec3.distance(origin, scene.hoveredGlobal) < 0.1) return;
      
      instance = scene.rootInstance;
    },
    abort() {
      if (engine.tools.selected.type === 'orbit' || !instance.id.int) return;

      mat4.copy(instance.globalTrs, trs);
      instance = scene.rootInstance;
      engine.emit('scenechange');
    },
  };
  
  return move;
};