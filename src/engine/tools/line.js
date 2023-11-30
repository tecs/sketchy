/** @type {(engine: Engine) => Tool} */
export default (engine) => {
  const { driver: { UintIndexArray }, math: { vec3 }, scene } = engine;

  // cached structures
  const origin = vec3.create();
  const coord = vec3.create();

  /** @type {Tool} */
  const line = {
    type: 'line',
    name: 'Line/Arc',
    shortcut: 'l',
    icon: '🖊',
    cursor: 'crosshair',
    active: false,
    start() {
      if (this.active) return;
      vec3.copy(origin, scene.hoveredGlobal);
      this.active = true;

      const model = scene.currentModelWithRoot;

      const vertices = new Float32Array(6);
      vertices.set(origin);
      vertices.set(origin, 3);
      model.appendBufferData(vertices, 'lineVertex');
      model.appendBufferData(new UintIndexArray([0, 1]), 'lineIndex');
    },
    update() {
      if (!this.active) return;

      const model = scene.currentModelWithRoot;

      vec3.multiply(coord, scene.axisNormal, model.data.lineVertex);
      vec3.add(coord, coord, scene.hoveredGlobal);

      model.updateBufferEnd(coord, 'lineVertex');

      engine.emit('scenechange');
    },
    end() {
      if (!this.active || vec3.distance(origin, scene.hoveredGlobal) < 0.1) return;
      vec3.copy(origin, scene.hoveredGlobal);

      const model = scene.currentModelWithRoot;

      const vertices = new Float32Array(6);
      vertices.set(model.data.lineVertex.slice(-3));
      vertices.set(origin, 3);
      model.appendBufferData(vertices, 'lineVertex');
      model.appendBufferData(new UintIndexArray([0, 1]), 'lineIndex');
    },
    abort() {
      if (!this.active || engine.tools.selected.type === 'orbit') return;

      const model = scene.currentModelWithRoot;

      model.truncateBuffer('lineVertex', 6);
      model.truncateBuffer('lineIndex', 2);

      this.active = false;
      engine.emit('scenechange');
    },
  };

  return line;
};
