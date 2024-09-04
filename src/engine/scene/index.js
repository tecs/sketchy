import Instance from './instance.js';
import Base from '../general/base.js';
import Id from '../general/id.js';
import Body from '../cad/body.js';
import SubInstance from '../cad/subinstance.js';

const { vec3 } = glMatrix;

/** @typedef {import('../cad/body.js').AnyStep} AnyStep */

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

  /** @type {Instance | null} */
  enteredInstance = null;

  /** @type {Instance | null} */
  selectedInstance = null;

  /** @type {Instance | null} */
  hoveredInstance = null;

  /** @type {number | null} */
  selectedLineIndex = null;

  /** @type {number | null} */
  hoveredLineIndex = null;

  /** @type {number | null} */
  selectedPointIndex = null;

  /** @type {number | null} */
  hoveredPointIndex = null;

  /** @type {AnyStep | null} */
  currentStep = null;

  /** @type {AnyStep | null} */
  selectedStep = null;

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

    engine.on('keyup', (_, keyCombo) => {
      if (keyCombo === 'delete') this.deleteInstance(this.selectedInstance);
    });
    engine.on('entityadded', (entity) => {
      if (entity instanceof Instance) {
        this.#engine.emit('scenechange');
      }
    });
    engine.on('entityremoved', (entity) => {
      if (!(entity instanceof Instance)) return;

      if (SubInstance.belongsTo(this.selectedInstance, entity)) {
        this.setSelectedInstance(null);
      }

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
    this.selectedInstance = null;
    this.hoveredInstance = null;

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
   * @param {Instance | null} instance
   */
  deleteInstance(instance) {
    if (!instance) return;

    const entity = SubInstance.getParent(instance)?.subInstance ?? instance;
    const body = entity.body;

    const action = this.#engine.history.createAction(
      `Delete instance of "${instance.body.name}"${entity instanceof SubInstance ? ` from "${body.name}"` : ''}`,
      { entity },
    );
    if (!action) return;

    action.append(
      (data) => {
        if (data.entity instanceof SubInstance) body.removeStep(data.entity);
        else body.uninstantiate(data.entity);
      },
      (data) => {
        data.entity = data.entity instanceof SubInstance
          ? body.createStep(SubInstance, data.entity.State.export().data)
          : body.instantiate(data.entity.State.export());
      },
    );
    action.commit();
  }

  /**
   * @param {Instance | null} newInstance
   */
  setSelectedInstance(newInstance) {
    if (newInstance !== this.selectedInstance) {
      const previous = this.selectedInstance;
      this.selectedInstance = newInstance;
      this.selectedLineIndex = null;
      this.selectedPointIndex = null;
      this.#engine.emit('selectionchange', newInstance, previous);
    }
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
   * @param {Instance | null} newInstance
   */
  setEnteredInstance(newInstance) {
    if (newInstance !== this.enteredInstance) {
      const previous = this.enteredInstance;
      this.enteredInstance = newInstance;
      this.#engine.emit('currentchange', newInstance, previous);
      this.setSelectedInstance(null);
      this.setCurrentStep(null);
      this.setSelectedStep(null);
    }

    if (newInstance) this.setCurrentInstance(newInstance);
  }

  /**
   * @param {number | null} lineIndex
   */
  setSelectedLine(lineIndex) {
    if (this.selectedLineIndex !== lineIndex) {
      this.selectedLineIndex = lineIndex;
      const previous = this.selectedInstance;
      this.selectedInstance = null;
      this.selectedPointIndex = null;
      this.#engine.emit('selectionchange', null, previous);
    }
  }

  /**
   * @param {number | null} pointIndex
   */
  setSelectedPoint(pointIndex) {
    if (this.selectedPointIndex !== pointIndex) {
      this.selectedPointIndex = pointIndex;
      const previous = this.selectedInstance;
      this.selectedInstance = null;
      this.selectedLineIndex = null;
      this.#engine.emit('selectionchange', null, previous);
    }
  }

  /**
   * @param {AnyStep | null} step
   */
  setCurrentStep(step) {
    if (step !== this.currentStep) {
      const previous = this.currentStep;
      this.currentStep = step;
      this.#engine.emit('stepchange', step, previous);
    }
  }

  /**
   * @param {AnyStep | null} step
   */
  setSelectedStep(step) {
    if (step !== this.selectedStep) {
      const previous = this.selectedStep;
      this.selectedStep = step;
      this.#engine.emit('stepchange', step, previous);
    }
  }

  /**
   * @param {Readonly<Uint8Array>} id4u
   */
  hoverOver(id4u) {
    const id = Id.uuuuToInt(id4u);
    if ((!id && !this.hoveredInstance) || id === this.hoveredInstance?.Id.int) return;

    this.hoveredInstance = id ? this.#engine.entities.getFirstByTypeAndIntId(Instance, id) ?? null : null;

    if (!this.hoveredInstance) {
      this.hoveredLineIndex = null;
      this.hoveredPointIndex = null;
    }
  }

  /**
   * @param {Readonly<Uint8Array>} id4u
   */
  hoverLine(id4u) {
    const id = Id.uuuuToInt(id4u);
    this.hoveredLineIndex = id > 0 ? id : null;
    this.hoveredPointIndex = null;
  }

  /**
   * @param {Readonly<Uint8Array>} id4u
   */
  hoverPoint(id4u) {
    const id = Id.uuuuToInt(id4u);
    this.hoveredPointIndex = id > 0 ? id : null;
    this.hoveredLineIndex = null;
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
