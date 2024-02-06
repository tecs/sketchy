import Instance from './instance.js';

const { mat4 } = glMatrix;

export default class SubModel {
  /** @type {Model} */
  model;

  /** @type {mat4} */
  trs;

  /** @type {Instance[]} */
  children = [];

  /**
   * @param {Model} model
   * @param {Readonly<mat4>} trs
   */
  constructor(model, trs) {
    this.model = model;
    this.trs = mat4.clone(trs);
  }

  /**
  * @param {Instance | null} parent
  * @param {Instance[]} [seedInstances]
  * @returns {Instance[]}
  */
  instantiate(parent, seedInstances) {
    const instance = seedInstances?.shift() ?? new Instance(this, parent);
    this.children.push(instance);
    parent?.children.push(instance);
    this.model.instances.push(instance);
    const instances = [instance];

    for (const subSubModel of this.model.subModels) {
      instances.push(...subSubModel.instantiate(instance, seedInstances));
    }

    return instances;
  }

  /**
  * @param {Instance | null} parent
  * @returns {Instance[]}
  */
  cleanup(parent) {
    const index = this.children.findIndex(child => child.parent === parent);
    if (index === -1) return [];

    const [instance] = this.children.splice(index, 1);

    const parentIndex = parent?.children.indexOf(instance) ?? -1;
    if (parentIndex !== -1) parent?.children.splice(parentIndex, 1);

    const modelIndex = instance.model.instances.indexOf(instance) ?? -1;
    if (modelIndex !== -1) instance.model.instances.splice(modelIndex, 1);

    const instances = [instance];
    for (const subSubModel of this.model.subModels) {
      instances.push(...subSubModel.cleanup(instance));
    }
    return instances;
  }
}
