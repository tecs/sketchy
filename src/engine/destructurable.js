export default class Destructurable {
  constructor() {
    /** @type {(keyof this)[]} */ (Object.getOwnPropertyNames(Object.getPrototypeOf(this)))
      .forEach(key => {
        const prop = this[key];
        if (key !== 'constructor' && typeof prop === 'function') this[key] = prop.bind(this);
      });
  }
}
