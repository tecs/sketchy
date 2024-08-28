import Sketch from '../engine/cad/sketch.js';

const { vec2, vec3, mat4 } = glMatrix;

/**
 * @typedef RectData
 * @property {import("../engine/cad/sketch.js").default} sketch
 * @property {import("../engine/cad/sketch.js").LineConstructionElement} lineOriginVertical
 * @property {import("../engine/cad/sketch.js").LineConstructionElement} lineOriginHorizontal
 * @property {import("../engine/cad/sketch.js").LineConstructionElement} lineCoordVertical
 * @property {import("../engine/cad/sketch.js").LineConstructionElement} lineCoordHorizontal
 */

/** @type {(engine: Engine) => Tool} */
export default (engine) => {
  const { history, scene, emit } = engine;

  /** @type {import("../engine/history.js").HistoryAction<RectData>|undefined} */
  let historyAction;

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

      const {
        sketch,
        lineCoordHorizontal,
        lineCoordVertical,
        lineOriginHorizontal,
        lineOriginVertical,
      } = historyAction.data;

      coord[0] = origin[0] + (coord[0] > 0 ? d1 : -d1);
      coord[1] = origin[1] + (coord[1] > 0 ? d2 : -d2);

      lineCoordVertical.data[0] = coord[0];
      lineCoordVertical.data[2] = coord[0];
      lineCoordHorizontal.data[2] = coord[0];
      lineOriginHorizontal.data[2] = coord[0];

      lineCoordHorizontal.data[1] = coord[1];
      lineCoordHorizontal.data[3] = coord[1];
      lineCoordVertical.data[3] = coord[1];
      lineOriginVertical.data[3] = coord[1];

      sketch.update();

      this.end();
    },
    start() {
      const instance = scene.enteredInstance ?? scene.hoveredInstance ?? scene.currentInstance;
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

      const lineOriginHorizontal = Sketch.makeConstructionElement('line', [origin[0], origin[1], origin[0], origin[1]]);
      historyAction = history.createAction('Draw rectangle', {
        sketch: scene.currentStep,
        lineOriginHorizontal,
        lineOriginVertical: Sketch.cloneConstructionElement(lineOriginHorizontal),
        lineCoordHorizontal: Sketch.cloneConstructionElement(lineOriginHorizontal),
        lineCoordVertical: Sketch.cloneConstructionElement(lineOriginHorizontal),
      }, () => {
        historyAction = undefined;
        emit('toolinactive', rectangle);
      });
      if (!historyAction) return;

      emit('toolactive', rectangle);

      historyAction.append(
        (data) => {
          data.sketch.addElement(data.lineOriginHorizontal);
          data.sketch.addElement(data.lineOriginVertical);
          data.sketch.addElement(data.lineCoordHorizontal);
          data.sketch.addElement(data.lineCoordVertical);
        },
        (data) => {
          data.sketch.deleteElement(data.lineOriginHorizontal);
          data.sketch.deleteElement(data.lineOriginVertical);
          data.sketch.deleteElement(data.lineCoordHorizontal);
          data.sketch.deleteElement(data.lineCoordVertical);
        },
      );
    },
    update() {
      if (!historyAction) return;

      const {
        sketch,
        lineCoordHorizontal,
        lineCoordVertical,
        lineOriginHorizontal,
        lineOriginVertical,
      } = historyAction.data;

      vec3.transformMat4(coord, scene.hovered, transformation);

      lineCoordVertical.data[0] = coord[0];
      lineCoordVertical.data[2] = coord[0];
      lineCoordHorizontal.data[2] = coord[0];
      lineOriginHorizontal.data[2] = coord[0];

      lineCoordHorizontal.data[1] = coord[1];
      lineCoordHorizontal.data[3] = coord[1];
      lineCoordVertical.data[3] = coord[1];
      lineOriginVertical.data[3] = coord[1];

      sketch.update();
    },
    end() {
      if (!historyAction || !this.distance?.every(v => v >= 0.1)) return;
      historyAction.commit();
    },
    abort() {
      if (!historyAction || engine.tools.selected?.type === 'orbit') return;
      historyAction.discard();
    },
  };

  return rectangle;
};
