import Instance from '../scene/instance.js';
import Placement, { defaultTrs } from '../3d/placement.js';
import Body from './body.js';
import Step from './step.js';
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
 * @property {boolean} visibility
 */

// cached structures
const relative = vec3.create();
const transform = mat4.create();

export default class SubInstance extends /** @type {typeof Step<SubInstanceState>} */ (Step) {
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
    if (!args[0].visibility) {
      args[0].visibility = true;
    }
    super(.../** @type {BaseParams} */ (args));

    this.Properties.extend(properties => Properties.merge(properties, this.placement.Properties.map(prop => {
      const newProp = { ...prop };
      const { onEdit } = prop;

      if (onEdit) newProp.onEdit = /** @param {unknown[]} args1 */ (...args1) => {
        /** @type {Function} */ (onEdit)(...args1);
        this.#placementChanged();
      };

      return newProp;
    }), {
      Appearance: {
        Visibility: {
          value: this.data.visibility,
          type: 'boolean',
          onEdit: (visibility) => this.toggleVisibility(visibility),
        },
      },
    }));

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

    for (const child of this.getChildren(instance)) this.#recalculateGlobalTrsOnly(child);
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
  static getChildren(instance) {
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
   * @param {Instance?} child
   * @param {Instance?} parent
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
   * @param {Instance?} child
   * @param {Instance?} parent
   * @returns {Instance?}
   */
  static asDirectChildOf(child, parent) {
    while (child) {
      const childParent = this.getParent(child)?.instance ?? null;
      if (childParent === parent) return child;
      child = childParent;
    }
    return null;
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

      for (const child of this.getChildren(instance)) {
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

    engine.on('instancescaled', (instance, factor) => {
      this.getParent(instance)?.subInstance.scale(factor);
      this.#recalculateGlobalTrs(instance);
    });

    engine.on('instancerotated', (instance, angle, axis) => {
      this.getParent(instance)?.subInstance.rotate(angle, axis);
      this.#recalculateGlobalTrs(instance);
    });

    engine.on('instancevisibility', (instance, visibility) => {
      this.getParent(instance)?.subInstance.toggleVisibility(visibility);
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

    partialChildInstance.Properties.extend(properties => Properties.merge(properties, {
      General: {
        Parent: { value: partialParentInstance.name, type: 'plain' },
      },
      Placement: this.Properties.get().Placement,
    }));

    partialParentInstance._subInstanceChildren ??= [];
    const parentInstance = /** @type {ParentInstance} */ (partialParentInstance);

    partialChildInstance._subInstanceParent = {
      instance: parentInstance,
      body: this.body,
      subInstance: this,
    };

    const childInstance = /** @type {ChildInstance} */ (partialChildInstance);
    childInstance.State.visibility = this.data.visibility;

    parentInstance._subInstanceChildren.push(childInstance);

    this.instances.push(childInstance);
    SubInstance.#recalculateGlobalTrs(childInstance);

    return childInstance;
  }

  #placementChanged() {
    for (const child of this.instances) SubInstance.#recalculateGlobalTrs(child);

    if (!this.instances.length) {
      this.body.recalculateBoundingBox();
    }
    this.engine.emit('scenechange');
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
    this.#placementChanged();
  }

  /**
   * @param {ReadonlyVec3} translation
   */
  translate(translation) {
    this.placement.translate(translation);
    this.#placementChanged();
  }

  /**
   * @param {ReadonlyVec3} factor
   */
  scale(factor) {
    this.placement.scale(factor);
    this.#placementChanged();
  }

  /**
   * @param {number} angle
   * @param {ReadonlyVec3} axis
   */
  rotate(angle, axis) {
    this.placement.rotate(angle, axis);
    this.#placementChanged();
  }

  export() {
    this.data.placement = this.placement.State.export().trs;
    return undefined;
  }

  /**
   * @param {boolean} [forceState]
   */
  toggleVisibility(forceState) {
    forceState ??= !this.data.visibility;
    if (forceState === this.data.visibility) return;

    this.data.visibility = forceState;

    for (const child of this.instances) {
      child.State.visibility = forceState;
    }

    this.engine.emit('scenechange');
  }
}
