import Model from './model.js';
import SubModel from './submodel.js';

const { vec3, mat4 } = glMatrix;

/**
 * @param {Uint8Array} uuuu
 * @returns {number}
 */
const uuuuToInt = (uuuu) => uuuu[0] + (uuuu[1] << 8) + (uuuu[2] << 16) + (uuuu[3] << 24);

/**
 * @typedef SubModelState
 * @property {string} name
 * @property {number[]} trs
 *
 * @typedef ModelState
 * @property {string} name
 * @property {import('./model.js').PlainModelData} data
 * @property {SubModelState[]} children
 *
 * @typedef SceneState
 * @property {ModelState[]} models
 */

export default class Scene {
  /** @type {Engine} */
  #engine;

  /** @type {Map<number, Instance>} */
  #instanceById = new Map();

  /** @type {Model[]} */
  models = [];

  /** @type {Instance | null} */
  currentInstance = null;

  /** @type {Instance | null} */
  selectedInstance = null;

  /** @type {Instance | null} */
  hoveredInstance = null;

  axisNormal = vec3.create();
  hoveredView = vec3.create();
  hovered = vec3.create();

  /**
   * @param {Engine} engine
   */
  constructor(engine) {
    this.#engine = engine;

    this.reset();

    engine.on('mousedown', (button) => {
      if (button === 'left' && !engine.tools.selected.active) engine.tools.selected.start();
    });

    engine.on('mouseup', (button) => {
      if (button === 'left' && engine.tools.selected.active !== false) engine.tools.selected.end();
    });

    engine.on('mousemove', (_, delta) => {
      if (engine.tools.selected.active !== false) engine.tools.selected.update(delta);
    });

    engine.on('toolchange', (_, tool) => {
      if (tool.active !== false) tool.abort();
    });
    engine.on('keyup', (key) => {
      if (key === 'Escape' && engine.tools.selected.active !== false) engine.tools.selected.abort();
      else if (key === 'Delete') this.deleteInstance(this.selectedInstance);
      else if (key.toLowerCase() === 'z' && engine.input.ctrl && engine.input.shift) engine.history.redo();
      else if (key === 'z' && engine.input.ctrl) engine.history.undo();
    });
  }

  reset() {
    this.#instanceById.clear();
    this.models.splice(0);

    vec3.set(this.axisNormal, 0, 1, 0);
    vec3.zero(this.hovered);
    vec3.zero(this.hoveredView);

    this.currentInstance = null;
    this.selectedInstance = null;
    this.hoveredInstance = null;

    this.#engine.history.drop();
    this.#engine.emit('scenechange');
  }

  /**
   * @param {Model} model
   * @param {Readonly<mat4>} trs
   * @returns {Instance}
   */
  instanceModel(model, trs) {
    if (this.currentInstance && model.getAllModels().includes(this.currentInstance.model)) {
      const message = 'Cannot add model to itself';
      this.#engine.emit('usererror', message);
      throw new Error(message);
    }

    if (!this.models.includes(model)) {
      this.models.push(model);
    }

    const subModel = new SubModel(model, trs);
    const instances = this.currentInstance?.model.adopt(subModel) ?? subModel.instantiate(null);

    let index = -1;
    for (let i = 0; i < instances.length; ++i) {
      this.#instanceById.set(instances[i].id.int, instances[i]);
      if (instances[i].parent === this.currentInstance) index = i;
    }

    this.#engine.emit('scenechange');

    return instances[index];
  }

  /**
   * @returns {Instance}
   */
  instanceEmptyModel() {
    return this.instanceModel(new Model('', {}, this.#engine), mat4.create());
  }

  /**
   * @param {Instance | null} instance
   */
  deleteInstance(instance) {
    if (!instance) return;

    const { parent, subModel } = instance;
    const action = this.#engine.history.createAction(
      `Delete instance #${instance.id} from model "${parent?.model.name ?? '[[root]]'}"`,
      {
        instances: /** @type {Instance[]} */ ([]),
      },
    );
    if (!action) return;

    action.append(
      (data) => {
        data.instances = parent?.model.disown(subModel) ?? subModel.cleanup(null);
        for (const deletedInstance of data.instances) {
          if (this.selectedInstance === deletedInstance) {
            this.setSelectedInstance(null);
          }
          this.#instanceById.delete(deletedInstance.id.int);
        }

        this.#engine.emit('scenechange');
      },
      ({ instances }) => {
        if (parent) parent?.model.adopt(subModel, instances.slice());
        else subModel.instantiate(null, instances.slice());
        for (const restoredInstance of instances) {
          this.#instanceById.set(restoredInstance.id.int, restoredInstance);
        }

        this.#engine.emit('scenechange');
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
      this.#engine.emit('selectionchange', newInstance, previous);
    }
  }

  /**
   * @param {Instance | null} newInstance
   */
  setCurrentInstance(newInstance) {
    if (newInstance !== this.currentInstance) {
      const previous = this.currentInstance;
      this.currentInstance = newInstance;
      this.#engine.emit('currentchange', newInstance, previous);
    }
  }

  /**
   * @param {Readonly<Uint8Array>} id4u
   */
  hoverOver(id4u) {
    const id = uuuuToInt(id4u);
    if ((!id && !this.hoveredInstance) || id === this.hoveredInstance?.id.int) return;

    this.hoveredInstance = id ? this.#instanceById.get(id) ?? null : null;
    this.hoveredFace = -1;
    this.hoveredLine = -1;
  }

  /**
   * @param {Readonly<vec3>} position
   */
  hover(position) {
    this.hovered[0] = position[0];
    this.hovered[1] = position[1];
    this.hovered[2] = position[2];

    vec3.transformMat4(this.hoveredView, position, this.#engine.camera.world);
    this.hoveredView[2] = -this.hoveredView[2];
  }

  /**
   * @param {Readonly<vec3>} normal
   */
  setAxis(normal) {
    this.axisNormal[0] = Math.abs(normal[0]);
    this.axisNormal[1] = Math.abs(normal[1]);
    this.axisNormal[2] = Math.abs(normal[2]);
  }

  /**
   * @returns {string}
   */
  export() {
    /** @type {SceneState} */
    const state = {
      models: this.models.map(model => ({
        name: model.name,
        data: {
          vertex: [...model.data.vertex],
          lineVertex: [...model.data.lineVertex],
          normal: [...model.data.normal],
          color: [...model.data.color],
          index: [...model.data.index],
          lineIndex: [...model.data.lineIndex],
          boundingBoxVertex: [...model.data.boundingBoxVertex],
        },
        children: model.subModels.map(subModel => ({
          name: subModel.model.name,
          trs: [...subModel.trs],
        })),
      })),
    };

    return JSON.stringify(state);
  }

  /**
   * @param {string} sceneData
   */
  import(sceneData) {
    /** @type {SceneState} */
    const state = JSON.parse(sceneData);

    this.reset();

    /** @type {Record<string, Model>} */
    const models = {};

    for (const { name, data } of state.models) {
      models[name] = new Model(name, data, this.#engine);
    }

    for (const modelState of state.models) {
      this.setCurrentInstance(models[modelState.name].instances[0]);
      for (const child of modelState.children) {
        this.instanceModel(models[child.name], new Float32Array(child.trs));
      }
    }

    this.setCurrentInstance(null);
    this.#engine.emit('scenechange');
  }
}
