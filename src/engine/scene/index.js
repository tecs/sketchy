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

/**
 * @template {string} T
 * @typedef SceneElement
 * @property {T} type
 * @property {number} index
 * @property {Instance} instance
 */

/** @typedef {SceneElement<"point">} Point */
/** @typedef {SceneElement<"line">} Line */
/** @typedef {SceneElement<"instance">} InstanceElement */

/** @typedef {InstanceElement | Line | Point} SceneElements */

export default class Scene extends Base {
  /** @type {Engine} */
  #engine;

  /** @type {SceneElements[]} */
  selection = [];

  /** @type {Instance} */
  currentInstance;

  /** @type {Instance | null} */
  enteredInstance = null;

  /** @type {Instance | null} */
  hoveredInstance = null;

  /** @type {number | null} */
  hoveredLineIndex = null;

  /** @type {number | null} */
  hoveredPointIndex = null;

  /** @type {AnyStep | null} */
  currentStep = null;

  /** @type {AnyStep | null} */
  selectedStep = null;

  /** @type {Body | null} */
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

    engine.on('keyup', (_, keyCombo) => {
      if (keyCombo === 'delete') this.deleteInstances(this.getSelectionByType('instance').map(({ instance }) => instance));
    });
    engine.on('entityadded', (entity) => {
      if (entity instanceof Instance) {
        this.#engine.emit('scenechange');
      }
    });
    engine.on('entityremoved', (entity) => {
      if (!(entity instanceof Instance)) return;

      const deletedSelection = this.getSelectionByType('instance')
        .filter(({ instance }) => SubInstance.belongsTo(instance, entity));

      this.removeFromSelection(deletedSelection);

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

    this.selection = [];
    this.enteredInstance = null;
    this.hoveredInstance = null;
    this.hoveredLineIndex = null;
    this.hoveredPointIndex = null;
    this.currentStep = null;
    this.selectedStep = null;
    this.selectedBody = null;

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
   * @template {SceneElements} T
   * @param {T} el
   * @returns {T | null}
   */
  getSelectedElement(el) {
    if (el instanceof Instance) return this.selection.includes(el) ? el : null;
    for (const selection of this.selection) {
      if (selection instanceof Instance) continue;
      if (el.type === selection.type && el.index === selection.index && el.instance === selection.instance) {
        return /** @type {T} */ (selection);
      }
    }
    return null;
  }

  /**
   * @template {SceneElements["type"]} T
   * @param {T} type
   * @returns {Extract<SceneElements, { type: T }>[]}
   */
  getSelectionByType(type) {
    return /** @type {Extract<SceneElements, { type: T }>[]} */ (this.selection.filter(el => el.type === type));
  }

  clearSelection() {
    const oldSelection = this.selection;
    this.selection = [];
    this.#engine.emit('selectionchange', this.selection, oldSelection);
  }

  /**
   * @param {SceneElements[]} elements
   */
  setSelection(elements) {
    const oldSelection = this.selection;
    this.selection = [];
    for (const element of elements) {
      if (!this.getSelectedElement(element)) this.selection.push(element);
    }
    this.#engine.emit('selectionchange', this.selection, oldSelection);
  }

  /**
   * @param {SceneElements[]} elements
   */
  addToSelection(elements) {
    if (!elements.length) return;

    const oldSelection = this.selection.slice();
    for (const element of elements) {
      if (!this.getSelectedElement(element)) this.selection.push(element);
    }
    this.#engine.emit('selectionchange', this.selection, oldSelection);
  }

  /**
   * @param {SceneElements[]} elements
   */
  removeFromSelection(elements) {
    if (!elements.length) return;

    const oldSelection = this.selection.slice();
    for (const element of elements) {
      const selection = this.getSelectedElement(element);
      if (!selection) continue;
      const index = this.selection.indexOf(selection);
      this.selection.splice(index, 1);
    }
    this.#engine.emit('selectionchange', this.selection, oldSelection);
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
      this.clearSelection();
      this.setCurrentStep(null);
      this.setSelectedStep(null);
    }

    if (newInstance) this.setCurrentInstance(newInstance);
  }

  /**
   * @param {AnyStep | null} step
   */
  setCurrentStep(step) {
    if (step !== this.currentStep) {
      const previous = this.currentStep;
      if (step && this.enteredInstance !== this.currentInstance) {
        this.currentStep = null;
        this.setEnteredInstance(this.currentInstance);
      }
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
   * @param {Body | null} body
   */
  setSelectedBody(body) {
    if (body !== this.selectedBody) {
      const previous = this.selectedBody;
      this.selectedBody = body;
      this.#engine.emit('selectedbodychange', body, previous);
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
    this.hoveredLineIndex = id > 0 ? id - 1 : null;
    this.hoveredPointIndex = null;
  }

  /**
   * @param {Readonly<Uint8Array>} id4u
   */
  hoverPoint(id4u) {
    const id = Id.uuuuToInt(id4u);
    this.hoveredPointIndex = id > 0 ? id - 1 : null;
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
