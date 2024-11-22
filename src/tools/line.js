import Sketch from '../engine/cad/sketch.js';

const { vec3, mat4 } = glMatrix;

/** @typedef {import("../engine/cad/sketch.js").LineConstructionElement} Line */
/** @typedef {Tool<"distance">} LineTool */

/**
 * @typedef LineData
 * @property {Sketch} sketch
 * @property {Line} line
 * @property {number} length
 * @property {number | undefined} startIndex
 * @property {number | undefined} endIndex
 * @property {Instance} instance
 * @property {import("../engine/cad/sketch").PointInfo[]} points
 */

/** @type {(engine: Engine) => LineTool} */
export default (engine) => {
  const { editor: { edited: active }, history, scene, emit } = engine;

  /** @type {import("../engine/history.js").HistoryAction<LineData>|undefined} */
  let historyAction;
  let released = true;

  // cached structures
  const transformation = mat4.create();
  const origin = vec3.create();
  const coord = vec3.create();

  /** @type {Omit<LineTool, "start"> & { start: (click?: number, startIndex?: number) => void }} */
  const lineTool = {
    type: 'line',
    name: 'Line/Arc',
    shortcut: [['d'], ['l']],
    icon: '🖊',
    cursor: 'crosshair',
    get active() {
      return !!historyAction;
    },
    valueType: 'distance',
    get value() {
      return historyAction ? vec3.distance(origin, coord) : undefined;
    },
    setValue(distance) {
      if (!historyAction || distance <= 0) return;
      const { sketch, line } = historyAction.data;

      vec3.subtract(coord, origin, coord);
      vec3.normalize(coord, coord);
      vec3.scale(coord, coord, -distance);
      vec3.add(coord, coord, origin);

      line.data[2] = coord[0];
      line.data[3] = coord[1];

      historyAction.data.length = distance;
      historyAction.append((data) => data.sketch.distance(data.length, data.line), () => {});

      sketch.update();

      this.end();
    },
    start(_, startIndex) {
      released = startIndex !== undefined;
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

      if (startIndex === undefined) {
        mat4.multiply(transformation, instance.Placement.inverseTrs, scene.currentStep.toSketch);
        vec3.transformMat4(origin, scene.hovered, transformation);
        vec3.copy(coord, origin);
      } else {
        vec3.copy(origin, coord);
      }

      if (instance === scene.hoveredInstance && scene.hoveredPointIndex !== null) {
        startIndex ??= scene.hoveredPointIndex;
      }

      historyAction = history.createAction('Draw line segment', {
        sketch: scene.currentStep,
        line: Sketch.makeConstructionElement('line', [origin[0], origin[1], coord[0], coord[1]]),
        length: 0,
        startIndex,
        endIndex: undefined,
        instance,
        points: [],
      }, () => {
        historyAction = undefined;
        active.clear();
        emit('toolinactive', lineTool);
      });
      if (!historyAction) return;

      emit('toolactive', lineTool);

      historyAction.append(
        (data) => {
          data.sketch.addElement(data.line);
          data.points = data.sketch.getPoints(data.line);
          const indices = data.points.map(({ index }) => index);
          if (data.startIndex !== undefined) {
            data.sketch.coincident([data.startIndex, indices[0]]);
            indices.push(data.startIndex);
          }

          const activeElements = indices.map(index => ({ type: /** @type {"point" | "line"} */ ('point'), index, instance }));

          const index = data.sketch.getLineIndex(data.line);
          if (index !== null) activeElements.push({ type: 'line', index, instance });

          active.set(activeElements);
        },
        (data) => data.sketch.deleteElement(data.line),
      );
    },
    update() {
      if (!historyAction) return;
      const { sketch, line } = historyAction.data;

      vec3.transformMat4(coord, scene.hovered, transformation);

      line.data[2] = coord[0];
      line.data[3] = coord[1];
      sketch.update();
    },
    end() {
      if (!historyAction) return;

      const { value } = this;
      const tooShort = !released && (!value || value < 0.1);
      released = true;
      if (tooShort) return;

      const { data } = historyAction;
      const { hoveredPointIndex, hoveredInstance } = scene;

      if (hoveredInstance === data.instance && hoveredPointIndex !== null && data.sketch.hasPoint(hoveredPointIndex)) {
        data.endIndex = hoveredPointIndex;
        historyAction.append(({ endIndex, sketch, points }) => {
          if (endIndex !== undefined) {
            sketch.coincident([points[1].index, endIndex]);
          }
        }, () => {});
      }
      const { endIndex } = historyAction.data;

      historyAction.commit();
      if (endIndex === undefined) this.start(1, data.points[1].index);
    },
    abort() {
      if (engine.tools.selected?.type === 'orbit') return;

      historyAction?.discard();
    },
  };

  return lineTool;
};
