import Instance from './instance.js';
import Base from '../general/base.js';
import Id from '../general/id.js';
import Body from '../cad/body.js';
import SubInstance from '../cad/subinstance.js';
import Input from '../input.js';

const { vec3 } = glMatrix;

/** @typedef {import("../cad/body.js").AnyStep} AnyStep */

/**
 * @typedef SceneState
 * @property {import("../cad/body.js").BodyState[]} bodies
 * @property {import("./instance.js").InstanceState[]} instances
 */

/**
 * @typedef SubHovered
 * @property {Model} model
 * @property {"face" | "line" | "point"} type
 * @property {number} id
 */

/**
 * @typedef Hovered
 * @property {Instance} instance
 * @property {SubHovered?} sub
 */

// cached structures
const axisXNormal = vec3.fromValues(1, 0, 0);
const axisYNormal = vec3.fromValues(0, 1, 0);
const axisZNormal = vec3.fromValues(0, 0, 1);

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
  hoveredFaceId = null;

  /** @type {number?} */
  hoveredLineId = null;

  /** @type {number?} */
  hoveredPointId = null;

  /** @type {number?} */
  hoveredConstraintIndex = null;

  /** @type {(0|1|2|3)?} */
  hoveredAxisId = null;

  /** @type {Hovered?} */
  globallyHovered = null;

  /** @type {AnyStep?} */
  currentStep = null;

  /** @type {AnyStep?} */
  selectedStep = null;

  /** @type {Body?} */
  selectedBody = null;

  /** @type {ReadonlyVec3} */
  axisNormal = vec3.create();

  /** @type {ReadonlyVec3?} */
  axisAlignedNormal = null;

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
        engine.emit('scenechange');
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

      engine.emit('scenechange');
    });

    const alignAxisX = engine.config.createString('shortcuts.alignAxisX', 'Align X-Axis', 'key', Input.stringify('right'));
    const alignAxisY = engine.config.createString('shortcuts.alignAxisY', 'Align Y-Axis', 'key', Input.stringify('up'));
    const alignAxisZ = engine.config.createString('shortcuts.alignAxisZ', 'Align Z-Axis', 'key', Input.stringify('left'));
    engine.input.registerShortcuts(alignAxisX, alignAxisY, alignAxisZ);
    engine.on('shortcut', shortcut => {
      if (!engine.tools.selected?.active) return;

      const oldAxis = this.axisAlignedNormal;
      switch (shortcut) {
        case alignAxisX: this.axisAlignedNormal = axisXNormal; break;
        case alignAxisY: this.axisAlignedNormal = axisYNormal; break;
        case alignAxisZ: this.axisAlignedNormal = axisZNormal; break;
        default: return;
      }

      if (oldAxis === this.axisAlignedNormal) this.axisAlignedNormal = null;
      engine.emit('scenechange');
    });
    engine.on('toolinactive', () => void(this.axisAlignedNormal = null));

    engine.on('paste', action => {
      const instances = action.data.elements.filter(({ type }) => type === 'instance').map(({ instance }) => instance);
      if (!instances.length) return;

      const { enteredInstance } = engine.scene;

      const newInstances = /** @type {Instance[]} */ ([]);

      action.append(
        () => {
          for (const instance of instances) {
            const trs = instance.State.export().trs;
            const newInstance = enteredInstance
              ? enteredInstance.body.createStep(SubInstance, { bodyId: instance.body.Id.str, placement: trs })
                .instances
                .find(child => SubInstance.getParent(child)?.instance === enteredInstance)
              : instance.body.instantiate({ trs });

            if (newInstance) newInstances.push(newInstance);
          }

          selection.set(newInstances.map(instance => ({ instance, id: instance.Id.int, type: 'instance' })));
        },
        () => {
          for (const instance of newInstances) {
            const parent = SubInstance.getParent(instance);
            if (!parent) {
              instance.body.uninstantiate(instance);
              return;
            }

            parent.body.removeStep(parent.subInstance);
          }

          newInstances.splice(0);
        },
      );

      action.data.onSuccess.push(() => {
        const { tools } = engine;
        const tool = tools.get('move');
        tools.setTool(tool);
        tool?.start();
      });
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
    this.axisAlignedNormal = null;
    vec3.zero(this.hovered);
    vec3.zero(this.hoveredView);

    if (shouldInstantiateEmptyBody) this.#autoSetCurrentInstance();

    this.setEnteredInstance(null);
    this.hoverOver(new Uint32Array([0, 0, 0, 0]));
    this.hoverConstraint(new Uint8Array([0, 0, 0, 0]));
    this.hoverAxis(null);
    this.setCurrentStep(null);
    this.setSelectedStep(null);
    this.setSelectedBody(null);

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

    this.hoveredFaceId = null;
    this.hoveredLineId = null;
    this.hoveredPointId = null;
    this.hoveredAxisId = null;
    this.globallyHovered = null;

    if (!this.hoveredInstance) return;

    this.globallyHovered = { instance: this.hoveredInstance, sub: null };

    const model = this.hoveredInstance.body.currentModel;

    if (!model) return;

    this.globallyHovered.sub = { model, type: 'face', id: faceId };

    if (pointId > 0) {
      this.globallyHovered.sub.id = pointId;
      this.globallyHovered.sub.type = 'point';
    } else if (lineId > 0) {
      this.globallyHovered.sub.id = lineId;
      this.globallyHovered.sub.type = 'line';
    } else if (faceId === 0) {
      this.globallyHovered.sub = null;
    }

    if (this.hoveredInstance !== this.enteredInstance || !this.globallyHovered.sub) return;

    switch (this.globallyHovered.sub.type) {
      case 'point': this.hoveredPointId = this.globallyHovered.sub.id; break;
      case 'line': this.hoveredLineId = this.globallyHovered.sub.id; break;
      case 'face': this.hoveredFaceId = this.globallyHovered.sub.id; break;
    }
  }

  /**
   * @param {Readonly<Uint8Array | Uint8ClampedArray>} id4u
   */
  hoverConstraint(id4u) {
    if (this.hoveredLineId !== null || this.hoveredPointId !== null) return;
    const id = Id.uuuuToInt(id4u);
    this.hoveredConstraintIndex = id > 0 ? id - 1 : null;
  }

  /**
   * @param {Scene["hoveredAxisId"]} index
   */
  hoverAxis(index) {
    this.hoveredAxisId = index;
    if (index !== null) {
      this.hoveredInstance = null;
      this.hoveredFaceId = null;
      this.hoveredLineId = null;
      this.hoveredPointId = null;
    }
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
   * @param {ReadonlyVec3} normal
   */
  setAxisAligned(normal) {
    this.axisAlignedNormal = vec3.clone(normal);
  }

  /**
   * @param {Instance} instance
   * @returns {boolean}
   */
  isVisible(instance) {
    if (instance === this.enteredInstance || instance.body === this.enteredInstance?.body) return true;
    if (!instance.State.visibility || !instance.body.State.visibility) return false;

    const parent = SubInstance.getParent(instance)?.instance;
    return parent ? this.isVisible(parent) : true;
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
