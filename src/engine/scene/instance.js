/**
 * @typedef Id
 * @property {number} int
 * @property {vec4} vec4
 */

export default class Instance {
  static #lastId = 0;

  /** @type {Id} */
  id;

  /** @type {Model} */
  model;

  /** @type {mat4} */
  trs;

  /** @type {Instance | null} */
  parent;

  /**
   * @param {Model} model 
   * @param {mat4} trs 
   * @param {Instance | null} parent 
   * @param {number} [id] 
   */
  constructor(model, trs, parent, id) {
    this.model = model;
    this.trs = new Float32Array(trs);
    this.parent = parent;

    id ??= ++Instance.#lastId;
    this.id = {
      int: id,
      vec4: new Float32Array([
        ( id        & 255) / 255,
        ((id >>  8) & 255) / 255,
        ((id >> 16) & 255) / 255,
        ((id >> 24) & 255) / 255,
      ]),
    };

  }

  /**
   * @param {Instance} instance 
   */
  belongsTo(instance) {
    /** @type {Instance | null} */
    let potentialChild = this;
    
    while (potentialChild) {
      if (instance === potentialChild) return true;
      potentialChild = potentialChild.parent;
    }

    return false;
  }
}