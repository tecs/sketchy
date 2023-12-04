/**
 * @typedef Id
 * @property {number} int
 * @property {vec4} vec4
 */

// cached structures
const origin = new Float32Array(3);
const relative = new Float32Array(3);
const translate = new Float32Array(16);

export default class Instance {
  static #lastId = 0;

  /** @type {Engine} */
  #engine;

  /** @type {Id} */
  id;

  /** @type {Model} */
  model;

  /** @type {import("./model").SubModel} */
  subModel;

  /** @type {mat4} */
  globalTrs;

  /** @type {mat4} */
  inverseGlobalTrs;

  /** @type {Instance | null} */
  parent;

  /** @type {Instance[]} */
  children = [];

  /**
   * @param {Model} model
   * @param {import("./model").SubModel} subModel
   * @param {Instance | null} parent
   * @param {Engine} engine
   */
  constructor(model, subModel, parent, engine) {
    this.#engine = engine;
    this.subModel = subModel;
    this.globalTrs = engine.math.mat4.create();
    this.inverseGlobalTrs = engine.math.mat4.create();
    this.model = model;
    this.parent = parent;

    const id = ++Instance.#lastId;
    this.id = {
      int: id,
      vec4: engine.math.vec4.fromValues(
        /* eslint-disable no-multi-spaces,space-in-parens */
        ( id        & 255) / 255,
        ((id >>  8) & 255) / 255,
        ((id >> 16) & 255) / 255,
        ((id >> 24) & 255) / 255,
        /* eslint-enable no-multi-spaces,space-in-parens */
      ),
    };

    this.recalculateGlobalTrs();
  }

  recalculateGlobalTrs() {
    const { mat4 } = this.#engine.math;

    if (this.parent) mat4.multiply(this.globalTrs, this.parent.globalTrs, this.subModel.trs);
    else mat4.copy(this.globalTrs, this.subModel.trs);
    mat4.invert(this.inverseGlobalTrs, this.globalTrs);

    for (const child of this.children) child.recalculateGlobalTrs();
  }

  /**
   * @param {Instance | null} instance
   * @returns {boolean}
   */
  belongsTo(instance) {
    if (!instance) return true;

    /** @type {Instance | null} */
    let potentialChild = this;

    while (potentialChild) {
      if (instance === potentialChild) return true;
      potentialChild = potentialChild.parent;
    }

    return false;
  }

  /**
   * @param {vec3} out
   * @param {Readonly<vec3>} globalCoords
   * @returns {vec3}
   */
  toLocalCoords(out, globalCoords) {
    return this.#engine.math.vec3.transformMat4(out, globalCoords, this.inverseGlobalTrs);
  }

  /**
   * @param {vec3} out
   * @param {Readonly<vec3>} globalRelativeCoords
   * @returns {vec3}
   */
  toLocalRelativeCoords(out, globalRelativeCoords) {
    const { vec3, mat4 } = this.#engine.math;

    vec3.transformMat4(out, globalRelativeCoords, this.inverseGlobalTrs);

    mat4.getTranslation(origin, this.inverseGlobalTrs);
    return vec3.subtract(out, out, origin);
  }

  /**
   * @param {vec3} translation
   */
  translateGlobal(translation) {
    const { mat4 } = this.#engine.math;

    this.toLocalRelativeCoords(relative, translation);
    mat4.fromTranslation(translate, relative);

    mat4.multiply(this.subModel.trs, this.subModel.trs, translate);
    for (const sibling of this.subModel.children) sibling.recalculateGlobalTrs();

    this.parent?.model.recalculateBoundingBox();
  }
}
