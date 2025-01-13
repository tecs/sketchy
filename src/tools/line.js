import Sketch from '../engine/cad/sketch.js';

const { vec3, mat4 } = glMatrix;

/** @typedef {import("../engine/cad/sketch.js").LineConstructionElement} Line */
/** @typedef {Tool<"distance">} LineTool */

/**
 * @typedef LineData
 * @property {Sketch} sketch
 * @property {Line} line
 * @property {number} length
 * @property {number | undefined} startId
 * @property {number | undefined} endId
 * @property {0 | 1 | undefined} alignedAxis
 * @property {Instance} instance
 * @property {import("../engine/cad/sketch").PointInfo[]} points
 */

/** @type {(engine: Engine) => LineTool} */
export default (engine) => {
  const {
    editor: { selection, edited: active },
    history,
    scene,
    tools,
    emit,
    on,
  } = engine;

  /** @type {import("../engine/history.js").HistoryAction<LineData>|undefined} */
  let historyAction;
  let released = true;

  // cached structures
  const transformation = mat4.create();
  const origin = vec3.create();
  const coord = vec3.create();

  /** @type {Omit<LineTool, "start"> & { start: (click?: number, startId?: number) => void }} */
  const lineTool = {
    type: 'line',
    name: 'Line',
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
    start(_, startId) {
      released = startId !== undefined;
      const instance = scene.enteredInstance ?? scene.hoveredInstance ?? scene.currentInstance;

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

      if (startId === undefined) {
        mat4.multiply(transformation, instance.Placement.inverseTrs, scene.currentStep.toSketch);
        vec3.transformMat4(origin, scene.hovered, transformation);
        vec3.copy(coord, origin);
      } else {
        vec3.copy(origin, coord);
      }

      if (instance === scene.hoveredInstance && scene.hoveredPointId !== null) {
        startId ??= scene.hoveredPointId;
      } else if (scene.hoveredAxisId === 0) {
        startId ??= -1;
      }

      historyAction = history.createAction('Draw line segment', {
        sketch: scene.currentStep,
        line: Sketch.makeConstructionElement('line', [origin[0], origin[1], coord[0], coord[1]]),
        length: 0,
        startId,
        endId: undefined,
        alignedAxis: undefined,
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
          const ids = data.points.map(({ id }) => id);
          if (data.startId !== undefined) {
            data.sketch.coincident([data.startId, ids[0]]);
            ids.push(data.startId);
          }

          const activeElements = ids.map(id => ({ type: 'point', id, instance }));

          const id = data.sketch.getLineId(data.line);
          if (id !== null) activeElements.push({ type: 'line', id, instance });

          active.set(activeElements);
        },
        (data) => data.sketch.deleteElement(data.line),
      );
    },
    update() {
      if (!historyAction) return;
      const { sketch, line } = historyAction.data;

      historyAction.data.alignedAxis = !scene.axisAlignedNormal?.[2]
        ? /** @type {0 | 1 | undefined} */ (scene.axisAlignedNormal?.[0])
        : undefined;
      const { alignedAxis } = historyAction.data;

      vec3.transformMat4(coord, scene.hovered, transformation);
      if (alignedAxis !== undefined) coord[alignedAxis] = line.data[alignedAxis];

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
      const { hoveredPointId, hoveredInstance, hoveredAxisId } = scene;

      if (hoveredInstance === data.instance && hoveredPointId !== null && data.sketch.hasPoint(hoveredPointId)) {
        data.endId = hoveredPointId;
      } else if (hoveredAxisId === 0) {
        data.endId = -1;
      }

      if (data.endId !== undefined) {
        historyAction.append(({ endId, sketch, points }) => {
          if (endId !== undefined) {
            sketch.coincident([points[1].id, endId]);
          }
        }, () => {});
      }

      if (data.alignedAxis !== undefined) {
        historyAction.append(({ alignedAxis, sketch, line }) => {
          switch (alignedAxis) {
            case 0: sketch.vertical(line); break;
            case 1: sketch.horizontal(line); break;
          }
        }, () => {});
      }

      const { endId } = historyAction.data;

      historyAction.commit();
      if (endId === undefined) this.start(1, data.points[1].id);
    },
    abort() {
      if (tools.selected?.type === 'orbit') return;

      historyAction?.discard();
    },
  };

  /**
   * @param {Readonly<import("../engine/cad/body.js").AnyStep>?} tool
   * @returns {boolean}
   */
  const shouldShow = (tool) => !tool || tool instanceof Sketch;

  on('stepchange', (current, previous) => {
    if (current !== scene.currentStep) return;
    if (!shouldShow(current) && shouldShow(previous)) tools.disable(lineTool);
    else if (shouldShow(current) && !shouldShow(previous)) tools.enable(lineTool);
  });

  return lineTool;
};
