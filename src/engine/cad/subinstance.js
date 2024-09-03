import Instance from '../scene/instance.js';
import Placement, { defaultTrs } from '../3d/placement.js';
import Body from './body.js';
import Step from './step.js';
import { implement } from '../general/base.js';
import { Properties } from '../general/properties.js';

const { mat4, vec3 } = glMatrix;

/**
 * @template {import("./step.js").Value} T
 * @typedef {import("./step.js").BaseParams<T>} BaseParamsT
 */

/**
 * @typedef Parent
 * @property {ParentInstance} instance Parent Instance
 * @property {Body} body Parent Body
 * @property {SubInstance} subInstance SubInstance step
 */

/** @typedef {BaseParamsT<SubInstanceState>} BaseParams */
/** @typedef {BaseParamsT<Partial<SubInstanceState>>} PartialBaseParams */
/** @typedef {Instance & { _subInstanceParent: Parent }} ChildInstance */
/** @typedef {Instance & { _subInstanceChildren: ChildInstance[] }} ParentInstance */
/** @typedef {Instance & Partial<ChildInstance>} MaybeChildInstance */
/** @typedef {Instance & Partial<ParentInstance>} MaybeParentInstance */

/**
 * @typedef SubInstanceState
 * @property {string} bodyId
 * @property {PlainMat4} placement
 */

// cached structures
const relative = vec3.create();
const transform = mat4.create();

export default class SubInstance extends implement({
  Properties,
}, /** @type {typeof Step<SubInstanceState>} */ (Step)) {
  /** @type {Body} */
  subBody;

  /** @type {ChildInstance[]} */
  instances = [];

  placement = new Placement();

  /** @param {PartialBaseParams} args */
  constructor(...args) {
    if (!args[0].placement) {
      args[0] = { ...args[0], placement: [...defaultTrs] };
    }
    super({ Properties: [() => ({
      General: { Parent: { value: this.body.name, type: 'plain' } },
      ...this.placement.Properties.get(),
    })] }, .../** @type {BaseParams} */ (args));
    this.#recompute();

    this.subBody = this.assertProperty('subBody');
  }

  /**
   * @param {Instance} instance
   */
  static #recalculateGlobalTrsOnly(instance) {
    const parent = this.getParent(instance);
    if (parent) {
      mat4.multiply(transform, parent.instance.Placement.trs, parent.subInstance.placement.trs);
      instance.Placement.set(transform);
    }

    for (const child of this.#getChildren(instance)) this.#recalculateGlobalTrsOnly(child);
  }

  /**
   * @param {Instance} instance
   */
  static #recalculateGlobalTrs(instance) {
    this.#recalculateGlobalTrsOnly(instance);
    this.getParent(instance)?.body.recalculateBoundingBox();
  }

  /**
   * @param {MaybeParentInstance} instance
   * @returns {ChildInstance[]}
   */
  static #getChildren(instance) {
    return instance._subInstanceChildren ?? [];
  }

  /**
   * @param {Body} body
   * @returns {Body[]}
   */
  static #getAllParents(body) {
    return body.instances
      .flatMap(instance => {
        const parent = this.getParent(instance);
        return (parent ? this.#getAllParents(parent.body).concat(parent.body) : []);
      })
      .filter((v, i, a) => a.indexOf(v) === i);
  }

  static getType() {
    return 'SubInstance';
  }

  /**
   * @param {MaybeChildInstance} instance
   * @returns {Parent|undefined}
   */
  static getParent(instance) {
    return instance._subInstanceParent;
  }

  /**
   * @param {Instance | null} child
   * @param {Instance | null} parent
   * @returns {boolean}
   */
  static belongsTo(child, parent) {
    if (!parent) return true;

    while (child) {
      if (parent === child) return true;
      child = this.getParent(child)?.instance ?? null;
    }

    return false;
  }

  /**
   * @param {Engine} engine
   */
  static register(engine) {
    super.register(engine);

    engine.on('entityadded', instance => {
      if (!(instance instanceof Instance)) return;

      // instantiate children
      for (const childSubInstance of instance.body.listSteps(this)) {
        childSubInstance.#instantiate(instance);
      }
    });

    engine.on('entityremoved', instance => {
      if (!(instance instanceof Instance)) return;

      for (const child of this.#getChildren(instance)) {
        child.body.uninstantiate(child);
      }
    });

    engine.on('boundingboxupdated', (body) => {
      if (!(body instanceof Body)) return;

      for (const subInstance of body.listSteps(this)) {
        body.BoundingBox.expandWithBoundingBox(subInstance.subBody.BoundingBox, subInstance.placement.trs);
      }

      const parentBodies = /** @type {Body[]} */ ([]);
      for (const instance of body.instances) {
        const parentBody = this.getParent(instance)?.body;
        if (!parentBody || parentBodies.includes(parentBody)) continue;
        parentBodies.push(parentBody);
        parentBody.recalculateBoundingBox();
      }
    });

    engine.on('instancetransformed', (instance, transformation) => {
      const parent = this.getParent(instance);
      if (parent) {
        parent.instance.Placement.toLocalTransformation(transform, transformation);
        parent.subInstance.transform(transform);
      }

      this.#recalculateGlobalTrs(instance);
    });

    engine.on('instancetranslated', (instance, translation) => {
      const parent = this.getParent(instance);
      if (parent) {
        parent.instance.Placement.toLocalRelativeCoords(relative, translation);
        parent.subInstance.translate(relative);
      }

      this.#recalculateGlobalTrs(instance);
    });
  }

  #recompute() {
    const subBody = this.engine.entities.getByType(Body, this.data.bodyId);
    if (!subBody) {
      const message = `Body with ID#${this.data.bodyId} does not exist`;
      this.body.emit('usererror', message);
      throw new Error(message);
    }

    this.subBody = subBody;

    if (this.body === this.subBody || SubInstance.#getAllParents(this.body).includes(this.subBody)) {
      const message = 'Cannot add body to itself';
      this.body.emit('usererror', message);
      throw new Error(message);
    }

    this.placement.set(this.data.placement);

    for (const parent of this.body.instances) {
      this.#instantiate(parent);
    }
  }

  /**
   * @param {MaybeParentInstance} partialParentInstance
   * @returns {ChildInstance}
   */
  #instantiate(partialParentInstance) {
    const partialChildInstance = /** @type {MaybeChildInstance} */ (this.subBody.instantiate());

    partialParentInstance._subInstanceChildren ??= [];
    const parentInstance = /** @type {ParentInstance} */ (partialParentInstance);

    partialChildInstance._subInstanceParent = {
      instance: parentInstance,
      body: this.body,
      subInstance: this,
    };

    const childInstance = /** @type {ChildInstance} */ (partialChildInstance);

    parentInstance._subInstanceChildren.push(childInstance);

    this.instances.push(childInstance);
    SubInstance.#recalculateGlobalTrs(childInstance);

    return childInstance;
  }

  recompute() {
    super.recompute();
    this.#recompute();
  }

  uninit() {
    for (const instance of this.instances) {
      instance.body.uninstantiate(instance);
    }
  }

  /**
   * @param {ReadonlyMat4} transformation
   */
  transform(transformation) {
    this.placement.transform(transformation);
    for (const child of this.instances) SubInstance.#recalculateGlobalTrs(child);
    if (!this.instances.length) {
      this.body.recalculateBoundingBox();
    }
  }

  /**
   * @param {ReadonlyVec3} translation
   */
  translate(translation) {
    this.placement.translate(translation);
    for (const child of this.instances) SubInstance.#recalculateGlobalTrs(child);

    if (!this.instances.length) {
      this.body.recalculateBoundingBox();
    }
  }

  export() {
    this.data.placement = this.placement.State.export().trs;
    return undefined;
  }
}
