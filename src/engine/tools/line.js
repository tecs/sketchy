const { vec3 } = glMatrix;

/** @type {(engine: Engine) => Tool} */
export default (engine) => {
  const { driver: { UintIndexArray }, history, scene, emit } = engine;

  /**
   * @typedef LineData
   * @property {Model} model
   * @property {vec3} origin
   * @property {vec3} coord
   */

  /** @type {import("../history").HistoryAction<LineData>|undefined} */
  let historyAction;

  // cached structures
  const lineIndex = new UintIndexArray([0, 1]);

  /** @type {Omit<Tool, 'start'> & { start: (startCoord?: vec3, currentModel? : Model) => void }} */
  const line = {
    type: 'line',
    name: 'Line/Arc',
    shortcut: 'l',
    icon: '🖊',
    cursor: 'crosshair',
    get active() {
      return !!historyAction;
    },
    get distance() {
      return historyAction ? [vec3.distance(historyAction.data.origin, historyAction.data.coord)] : undefined;
    },
    setDistance([distance]) {
      if (!historyAction) return;
      const { model, coord, origin } = historyAction.data;

      vec3.subtract(coord, origin, scene.hovered);
      vec3.normalize(coord, coord);
      vec3.scale(coord, coord, -distance);
      vec3.add(coord, coord, origin);

      model.updateBufferEnd(coord, 'lineVertex');
      emit('scenechange');

      this.end();
    },
    start(startCoord = scene.hovered, currentModel = undefined) {
      if (this.active) return;
      currentModel ??= scene.currentInstance?.model ?? scene.instanceEmptyModel().model;

      historyAction = history.createAction('Draw line segment', {
        origin: vec3.clone(startCoord),
        coord: vec3.clone(startCoord),
        model: currentModel,
      }, () => {
        historyAction = undefined;
        emit('toolinactive', line);
      });
      if (!historyAction) return;

      emit('toolactive', line);

      historyAction.append(
        ({ origin, coord, model }) => {
          model.appendBufferData(origin, 'lineVertex');
          model.appendBufferData(coord, 'lineVertex');
          model.appendBufferData(lineIndex, 'lineIndex');
          emit('scenechange');
        },
        ({ model }) => {
          model.truncateBuffer('lineVertex', 6);
          model.truncateBuffer('lineIndex', 2);
          emit('scenechange');
        },
      );
    },
    update() {
      if (!historyAction) return;
      const { model, coord } = historyAction.data;

      vec3.multiply(coord, scene.axisNormal, model.data.lineVertex);
      vec3.add(coord, coord, scene.hovered);

      model.updateBufferEnd(coord, 'lineVertex');

      emit('scenechange');
    },
    end() {
      if (!historyAction || !this.distance?.every(v => v >= 0.1)) return;

      const { coord, model } = historyAction.data;
      historyAction.commit();
      this.start(coord, model);
    },
    abort() {
      if (!historyAction || engine.tools.selected.type === 'orbit') return;

      historyAction.discard();
    },
  };

  return line;
};
