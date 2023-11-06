/** @type {(engine: Engine) => Tool} */
export default (engine) => {
  const { driver: { UintIndexArray }, math: { vec3 }, state, scene } = engine;

  /** @type {Tool} */
  const line = {
    type: 'line',
    name: 'Line/Arc',
    shortcut: 'l',
    icon: '🖊',
    cursor: 'crosshair',
    start() {
      if (state.drawing) return;
      state.setHovered(scene.hovered);
      state.setHoveredGlobal(scene.hoveredGlobal);
      state.setDrawing(true);

      const { model } = scene.currentInstance;

      const vertices = new Float32Array(6);
      vertices.set(scene.hoveredGlobal)
      vertices.set(scene.hoveredGlobal, 3);
      model.appendBufferData(vertices, 'lineVertex');
      model.appendBufferData(new UintIndexArray([0, 1]), 'lineIndex');
    },
    update() {
      if (!state.drawing) return;

      const { model } = scene.currentInstance;
      
      const temp = vec3.create();
      vec3.multiply(temp, scene.axisNormal, model.data.lineVertex);
      vec3.add(temp, temp, scene.hoveredGlobal);

      model.updateBufferEnd(temp, 'lineVertex');
    },
    end() {
      if (!state.drawing || vec3.distance(state.hoveredGlobal, scene.hoveredGlobal) < 0.1) return;

      const { model } = scene.currentInstance;
      
      const vertices = new Float32Array(6);
      vertices.set(model.data.lineVertex.slice(-3));
      vertices.set(scene.hoveredGlobal, 3);
      model.appendBufferData(vertices, 'lineVertex');
      model.appendBufferData(new UintIndexArray([0, 1]), 'lineIndex');
    },
    abort() {
      if (!state.drawing || engine.tools.selected.type === 'orbit') return;

      const { model } = scene.currentInstance;

      model.truncateBuffer('lineVertex', 6);
      model.truncateBuffer('lineIndex', 2);

      state.setDrawing(false);
      engine.emit('scenechange');
    },
  };

  return line;
};