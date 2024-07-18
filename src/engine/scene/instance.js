import { implement } from '../general/base.js';
import Id from '../general/id.js';

const { mat4, vec3 } = glMatrix;

// cached structures
const origin = vec3.create();
const relative = vec3.create();
const translate = mat4.create();

export default class Instance extends implement({ Id }) {


  /** @type {Model} */
  model;

  /** @type {import("./submodel").default} */
  subModel;

  /** @type {Instance | null} */
  parent;

  /** @type {Instance[]} */
  children = [];

  globalTrs = mat4.create();
  inverseGlobalTrs = mat4.create();

  /**
   * @param {Instance["subModel"]} subModel
   * @param {Instance | null} parent
   */
  constructor(subModel, parent) {
    super({});
    this.subModel = subModel;
    this.model = subModel.model;
    this.parent = parent;


    this.recalculateGlobalTrs();
  }

  recalculateGlobalTrs() {
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
    return vec3.transformMat4(out, globalCoords, this.inverseGlobalTrs);
  }

  /**
   * @param {vec3} out
   * @param {Readonly<vec3>} globalRelativeCoords
   * @returns {vec3}
   */
  toLocalRelativeCoords(out, globalRelativeCoords) {
    vec3.transformMat4(out, globalRelativeCoords, this.inverseGlobalTrs);
    mat4.getTranslation(origin, this.inverseGlobalTrs);
    return vec3.subtract(out, out, origin);
  }

  /**
   * @param {vec3} translation
   */
  translateGlobal(translation) {
    this.toLocalRelativeCoords(relative, translation);
    mat4.fromTranslation(translate, relative);

    mat4.multiply(this.subModel.trs, this.subModel.trs, translate);
    for (const sibling of this.subModel.children) sibling.recalculateGlobalTrs();

    this.parent?.model.recalculateBoundingBox();
  }
}
