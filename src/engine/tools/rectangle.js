const { vec3 } = glMatrix;

/** @type {(engine: Engine) => Tool} */
export default (engine) => {
  const { driver: { UintIndexArray }, history, scene } = engine;

  /**
   * @typedef RectData
   * @property {Model} model
   * @property {Float32Array} vertices
   * @property {Float32Array} normals
   */

  /** @type {import("../history").HistoryAction<RectData>|undefined} */
  let historyAction;

  // cached structures
  const edge1 = vec3.create();
  const edge2 = vec3.create();
  const edge3 = vec3.create();
  const hovered = vec3.create();
  const lineIndex = new UintIndexArray([0, 1, 1, 2, 2, 3, 3, 0]);
  const index = new UintIndexArray([0, 1, 2, 0, 2, 3]);
  const colors = new Uint8Array([255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255]);

  /** @type {Tool} */
  const rectangle = {
    type: 'rectangle',
    name: 'Rectangle/Circle/etc',
    shortcut: 'r',
    icon: '⧄',
    cursor: 'crosshair',
    get active() {
      return !!historyAction;
    },
    get distance() {
      if (!historyAction) return undefined;

      const { vertices } = historyAction.data;

      const v2 = vertices.subarray(3, 6);
      const v3 = vertices.subarray(9);
      return [vec3.distance(vertices, v2), vec3.distance(vertices, v3)];
    },
    setDistance([d1, d2]) {
      if (!historyAction) return;

      const { model, vertices } = historyAction.data;

      const v2 = vertices.subarray(3, 6);
      const v3 = vertices.subarray(9);
      vec3.subtract(edge2, v2, vertices);
      vec3.subtract(edge3, v3, vertices);
      vec3.normalize(edge2, edge2);
      vec3.normalize(edge3, edge3);
      vec3.scale(edge2, edge2, d1);
      vec3.scale(edge3, edge3, d2);
      vec3.add(edge2, edge2, vertices);
      vec3.add(edge3, edge3, vertices);

      vec3.multiply(edge1, scene.axisNormal, vertices);

      const i1 = scene.axisNormal[0] ? 1 : 0;
      const i2 = i1 ? 2 : scene.axisNormal[1] + 1;
      edge1[i1] = edge2[i1];
      edge1[i2] = edge3[i2];

      vertices.set(edge1, 6);
      vertices.set(edge2, 3);
      vertices.set(edge3, 9);

      model.updateBufferEnd(vertices, 'lineVertex');
      model.updateBufferEnd(vertices, 'vertex');

      this.end();
      engine.emit('scenechange');
    },
    start() {
      if (this.active) return;

      historyAction = history.createAction('Draw rectangle', {
        model: scene.currentModelWithRoot,
        vertices: new Float32Array(12),
        normals: new Float32Array(12),
      }, () => {
        historyAction = undefined;
        engine.emit('toolinactive', rectangle);
      });
      if (!historyAction) return;

      historyAction.data.vertices.set(scene.hoveredGlobal);
      historyAction.data.vertices.set(scene.hoveredGlobal, 3);
      historyAction.data.vertices.set(scene.hoveredGlobal, 6);
      historyAction.data.vertices.set(scene.hoveredGlobal, 9);

      historyAction.append(
        ({ model, vertices, normals }) => {
          model.appendBufferData(vertices, 'vertex');
          model.appendBufferData(vertices, 'lineVertex');
          model.appendBufferData(normals, 'normal');
          model.appendBufferData(colors, 'color');
          model.appendBufferData(index, 'index');
          model.appendBufferData(lineIndex, 'lineIndex');
          engine.emit('scenechange');
        },
        ({ model }) => {
          model.truncateBuffer('vertex', 12);
          model.truncateBuffer('lineVertex', 12);
          model.truncateBuffer('normal', 12);
          model.truncateBuffer('color', 12);
          model.truncateBuffer('index', 6);
          model.truncateBuffer('lineIndex', 8);
          engine.emit('scenechange');
        },
      );

      engine.emit('toolactive', rectangle);
    },
    update() {
      if (!historyAction) return;

      const { model, vertices, normals } = historyAction.data;

      hovered[0] = 1;
      hovered[1] = 1;
      hovered[2] = 1;

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

      normals.set(scene.axisNormal);
      normals.set(scene.axisNormal, 3);
      normals.set(scene.axisNormal, 6);
      normals.set(scene.axisNormal, 9);
      model.updateBufferEnd(normals, 'normal');

      engine.emit('scenechange');
    },
    end() {
      if (!historyAction || !this.distance?.every(v => v >= 0.1)) return;
      historyAction.commit();
    },
    abort() {
      if (!historyAction || engine.tools.selected.type === 'orbit') return;

      historyAction.discard();
    },
  };

  return rectangle;
};
