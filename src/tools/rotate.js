import SubInstance from '../engine/cad/subinstance.js';

const { vec3 } = glMatrix;

/** @typedef {Tool<"angle">} RotateTool */

/** @type {(engine: Engine) => RotateTool} */
export default (engine) => {
  const {
    camera,
    editor: { edited: active, selection },
    input,
    scene,
    tools,
    history,
    emit,
    on,
  } = engine;

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
    icon: 'rotate',
    cursor: 'action-rotate',
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

      instance = SubInstance.asDirectChildOf(instance, enteredInstance);
      if (!instance || instance === currentInstance) return;

      const originalSelection = selection.elements.slice();

      const title = `Rotate instance #${instance.Id.str}`;

      historyAction = history.createAction(title, { instance, angle: 0, axis: vec3.create() }, () => {
        historyAction = undefined;
        selection.set(originalSelection);
        active.clear();
        emit('toolinactive', rotate);
        emit('cursorchange', rotate.cursor);
      });
      if (!historyAction) return;

      selection.set({ type: 'instance', id: instance.Id.int, instance });
      active.set(selection.elements);

      vec3.copy(mouseOrigin, input.position);

      emit('toolactive', rotate);
      emit('cursorchange', 'rotate');

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
      if (tools.selected?.type === 'orbit') return;

      historyAction?.discard();
    },
  };

  on('stepchange', (current, previous) => {
    if (current !== scene.currentStep) return;
    if (current && !previous) tools.disable(rotate);
    else if (!current && previous) tools.enable(rotate);
  });

  return rotate;
};
