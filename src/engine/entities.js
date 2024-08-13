/** @typedef {import("./general/id").default} Id */
/** @typedef {{ Id: Id }} Obj */
/** @typedef {Id["str"]} Key */

/**
 * @template {Obj} T
 * @typedef {new(...args: never[]) => T} Constructor
 */

export default class Entities {
  /** @type {Engine} */
  #engine;

  /** @type {Map<Key, Obj>} */
  #dataByKey = new Map();

  /** @type {Map<Constructor<Obj>, Obj[]>} */
  #dataByType = new Map();

  /**
   * @param {Engine} engine
   */
  constructor(engine) {
    this.#engine = engine;
  }

  /**
   * @template {Obj} T
   * @param {Constructor<T>} Type
   * @returns {T[]}
   */
  #getBucket(Type) {
    const bucket = this.#dataByType.get(Type);
    if (bucket) {
      return /** @type {T[]} */ (bucket);
    }

    /** @type {T[]} */
    const newBucket = [];
    this.#dataByType.set(Type, newBucket);
    return newBucket;
  }

  /**
   * @param {Obj} entity
   */
  set(entity) {
    const key = entity.Id.str;
    if (this.#dataByKey.has(key)) return;

    this.#dataByKey.set(key, entity);

    this.#getBucket(/** @type {Constructor<Obj>} */ (entity.constructor)).push(entity);

    this.#engine.emit('entityadded', entity);
  }

  /**
   * @param {Key} key
   * @returns {Obj|undefined}
   */
  get(key) {
    return this.#dataByKey.get(key);
  }

  /**
   * @template {Obj} T
   * @param {Constructor<T>} Type
   * @param {Key} key
   * @returns {T|undefined}
   */
  getByType(Type, key) {
    const entity = this.#dataByKey.get(key);
    return entity instanceof Type ? entity : undefined;
  }

  /**
   * @template {Obj} T
   * @param {Constructor<T>} Type
   * @param {number} id
   * @returns {T|undefined}
   */
  getFirstByTypeAndIntId(Type, id) {
    return this.values(Type).find(({ Id }) => Id.int === id);
  }

  /**
   * @template {Obj} T
   * @param {Constructor<T>} Type
   * @returns {Readonly<T[]>}
   */
  values(Type) {
    return this.#getBucket(Type);
  }

  /**
   * @param {Obj|Key} entityOrKey
   */
  delete(entityOrKey) {
    const entity = typeof entityOrKey === 'object' ? entityOrKey : this.get(entityOrKey);
    if (!entity) return;

    const key = entity.Id.str;
    this.#dataByKey.delete(key);

    const bucket = this.#getBucket(/** @type {Constructor<Obj>} */ (entity.constructor));
    const index = bucket.indexOf(entity);
    if (index !== -1) {
      bucket.splice(index, 1);
    }

    this.#engine.emit('entityremoved', entity);
  }

  clear() {
    this.#dataByKey.clear();
    this.#dataByType.clear();
  }
}
