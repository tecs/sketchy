import SubInstance from '../engine/cad/subinstance.js';

const { vec3, glMatrix: { equals } } = glMatrix;

/** @typedef {Tool<"number">} ScaleTool */

/** @type {(engine: Engine) => ScaleTool} */
export default (engine) => {
  const {
    editor: { edited: active, selection },
    scene,
    tools,
    history,
    emit,
    on,
  } = engine;

  /**
   * @typedef ScaleData
   * @property {Instance[]} instances
   * @property {number} scaleFactor
   */

  /** @type {import("../engine/history.js").HistoryAction<ScaleData>|undefined} */
  let historyAction;
  let released = true;

  // cached structures
  const origin = vec3.create();
  const tempVec3 = vec3.create();
  const vec3One = vec3.fromValues(1, 1, 1);
  let startingDistance = 1;

  /** @type {ScaleTool} */
  const scale = {
    type: 'scale',
    name: 'Scale',
    shortcut: 's',
    icon: 'scale',
    cursor: 'action-scale',
    get active() {
      return !!historyAction;
    },
    valueType: 'number',
    get value() {
      return historyAction?.data.scaleFactor;
    },
    setValue(newScaleFactor) {
      if (!historyAction) return;

      const { instances, scaleFactor } = historyAction.data;

      historyAction.data.scaleFactor = newScaleFactor;
      vec3.scale(tempVec3, vec3One, newScaleFactor / scaleFactor);

      for (const instance of instances) {
        instance.scale(tempVec3);
      }

      this.end();
      emit('scenechange');
    },
    start() {
      released = false;
      const { hoveredInstance, enteredInstance, currentInstance } = scene;

      const scaleSelection = /** @type {Instance[]} */ ([]);

      const instances = selection.getByType('instance').map(({ instance }) => instance);

      if (!instances.length && hoveredInstance) {
        instances.push(hoveredInstance);
      }

      for (let i = instances.length - 1; i >= 0; --i) {
        const instance = SubInstance.asDirectChildOf(instances[i], enteredInstance);
        if (!instance || instance === currentInstance) instances.splice(i, 1);
        else instances[i] = instance;
      }

      if (!instances.length) return;
      const originalSelection = selection.elements.slice();

      const title = `Scale instance ${instances.map(({ Id }) => `#${Id.str}`).join(', ')}`;

      historyAction = history.createAction(title, { instances, scaleFactor: 1 }, () => {
        historyAction = undefined;
        selection.set(originalSelection);
        active.clear();
        emit('toolinactive', scale);
        emit('cursorchange', scale.cursor);
      });
      if (!historyAction) return;

      selection.set(scaleSelection.map(instance => ({ type: 'instance', id: instance.Id.int, instance })));

      active.set(selection.elements);

      vec3.zero(origin);
      instances[0].Placement.toGlobalCoords(origin, origin);
      startingDistance = vec3.distance(origin, scene.hovered);

      emit('toolactive', scale);
      emit('cursorchange', 'scale');

      historyAction.append(
        data => {
          vec3.scale(tempVec3, vec3One, data.scaleFactor);
          for (const instance of data.instances) {
            instance.scale(tempVec3);
          }
          emit('scenechange');
        },
        data => {
          vec3.scale(tempVec3, vec3One, 1 / data.scaleFactor);
          for (const instance of data.instances) {
            instance.scale(tempVec3);
          }
          emit('scenechange');
        },
      );
    },
    update() {
      if (!historyAction) return;

      const { instances, scaleFactor } = historyAction.data;

      const newScaleFactor = vec3.distance(origin, scene.hovered) / startingDistance;
      const diffScaleFactor = newScaleFactor / scaleFactor;

      if (equals(diffScaleFactor, 1)) return;
      historyAction.data.scaleFactor = newScaleFactor;
      vec3.scale(tempVec3, vec3One, diffScaleFactor);

      for (const instance of instances) {
        instance.scale(tempVec3);
      }

      emit('scenechange');
    },
    end() {
      const { value } = this;
      const tooShort = !released && (value === undefined || Math.abs(value - 1) < 0.1);
      released = true;
      if (tooShort) return;

      historyAction?.commit();
    },
    abort() {
      if (tools.selected?.type === 'orbit') return;

      historyAction?.discard();
    },
  };

  on('stepchange', (current, previous) => {
    if (current !== scene.currentStep) return;
    if (current && !previous) tools.disable(scale);
    else if (!current && previous) tools.enable(scale);
  });

  return scale;
};
