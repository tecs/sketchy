import SubInstance from '../engine/cad/subinstance.js';

const { vec3 } = glMatrix;

/** @typedef {Tool<"angle">} RotateTool */

/** @type {(engine: Engine) => RotateTool} */
export default (engine) => {
  const { camera, editor: { edited: active, selection }, input, scene, history, emit } = engine;

  /**
   * @typedef RotateData
   * @property {Instance} instance
   * @property {number} angle
   * @property {vec3} axis
   */

  /** @type {import("../engine/history.js").HistoryAction<RotateData>|undefined} */
  let historyAction;
  let released = true;

  // cached structures
  const tempVec3 = vec3.create();
  const mouseOrigin = vec3.create();

  /** @type {RotateTool} */
  const rotate = {
    type: 'rotate',
    name: 'Rotate',
    shortcut: 'r',
    icon: '🗘',
    cursor: 'move',
    get active() {
      return !!historyAction;
    },
    valueType: 'angle',
    get value() {
      return historyAction?.data.angle;
    },
    setValue(newAngle) {
      if (!historyAction) return;

      const { instance, angle, axis } = historyAction.data;

      historyAction.data.angle = newAngle;

      instance.rotate(-angle, axis);
      instance.rotate(newAngle, axis);

      this.end();
      emit('scenechange');
    },
    start() {
      released = false;
      const { hoveredInstance, enteredInstance, currentInstance } = scene;

      let instance = selection.getByType('instance').map(el => el.instance).pop() ?? hoveredInstance;
      if (!instance) return;

      let parent = SubInstance.getParent(instance);
      while (parent && parent.instance !== enteredInstance) {
        instance = parent.instance;
        parent = SubInstance.getParent(instance);
      }

      if (instance === currentInstance || !SubInstance.belongsTo(instance, enteredInstance)) {
        return;
      }

      const originalSelection = selection.elements.slice();

      const title = `Rotate instance #${instance.Id.str}`;

      historyAction = history.createAction(title, { instance, angle: 0, axis: vec3.create() }, () => {
        historyAction = undefined;
        selection.set(originalSelection);
        active.clear();
        emit('toolinactive', rotate);
      });
      if (!historyAction) return;

      selection.set({ type: 'instance', id: instance.Id.int, instance });
      active.set(selection.elements);

      vec3.copy(mouseOrigin, input.position);

      emit('toolactive', rotate);

      historyAction.append(
        data => {
          instance.rotate(data.angle, data.axis);
          emit('scenechange');
        },
        data => {
          instance.rotate(-data.angle, data.axis);
          emit('scenechange');
        },
      );
    },
    update() {
      if (!historyAction) return;

      const { instance, angle, axis } = historyAction.data;

      instance.rotate(-angle, axis);

      vec3.subtract(axis, input.position, mouseOrigin);

      vec3.multiply(tempVec3, axis, camera.pixelToScreen);
      historyAction.data.angle = vec3.length(tempVec3) * Math.PI;

      // rotate 90deg
      const x = axis[0];
      axis[0] = axis[1];
      axis[1] = x;

      vec3.transformQuat(axis, axis, camera.inverseRotation);
      vec3.transformQuat(axis, axis, instance.Placement.inverseRotation);
      vec3.normalize(axis, axis);

      instance.rotate(historyAction.data.angle, axis);

      emit('scenechange');
    },
    end() {
      const { value } = this;
      const tooShort = !released && (value === undefined || Math.abs(value) < 0.1);
      released = true;
      if (tooShort) return;

      historyAction?.commit();
    },
    abort() {
      if (engine.tools.selected?.type === 'orbit') return;

      historyAction?.discard();
    },
  };

  return rotate;
};
