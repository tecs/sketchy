import Sketch from '../engine/cad/sketch.js';

const { vec2, vec3, mat4 } = glMatrix;

/**
 * @typedef RectData
 * @property {import("../engine/cad/sketch.js").default} sketch
 * @property {import("../engine/cad/sketch.js").LineConstructionElement} lineOriginVertical
 * @property {import("../engine/cad/sketch.js").LineConstructionElement} lineOriginHorizontal
 * @property {import("../engine/cad/sketch.js").LineConstructionElement} lineCoordVertical
 * @property {import("../engine/cad/sketch.js").LineConstructionElement} lineCoordHorizontal
 * @property {number[]} lockedIndices
 * @property {number | undefined} startIndex
 * @property {number | undefined} endIndex
 * @property {Instance} instance
 * @property {import("../engine/cad/sketch").PointInfo[]} points
 */

/** @type {(engine: Engine) => Tool} */
export default (engine) => {
  const { editor: { edited: active }, history, scene, emit } = engine;

  /** @type {import("../engine/history.js").HistoryAction<RectData>|undefined} */
  let historyAction;
  let released = true;

  // cached structures
  const transformation = mat4.create();
  const origin = vec3.create();
  const coord = vec3.create();
  const line = new Float32Array(4);

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

      const { lineOriginHorizontal, lineOriginVertical } = historyAction.data;

      line.set(lineOriginHorizontal.data);
      const d1 = vec2.distance(/** @type {vec2} */ (line), /** @type {vec2} */ (line.subarray(2)));

      line.set(lineOriginVertical.data);
      const d2 = vec2.distance(/** @type {vec2} */ (line), /** @type {vec2} */ (line.subarray(2)));

      return [d1, d2];
    },
    setDistance([d1, d2]) {
      if (!historyAction) return;

      const { sketch, lineCoordHorizontal, lockedIndices } = historyAction.data;

      coord[0] = origin[0] + (coord[0] > 0 ? d1 : -d1);
      coord[1] = origin[1] + (coord[1] > 0 ? d2 : -d2);

      lineCoordHorizontal.data[2] = coord[0];
      lineCoordHorizontal.data[3] = coord[1];

      sketch.update(lockedIndices);

      this.end();
    },
    start() {
      released = false;
      const { enteredInstance, hoveredInstance, currentInstance, hoveredPointIndex } = scene;
      const instance = enteredInstance ?? hoveredInstance ?? currentInstance;
      if (!(scene.currentStep instanceof Sketch)) {
        const normal = vec3.create();
        vec3.transformQuat(normal, scene.axisNormal, instance.Placement.inverseRotation);

        const sketch = instance.body.createStep(Sketch, {
          attachment: {
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

      let startingIndex = undefined;
      if (hoveredInstance === instance && hoveredPointIndex !== null && scene.currentStep.hasPoint(hoveredPointIndex)) {
        startingIndex = hoveredPointIndex;
      }

      historyAction = history.createAction('Draw rectangle', {
        sketch: scene.currentStep,
        lineOriginHorizontal: Sketch.makeConstructionElement('line', [origin[0], origin[1], coord[0], origin[1]]),
        lineOriginVertical:   Sketch.makeConstructionElement('line', [origin[0], origin[1], origin[0], coord[1]]),
        lineCoordHorizontal:  Sketch.makeConstructionElement('line', [origin[0], coord[1], coord[0], coord[1]]),
        lineCoordVertical:    Sketch.makeConstructionElement('line', [coord[0], origin[1], coord[0], coord[1]]),
        lockedIndices: [],
        startIndex: startingIndex,
        endIndex: undefined,
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
          lockedIndices,
          startIndex,
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

          sketch.coincident([pointOriginHorizontal[0].index, pointOriginVertical[0].index]);
          sketch.coincident([pointOriginHorizontal[1].index, pointCoordVertical[0].index]);
          sketch.coincident([pointCoordHorizontal[0].index, pointOriginVertical[1].index]);
          sketch.coincident([pointCoordHorizontal[1].index, pointCoordVertical[1].index]);

          sketch.horizontal(lineOriginHorizontal);
          sketch.horizontal(lineCoordHorizontal);
          sketch.vertical(lineOriginVertical);
          sketch.vertical(lineCoordVertical);

          lockedIndices.push(pointOriginHorizontal[0].index, pointCoordHorizontal[1].index);

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

            if (isPoint) return el.map(({ index }) => ({ type, index, instance }));

            const index = sketch.getLineIndex(el);
            return index !== null ? { type, index, instance } : [];
          }));

          if (startIndex !== undefined) {
            sketch.coincident([startIndex, pointOriginHorizontal[0].index]);
            active.add({ type: 'point', index: startIndex, instance });
          }
        },
        (data) => {
          data.sketch.deleteElement(data.lineOriginHorizontal);
          data.sketch.deleteElement(data.lineOriginVertical);
          data.sketch.deleteElement(data.lineCoordHorizontal);
          data.sketch.deleteElement(data.lineCoordVertical);

          data.lockedIndices = [];
        },
      );
    },
    update() {
      if (!historyAction) return;

      const { sketch, lineCoordHorizontal, lockedIndices } = historyAction.data;

      vec3.transformMat4(coord, scene.hovered, transformation);

      lineCoordHorizontal.data[2] = coord[0];
      lineCoordHorizontal.data[3] = coord[1];

      sketch.update(lockedIndices);
    },
    end() {
      if (!historyAction) return;

      const tooShort = !released && !this.distance?.every(v => v >= 0.1);
      released = true;
      if (tooShort) return;

      const { data } = historyAction;
      const { hoveredPointIndex, hoveredInstance } = scene;

      if (hoveredInstance === data.instance && hoveredPointIndex !== null && data.sketch.hasPoint(hoveredPointIndex)) {
        data.endIndex = hoveredPointIndex;
        historyAction.append(({ endIndex, sketch, points }) => {
          if (endIndex !== undefined) {
            sketch.coincident([points[0].index, endIndex]);
          }
        }, () => {});
      }

      historyAction.commit();
    },
    abort() {
      if (!historyAction || engine.tools.selected?.type === 'orbit') return;
      historyAction.discard();
    },
  };

  return rectangle;
};
