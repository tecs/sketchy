/** @type {(engine: Engine) => Tool} */
export default (engine) => {
  const { driver: { UintIndexArray }, math: { vec3 }, state, scene } = engine;

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
    start() {
      if (state.drawing) return;
      vec3.copy(origin, scene.hoveredGlobal);
      state.setDrawing(true);

      const model = scene.currentModelWithRoot;

      const vertices = new Float32Array(6);
      vertices.set(origin);
      vertices.set(origin, 3);
      model.appendBufferData(vertices, 'lineVertex');
      model.appendBufferData(new UintIndexArray([0, 1]), 'lineIndex');
    },
    update() {
      if (!state.drawing) return;

      const model = scene.currentModelWithRoot;

      vec3.multiply(coord, scene.axisNormal, model.data.lineVertex);
      vec3.add(coord, coord, scene.hoveredGlobal);

      model.updateBufferEnd(coord, 'lineVertex');

      engine.emit('scenechange');
    },
    end() {
      if (!state.drawing || vec3.distance(origin, scene.hoveredGlobal) < 0.1) return;
      vec3.copy(origin, scene.hoveredGlobal);

      const model = scene.currentModelWithRoot;

      const vertices = new Float32Array(6);
      vertices.set(model.data.lineVertex.slice(-3));
      vertices.set(origin, 3);
      model.appendBufferData(vertices, 'lineVertex');
      model.appendBufferData(new UintIndexArray([0, 1]), 'lineIndex');
    },
    abort() {
      if (!state.drawing || engine.tools.selected.type === 'orbit') return;

      const model = scene.currentModelWithRoot;

      model.truncateBuffer('lineVertex', 6);
      model.truncateBuffer('lineIndex', 2);

      state.setDrawing(false);
      engine.emit('scenechange');
    },
  };

  return line;
};
