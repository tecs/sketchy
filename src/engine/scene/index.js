import Model from './model.js';

/**
 * @param {Uint8Array} uuuu
 * @returns {number}
 */
const uuuuToInt = (uuuu) => uuuu[0] + (uuuu[1] << 8) + (uuuu[2] << 16) + (uuuu[3] << 24);

export default class Scene {
  /** @type {Engine} */
  #engine;

  /** @type {Map<number, Instance>} */
  #instanceById = new Map();

  /** @type {Model[]} */
  models = [];

  /** @type {Model} */
  rootModel;

  /** @type {Instance} */
  rootInstance;

  /** @type {vec3} */
  axisNormal = new Float32Array(3);

  /** @type {vec3} */
  hovered = new Float32Array(3);

  /** @type {vec3} */
  hoveredGlobal = new Float32Array(3);

  /** @type {Model | null} */
  currentModel = null;

  /** @type {Instance | null} */
  currentInstance = null;

  /** @type {Instance | null} */
  selectedInstance = null;

  /** @type {Instance | null} */
  hoveredInstance = null;

  get currentModelWithRoot() {
    return this.currentInstanceWithRoot.model;
  }

  get currentInstanceWithRoot() {
    return this.currentInstance ?? this.rootInstance;
  }

  /**
   * @param {Engine} engine
   */
  constructor(engine) {
    this.#engine = engine;
    this.#reset();

    this.rootModel = new Model('', {}, engine);
    const subModel = { model: this.rootModel, trs: engine.math.mat4.create(), children: [] };
    this.models.push(this.rootModel);

    this.rootInstance = this.rootModel.instantiate(subModel, null, 0)[0];
    this.#instanceById.set(this.rootInstance.id.int, this.rootInstance);

    engine.on('mousedown', (button) => {
      if (button === 'left') engine.tools.selected.start();
    });

    engine.on('mouseup', (button) => {
      if (button === 'left') engine.tools.selected.end();
    });

    engine.on('mousemove', (_, delta) => {
      engine.tools.selected.update(delta);
    });

    engine.on('toolchange', (_, tool) => tool.abort());
    engine.on('keyup', (key) => {
      if (key === 'Escape') engine.tools.selected.abort();
    });
  }

  #reset() {
    this.#instanceById.clear();
    this.models.splice(0);

    const { vec3 } = this.#engine.math;

    vec3.set(this.axisNormal, 0, 1, 0);
    vec3.zero(this.hovered);
    vec3.zero(this.hoveredGlobal);

    this.currentModel = null;
    this.currentInstance = null;
    this.selectedInstance = null;
    this.hoveredInstance = null;
  }

  /**
   *
   * @param {Model} model
   * @param {Readonly<mat4>} trs
   * @returns {Instance}
   */
  instanceModel(model, trs) {
    const currentInstance = this.currentInstanceWithRoot;
    if (model.getAllModels().includes(currentInstance.model)) {
      const message = 'Cannot add model to itself';
      this.#engine.emit('usererror', message);
      throw new Error(message);
    }

    if (!this.models.includes(model)) {
      this.models.push(model);
    }

    const instances = currentInstance.model.adopt(model, trs);

    let instance = currentInstance;
    for (const newInstance of instances) {
      this.#instanceById.set(newInstance.id.int, newInstance);
      if (newInstance.parent === currentInstance) instance = newInstance;
    }

    this.#engine.emit('scenechange');

    return instance;
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
    if (newInstance === this.rootInstance) newInstance = null;
    if (newInstance !== this.currentInstance) {
      const previous = this.currentInstance;
      this.currentInstance = newInstance;
      this.currentModel = newInstance?.model ?? null;
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

    if (!this.hoveredInstance) {
      this.hovered[0] = 0;
      this.hovered[1] = 0;
      this.hovered[2] = 0;
    }
  }

  /**
   * @param {Readonly<vec4>} position
   */
  hover(position) {
    this.#engine.math.vec4.transformMat4(this.hoveredGlobal, position, this.#engine.camera.inverseMvp);

    this.hovered[0] = position[0];
    this.hovered[1] = position[1];
    this.hovered[2] = position[3];
  }

  /**
   * @param {Readonly<vec4>} position
   */
  hoverGlobal(position) {
    this.hoveredGlobal[0] = position[0];
    this.hoveredGlobal[1] = position[1];
    this.hoveredGlobal[2] = position[2];

    this.#engine.math.vec4.transformMat4(this.hovered, position, this.#engine.camera.mvp);
    this.hovered[2] += this.#engine.camera.nearPlane * 2;
  }

  /**
   * @param {Readonly<vec3>} normal
   */
  setAxis(normal) {
    this.axisNormal[0] = Math.abs(normal[0]);
    this.axisNormal[1] = Math.abs(normal[1]);
    this.axisNormal[2] = Math.abs(normal[2]);
  }
}
