/** @type {(engine: Engine) => Tool} */
export default (engine) => {
  const { driver: { UintIndexArray }, math: { vec3 }, state, scene } = engine;

  // cached structures
  const edge1 = vec3.create();
  const edge2 = vec3.create();
  const edge3 = vec3.create();
  const hovered = vec3.create();
  const origin = vec3.create();

  /** @type {Tool} */
  const rectangle = {
    type: 'rectangle',
    name: 'Rectangle/Circle/etc',
    shortcut: 'r',
    icon: '⧄',
    cursor: 'crosshair',
    start() {
      if (state.drawing) return;
      vec3.copy(origin, scene.hoveredGlobal);
      state.setDrawing(true);

      const model = scene.currentModelWithRoot;

      const vertices = new Float32Array(12);
      vertices.set(origin);
      vertices.set(origin, 3);
      vertices.set(origin, 6);
      vertices.set(origin, 9);

      model.appendBufferData(vertices, 'lineVertex');
      model.appendBufferData(new UintIndexArray([0, 1, 1, 2, 2, 3, 3, 0]), 'lineIndex');
      model.appendBufferData(vertices, 'vertex');
      model.appendBufferData(new UintIndexArray([0, 1, 2, 0, 2, 3]), 'index');

      const color = [255, 255, 255];
      const colors = new Uint8Array(12);
      colors.set(color);
      colors.set(color, 3);
      colors.set(color, 6);
      colors.set(color, 9);
      model.appendBufferData(colors, 'color');
      model.appendBufferData(new Float32Array(12), 'normal');
    },
    update() {
      if (!state.drawing) return;

      const model = scene.currentModelWithRoot;

      hovered[0] = 1;
      hovered[1] = 1;
      hovered[2] = 1;

      const vertices = model.data.lineVertex.slice(-12);
      vec3.multiply(edge1, scene.axisNormal, vertices);

      vec3.subtract(hovered, hovered, scene.axisNormal);
      vec3.multiply(hovered, hovered, scene.hoveredGlobal);
      vec3.add(edge1, edge1, hovered);

      vec3.copy(edge2, edge1);
      vec3.copy(edge3, edge1);

      const i1 = scene.axisNormal[0] ? 1 : 0;
      const i2 = i1 ? 2 : scene.axisNormal[1] + 1;

      edge2[i2] = vertices[i2];
      edge3[i1] = vertices[i1];

      vertices.set(edge1, 6);
      vertices.set(edge2, 3);
      vertices.set(edge3, 9);

      model.updateBufferEnd(vertices, 'lineVertex');
      model.updateBufferEnd(vertices, 'vertex');

      const normals = new Float32Array(12);
      normals.set(scene.axisNormal);
      normals.set(scene.axisNormal, 3);
      normals.set(scene.axisNormal, 6);
      normals.set(scene.axisNormal, 9);
      model.updateBufferEnd(normals, 'normal');

      engine.emit('scenechange');
    },
    end() {
      if (!state.drawing || vec3.distance(origin, scene.hoveredGlobal) < 0.1) return;
      vec3.copy(origin, scene.hoveredGlobal);

      state.setDrawing(false);
    },
    abort() {
      if (!state.drawing || engine.tools.selected.type === 'orbit') return;

      const model = scene.currentModelWithRoot;

      model.truncateBuffer('lineVertex', 12);
      model.truncateBuffer('lineIndex', 8);
      model.truncateBuffer('vertex', 12);
      model.truncateBuffer('index', 6);
      model.truncateBuffer('color', 12);
      model.truncateBuffer('normal', 12);

      state.setDrawing(false);
      engine.emit('scenechange');
    },
  };

  return rectangle;
};
