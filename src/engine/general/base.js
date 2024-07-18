/** @typedef {new(...args: never[]) => object} Constructor */
/** @typedef {new() => { toString: () => string }} DefaultConstructor */
/** @typedef {{ [key: string]: Constructor }} Mapping */

/**
 * @template {Mapping} T
 * @template {keyof T} [Key=Exclude<{[K in keyof T]: [K, ConstructorParameters<T[K]>] }[keyof T], [keyof T, []]>[0]]
 * @typedef {{[K in Key]: ConstructorParameters<T[K]> }} Args
 */

/**
 * @template {Mapping} T
 * @typedef {{ [K in keyof T]: InstanceType<T[K]> }} Type
 */

/**
 * @template {Mapping} T
 * @template {Constructor} [B=DefaultConstructor]
 * @typedef {new(traitArgs: Args<T>, ...baseArgs: ConstructorParameters<B>) => InstanceType<B> & Type<T>} Derived
 */

/**
 * @template {Mapping} T
 * @template {Constructor} [B=DefaultConstructor]
 * @param {T} traits
 * @param {B} [Base]
 * @returns {Derived<T, B>}
 */
export const implement = (traits, Base) => {
  /**
   * @param {Type<T>} obj
   * @param {Args<T>} traitArgs
   */
  const applyTraits = (obj, traitArgs) => {
    /** @typedef {keyof Type<T>} Key */
    const keys = /** @type {Key[]} */ (Object.keys(traits));
    for (const key of keys) {
      /** @type {ConstructorParameters<T[Key]> | []} */
      const args = key in traitArgs ? traitArgs[/** @type {keyof Args<T>} */ (key)] : [];
      obj[key] = /** @type {Type<T>[Key]} */ (new traits[key](...args));
    }
  };

  if (!Base) {
    return /** @type {Derived<T>} */ (class {
      /** @param {Args<T>} traitArgs */
      constructor(traitArgs) {
        applyTraits(/** @type {Type<T>} */ (this), traitArgs);
      }
    });
  }

  // @ts-expect-error Unlike TS mixins, these traits support their own constructor parameters
  return class extends Base {
    /**
     * @param {Args<T>} traitArgs
     * @param {ConstructorParameters<B>} baseArgs
     */
    constructor(traitArgs, ...baseArgs) {
      super(...baseArgs);
      applyTraits(/** @type {Type<T>} */ (this), traitArgs);
    }
  };
};

export default class Base {
  /**
   * @template {Mapping} T
   * @param {T} traits
   * @returns {Derived<T, typeof Base>}
   */
  static implement(traits) {
    return implement(traits, Base);
  }

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
