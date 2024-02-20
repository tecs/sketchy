const { vec3 } = glMatrix;

/** @type {(engine: Engine) => Tool} */
export default (engine) => {
  const { driver: { UintIndexArray }, history, scene } = engine;

  // cached structures
  const origin = vec3.create();
  const coord = vec3.create();
  const lineIndex = new UintIndexArray([0, 1]);
  const vertices = new Float32Array(6);

  /** @type {Tool} */
  const line = {
    type: 'line',
    name: 'Line/Arc',
    shortcut: 'l',
    icon: '🖊',
    cursor: 'crosshair',
    active: false,
    get distance() {
      return this.active ? [vec3.distance(origin, coord)] : undefined;
    },
    setDistance([distance]) {
      if (!this.active) return;

      const model = scene.currentModelWithRoot;
      vec3.subtract(coord, vertices, scene.hoveredGlobal);
      vec3.normalize(coord, coord);
      vec3.scale(coord, coord, -distance);
      vec3.add(coord, coord, vertices);

      model.updateBufferEnd(coord, 'lineVertex');

      this.end();
      engine.emit('scenechange');
    },
    start() {
      if (this.active || !history.lock()) return;
      vec3.copy(origin, scene.hoveredGlobal);
      this.active = true;
      engine.emit('toolactive', line);

      const model = scene.currentModelWithRoot;

      vertices.set(origin);
      vertices.set(origin, 3);
      model.appendBufferData(vertices, 'lineVertex');
      model.appendBufferData(lineIndex, 'lineIndex');
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
      if (!this.distance?.every(v => v >= 0.1)) return;
      vec3.copy(origin, scene.hoveredGlobal);

      const model = scene.currentModelWithRoot;
      const finalVertices = new Float32Array(vertices);
      finalVertices.set(coord, 3);
      history.push({
        name: 'Draw line segment',
        skip: true,
        execute() {
          model.appendBufferData(finalVertices, 'lineVertex');
          model.appendBufferData(lineIndex, 'lineIndex');
          engine.emit('scenechange');
        },
        revert() {
          model.truncateBuffer('lineVertex', 6);
          model.truncateBuffer('lineIndex', 2);
          engine.emit('scenechange');
        },
      });

      engine.emit('toolinactive', line);
      this.active = history.lock();
      if (this.active) {
        engine.emit('toolactive', line);
        vertices.set(model.data.lineVertex.subarray(-3));
        vertices.set(origin, 3);
        model.appendBufferData(vertices, 'lineVertex');
        model.appendBufferData(lineIndex, 'lineIndex');
      }
    },
    abort() {
      if (!this.active || engine.tools.selected.type === 'orbit') return;

      history.unlock();
      const model = scene.currentModelWithRoot;

      model.truncateBuffer('lineVertex', 6);
      model.truncateBuffer('lineIndex', 2);

      this.active = false;
      engine.emit('toolinactive', line);
      engine.emit('scenechange');
    },
  };

  return line;
};
