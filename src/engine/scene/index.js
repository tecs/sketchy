import Instance from './instance.js';
import Base from '../general/base.js';
import Id from '../general/id.js';
import Body from '../cad/body.js';
import SubInstance from '../cad/subinstance.js';

const { vec3 } = glMatrix;

/** @typedef {import("../cad/body.js").AnyStep} AnyStep */

/**
 * @typedef SceneState
 * @property {import("../cad/body.js").BodyState[]} bodies
 * @property {import("./instance.js").InstanceState[]} instances
 */

export default class Scene extends Base {
  /** @type {Engine} */
  #engine;

  /** @type {Instance} */
  currentInstance;

  /** @type {Instance?} */
  enteredInstance = null;

  /** @type {Instance?} */
  hoveredInstance = null;

  /** @type {number?} */
  hoveredFaceIndex = null;

  /** @type {number?} */
  hoveredLineIndex = null;

  /** @type {number?} */
  hoveredPointIndex = null;

  /** @type {number?} */
  hoveredConstraintIndex = null;

  /** @type {AnyStep?} */
  currentStep = null;

  /** @type {AnyStep?} */
  selectedStep = null;

  /** @type {Body?} */
  selectedBody = null;

  /** @type {ReadonlyVec3} */
  axisNormal = vec3.create();
  hoveredView = vec3.create();
  hovered = vec3.create();

  /**
   * @param {Engine} engine
   */
  constructor(engine) {
    super();

    this.#engine = engine;

    this.reset();

    this.currentInstance = this.assertProperty('currentInstance');

    const { selection } = engine.editor;

    engine.on('keyup', (_, keyCombo) => {
      if (keyCombo === 'delete') {
        const selectedInstances = selection.getByType('instance').map(({ instance }) => instance);
        this.deleteInstances(selectedInstances);
      }
    });
    engine.on('entityadded', (entity) => {
      if (entity instanceof Instance) {
        this.#engine.emit('scenechange');
      }
    });
    engine.on('entityremoved', (entity) => {
      if (!(entity instanceof Instance)) return;

      if (SubInstance.belongsTo(this.enteredInstance, entity)) {
        this.setEnteredInstance(SubInstance.getParent(entity)?.instance ?? null);
      }

      if (SubInstance.belongsTo(this.currentInstance, entity)) {
        const parent = SubInstance.getParent(this.currentInstance)?.instance;
        if (parent) {
          this.setCurrentInstance(parent);
        } else {
          this.#autoSetCurrentInstance();
        }
      }

      this.#engine.emit('scenechange');
    });
  }

  #autoSetCurrentInstance() {
    const bodies = this.#engine.entities.values(Body);
    if (bodies.some(({ instances }) => instances.includes(this.currentInstance))) return;

    for (const body of bodies) {
      if (body.instances.length) {
        this.setCurrentInstance(body.instances[0]);
        return;
      }
    }

    const newBody = this.createBody();
    this.setCurrentInstance(newBody.instantiate());
  }

  /**
   * @param {boolean} [shouldInstantiateEmptyBody]
   */
  reset(shouldInstantiateEmptyBody = true) {
    this.#engine.entities.clear();

    vec3.set(this.axisNormal, 0, 1, 0);
    vec3.zero(this.hovered);
    vec3.zero(this.hoveredView);

    if (shouldInstantiateEmptyBody) this.#autoSetCurrentInstance();

    this.enteredInstance = null;
    this.hoveredInstance = null;
    this.hoveredFaceIndex = null;
    this.hoveredLineIndex = null;
    this.hoveredPointIndex = null;
    this.hoveredConstraintIndex = null;
    this.currentStep = null;
    this.selectedStep = null;
    this.selectedBody = null;

    this.#engine.editor.reset();
    this.#engine.history.drop();
    this.#engine.emit('scenechange');
  }

  /**
   * @param {Partial<import("../cad/body.js").BodyState>} [state]
   * @returns {Body}
   */
  createBody(state) {
    const body = new Body(this.#engine, state);
    this.#engine.entities.set(body);
    return body;
  }

  /**
   * @param {Instance[]} instances
   */
  deleteInstances(instances) {
    if (!instances.length) return;

    const entities = instances.map(instance => SubInstance.getParent(instance)?.subInstance ?? instance);
    const action = this.#engine.history.createAction(
      `Delete instance ${instances.map(({ name }) => name).join(', ')}`,
      { entities },
    );
    if (!action) return;

    action.append(
      (data) => {
        for (const entity of data.entities) {
          const body = entity.body;
          if (entity instanceof SubInstance) body.removeStep(entity);
          else body.uninstantiate(entity);
        }
      },
      (data) => {
        for (const [i, entity] of data.entities.entries()) {
          const body = entity.body;
          data.entities[i] = entity instanceof SubInstance
            ? body.createStep(SubInstance, entity.State.export().data)
            : body.instantiate(entity.State.export());
        }
      },
    );

    action.commit();
  }

  /**
   * @param {Instance} newInstance
   */
  setCurrentInstance(newInstance) {
    if (newInstance !== this.currentInstance) {
      const previous = this.currentInstance;
      this.currentInstance = newInstance;
      this.#engine.emit('currentchange', newInstance, previous);
    }
  }

  /**
   * @param {Instance?} newInstance
   */
  setEnteredInstance(newInstance) {
    if (newInstance !== this.enteredInstance) {
      const previous = this.enteredInstance;
      this.enteredInstance = newInstance;
      this.#engine.emit('currentchange', newInstance, previous);
      this.setCurrentStep(null);
      this.setSelectedStep(null);
    }

    if (newInstance) this.setCurrentInstance(newInstance);
  }

  /**
   * @param {AnyStep?} step
   */
  setCurrentStep(step) {
    if (step !== this.currentStep) {
      this.#engine.tools.selected?.abort();
      const previous = this.currentStep;
      if (step && this.enteredInstance !== this.currentInstance) {
        this.currentStep = null;
        this.setEnteredInstance(this.currentInstance);
      }
      this.currentStep = step;
      this.#engine.emit('stepchange', step, previous, false);
    }
  }

  /**
   * @param {AnyStep?} step
   */
  setSelectedStep(step) {
    if (step !== this.selectedStep) {
      const previous = this.selectedStep;
      this.selectedStep = step;
      this.#engine.emit('stepchange', step, previous, true);
    }
  }

  /**
   * @param {Body?} body
   */
  setSelectedBody(body) {
    if (body !== this.selectedBody) {
      const previous = this.selectedBody;
      this.selectedBody = body;
      this.#engine.emit('selectedbodychange', body, previous);
    }
  }

  /**
   * @param {Readonly<Uint32Array>} ids
   */
  hoverOver([instanceId, faceId, lineId, pointId]) {
    if ((instanceId || this.hoveredInstance) && instanceId !== this.hoveredInstance?.Id.int) {
      this.hoveredInstance = instanceId
        ? this.#engine.entities.getFirstByTypeAndIntId(Instance, instanceId) ?? null
        : null;
    }

    this.hoveredFaceIndex = null;
    this.hoveredLineIndex = null;
    this.hoveredPointIndex = null;

    if (!this.hoveredInstance || this.hoveredInstance !== this.enteredInstance) return;

    if (pointId > 0) this.hoveredPointIndex = pointId - 1;
    else if (lineId > 0) this.hoveredLineIndex = lineId - 1;
    else if (faceId > 0) this.hoveredFaceIndex = faceId;
  }

  /**
   * @param {Readonly<Uint8Array | Uint8ClampedArray>} id4u
   */
  hoverConstraint(id4u) {
    if (this.hoveredLineIndex !== null || this.hoveredPointIndex !== null) return;
    const id = Id.uuuuToInt(id4u);
    this.hoveredConstraintIndex = id > 0 ? id - 1 : null;
  }

  /**
   * @param {ReadonlyVec3} position
   */
  hover(position) {
    vec3.copy(this.hovered, position);

    vec3.transformMat4(this.hoveredView, position, this.#engine.camera.world);
    this.hoveredView[2] = -this.hoveredView[2];
  }

  /**
   * @param {ReadonlyVec3} normal
   */
  setAxis(normal) {
    vec3.copy(this.axisNormal, normal);
  }

  /**
   * @returns {string}
   */
  export() {
    /** @type {Body[]} */
    const orderedBodies = [];
    const bodies = this.#engine.entities.values(Body);

    /**
     * @param {Body} body
     */
    const addBody = (body) => {
      if (orderedBodies.includes(body)) return;
      body.listSteps(SubInstance).forEach(({ subBody }) => addBody(subBody));
      orderedBodies.push(body);
    };

    bodies.forEach(addBody);

    /** @type {SceneState} */
    const state = {
      bodies: orderedBodies.map(body => body.State.export()),
      instances: this.#engine.entities.values(Instance)
        .filter(instance => !SubInstance.getParent(instance)).map(instance => instance.State.export()),
    };

    return JSON.stringify(state);
  }

  /**
   * @param {string} sceneData
   */
  import(sceneData) {
    /** @type {SceneState} */
    const state = JSON.parse(sceneData);

    this.reset(false);

    /** @type {Record<string, Body>} */
    const bodies = {};

    for (const bodyState of state.bodies) {
      bodies[bodyState.id] = this.createBody(bodyState);
    }

    for (const instance of state.instances) {
      bodies[instance.bodyId].instantiate(instance);
    }

    this.#autoSetCurrentInstance();
    this.#engine.emit('scenechange');
  }
}
