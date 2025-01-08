import Sketch from '../engine/cad/sketch.js';

const { vec2, vec3, mat4 } = glMatrix;

/**
 * @typedef RectData
 * @property {import("../engine/cad/sketch.js").default} sketch
 * @property {import("../engine/cad/sketch.js").LineConstructionElement} lineOriginVertical
 * @property {import("../engine/cad/sketch.js").LineConstructionElement} lineOriginHorizontal
 * @property {import("../engine/cad/sketch.js").LineConstructionElement} lineCoordVertical
 * @property {import("../engine/cad/sketch.js").LineConstructionElement} lineCoordHorizontal
 * @property {number[]} lockedIds
 * @property {[number, number]} length
 * @property {number | undefined} startId
 * @property {number | undefined} endId
 * @property {Instance} instance
 * @property {import("../engine/cad/sketch").PointInfo[]} points
 */

/** @typedef {Tool<"coord2d">} RectTool */

/** @type {(engine: Engine) => RectTool} */
export default (engine) => {
  const {
    editor: { selection, edited: active },
    history,
    scene,
    tools,
    emit,
    on,
  } = engine;

  /** @type {import("../engine/history.js").HistoryAction<RectData>|undefined} */
  let historyAction;
  let released = true;

  // cached structures
  const transformation = mat4.create();
  const diff = vec2.create();
  const origin = vec3.create();
  const coord = vec3.create();
  const line = new Float32Array(4);

  /** @type {RectTool} */
  const rectangle = {
    type: 'rectangle',
    name: 'Rectangle',
    shortcut: [['d'], ['r']],
    icon: '⧄',
    cursor: 'crosshair',
    get active() {
      return !!historyAction;
    },
    get value() {
      if (!historyAction) return undefined;

      const { lineOriginHorizontal, lineOriginVertical } = historyAction.data;

      line.set(lineOriginHorizontal.data);
      const d1 = vec2.distance(/** @type {vec2} */ (line), /** @type {vec2} */ (line.subarray(2)));

      line.set(lineOriginVertical.data);
      const d2 = vec2.distance(/** @type {vec2} */ (line), /** @type {vec2} */ (line.subarray(2)));

      return vec2.set(diff, d1, d2);
    },
    valueType: 'coord2d',
    setValue([d1, d2]) {
      if (!historyAction || d1 <= 0 || d2 <= 0) return;

      const { sketch, lineCoordHorizontal, lockedIds } = historyAction.data;

      coord[0] = origin[0] + (coord[0] > origin[0] ? d1 : -d1);
      coord[1] = origin[1] + (coord[1] > origin[1] ? d2 : -d2);

      lineCoordHorizontal.data[2] = coord[0];
      lineCoordHorizontal.data[3] = coord[1];

      sketch.update(lockedIds);

      historyAction.data.length = [d1, d2];
      historyAction.append((data) => {
        data.sketch.distance(data.length[0], data.lineOriginHorizontal);
        data.sketch.distance(data.length[1], data.lineOriginVertical);
      }, () => {});

      this.end();
    },
    start() {
      released = false;
      const { enteredInstance, hoveredInstance, currentInstance, hoveredPointId, hoveredAxisId } = scene;
      const instance = enteredInstance ?? hoveredInstance ?? currentInstance;
      if (!(scene.currentStep instanceof Sketch)) {
        const normal = vec3.create();
        vec3.transformQuat(normal, scene.axisNormal, instance.Placement.inverseRotation);

        const faceId = selection.getByType('face')
          .filter(sel => sel.instance === instance)
          .pop()?.id ?? scene.hoveredFaceId;

        const sketch = instance.body.createStep(Sketch, {
          attachment: faceId !== null ? { type: 'face', faceId } : {
            type: 'plane',
            normal: /** @type {PlainVec3} */ ([...normal]),
          },
        });
        scene.setCurrentStep(sketch);
      }

      if (!(scene.currentStep instanceof Sketch)) return;

      mat4.multiply(transformation, instance.Placement.inverseTrs, scene.currentStep.toSketch);
      vec3.transformMat4(origin, scene.hovered, transformation);
      vec3.copy(coord, origin);

      let startingId = undefined;
      if (hoveredInstance === instance && hoveredPointId !== null && scene.currentStep.hasPoint(hoveredPointId)) {
        startingId = hoveredPointId;
      } else if (hoveredAxisId === 0) {
        startingId = -1;
      }

      historyAction = history.createAction('Draw rectangle', {
        sketch: scene.currentStep,
        lineOriginHorizontal: Sketch.makeConstructionElement('line', [origin[0], origin[1], coord[0], origin[1]]),
        lineOriginVertical:   Sketch.makeConstructionElement('line', [origin[0], origin[1], origin[0], coord[1]]),
        lineCoordHorizontal:  Sketch.makeConstructionElement('line', [origin[0], coord[1], coord[0], coord[1]]),
        lineCoordVertical:    Sketch.makeConstructionElement('line', [coord[0], origin[1], coord[0], coord[1]]),
        lockedIds: [],
        length: [0, 0],
        startId: startingId,
        endId: undefined,
        instance,
        points: [],
      }, () => {
        historyAction = undefined;
        active.clear();
        emit('toolinactive', rectangle);
      });
      if (!historyAction) return;

      emit('toolactive', rectangle);

      historyAction.append(
        ({
          sketch,
          lineCoordHorizontal,
          lineCoordVertical,
          lineOriginHorizontal,
          lineOriginVertical,
          lockedIds,
          startId,
          points,
        }) => {
          sketch.addElement(lineOriginHorizontal);
          sketch.addElement(lineOriginVertical);
          sketch.addElement(lineCoordHorizontal);
          sketch.addElement(lineCoordVertical);

          const pointOriginHorizontal = sketch.getPoints(lineOriginHorizontal);
          const pointOriginVertical = sketch.getPoints(lineOriginVertical);
          const pointCoordHorizontal = sketch.getPoints(lineCoordHorizontal);
          const pointCoordVertical = sketch.getPoints(lineCoordVertical);

          points[0] = pointCoordHorizontal[1];

          sketch.coincident([pointOriginHorizontal[0].id, pointOriginVertical[0].id]);
          sketch.coincident([pointOriginHorizontal[1].id, pointCoordVertical[0].id]);
          sketch.coincident([pointCoordHorizontal[0].id, pointOriginVertical[1].id]);
          sketch.coincident([pointCoordHorizontal[1].id, pointCoordVertical[1].id]);

          sketch.horizontal(lineOriginHorizontal);
          sketch.horizontal(lineCoordHorizontal);
          sketch.vertical(lineOriginVertical);
          sketch.vertical(lineCoordVertical);

          lockedIds.push(pointOriginHorizontal[0].id, pointCoordHorizontal[1].id);

          active.set([
            lineOriginHorizontal,
            lineOriginVertical,
            lineCoordHorizontal,
            lineCoordVertical,
            pointOriginHorizontal,
            pointOriginVertical,
            pointCoordHorizontal,
            pointCoordVertical,
          ].flatMap(el => {
            const isPoint = Array.isArray(el);
            const type = isPoint ? 'point' : 'line';

            if (isPoint) return el.map(({ id }) => ({ type, id, instance }));

            const id = sketch.getLineId(el);
            return id !== null ? { type, id, instance } : [];
          }));

          if (startId !== undefined) {
            sketch.coincident([startId, pointOriginHorizontal[0].id]);
            active.add({ type: 'point', id: startId, instance });
          }
        },
        (data) => {
          data.sketch.deleteElement(data.lineOriginHorizontal);
          data.sketch.deleteElement(data.lineOriginVertical);
          data.sketch.deleteElement(data.lineCoordHorizontal);
          data.sketch.deleteElement(data.lineCoordVertical);

          data.lockedIds = [];
        },
      );
    },
    update() {
      if (!historyAction) return;

      const { sketch, lineCoordHorizontal, lockedIds } = historyAction.data;

      vec3.transformMat4(coord, scene.hovered, transformation);

      lineCoordHorizontal.data[2] = coord[0];
      lineCoordHorizontal.data[3] = coord[1];

      sketch.update(lockedIds);
    },
    end() {
      if (!historyAction) return;

      const tooShort = !released && !this.value?.every(v => v >= 0.1);
      released = true;
      if (tooShort) return;

      const { data } = historyAction;
      const { hoveredPointId, hoveredInstance, hoveredAxisId } = scene;

      if (hoveredInstance === data.instance && hoveredPointId !== null && data.sketch.hasPoint(hoveredPointId)) {
        data.endId = hoveredPointId;
      } else if (hoveredAxisId === 0) {
        data.endId = -1;
      }

      if (data.endId !== undefined) {
        historyAction.append(({ endId, sketch, points }) => {
          if (endId !== undefined) {
            sketch.coincident([points[0].id, endId]);
          }
        }, () => {});
      }

      historyAction.commit();
    },
    abort() {
      if (!historyAction || tools.selected?.type === 'orbit') return;
      historyAction.discard();
    },
  };

  /**
   * @param {Readonly<import("../engine/cad/body.js").AnyStep>?} tool
   * @returns {boolean}
   */
  const shouldShow = (tool) => !tool || tool instanceof Sketch;

  on('stepchange', (current, previous) => {
    if (current !== scene.currentStep) return;
    if (!shouldShow(current) && shouldShow(previous)) tools.disable(rectangle);
    else if (shouldShow(current) && !shouldShow(previous)) tools.enable(rectangle);
  });

  return rectangle;
};
