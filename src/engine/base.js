export default class Base {
  constructor() {
    /** @type {(keyof this)[]} */ (Object.getOwnPropertyNames(Object.getPrototypeOf(this)))
      .forEach(key => {
        const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(this), key);
        if (key === 'constructor' || descriptor?.get) return;

        const prop = this[key];
        if (typeof prop === 'function') this[key] = prop.bind(this);
      });
  }

  /**
   * @template {keyof this} K
   * @param {K} key
   * @returns {this[K]}
   */
  assertProperty(key) {
    if (this[key] === undefined) {
      throw new Error(`Property "${String(key)}" uninitialized`);
    }
    return this[key];
  }
}
