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
 * @typedef {[traitArgs: Args<T>, ...baseArgs: ConstructorParameters<B>]} DerivedArgs
 */

/**
 * @template {Mapping} T
 * @template {Constructor} [B=DefaultConstructor]
 * @typedef {(new(...args: DerivedArgs<T, B>) => InstanceType<B> & Type<T>) & { [K in keyof B]: B[K] }} Derived
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
    return /** @type {Derived<T, B>} */ (class {
      /** @param {DerivedArgs<T, B>} args */
      constructor(...args) {
        applyTraits(/** @type {Type<T>} */ (this), args[0]);
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

/**
 * @template T
 * @param {string} baseName
 * @param {Readonly<T[]>} pool
 * @param {(element: T) => string} extractNameFn
 * @returns {string}
 */
export const generateName = (baseName, pool, extractNameFn) => {
  const names = pool.map(extractNameFn);
  let name = baseName;
  for (let i = 1; ; ++i) {
    if (!names.includes(name)) break;
    name = `${baseName} (${String(i).padStart(3, '0')})`;
  }
  return name;
};

/**
 * @template {object} T
 * @param {T} obj
 * @param {...(keyof T)} keys
 */
export const bindMethods = (obj, ...keys) => {
  keys.forEach(key => {
    const descriptor = Object.getOwnPropertyDescriptor(obj, key);
    if (key === 'constructor' || descriptor?.get) return;

    const prop = obj[key];
    if (typeof prop === 'function') obj[key] = prop.bind(obj);
  });
};

/** @typedef {import("./events-types").AnyEvent} AnyEvent */

/**
 * @template {AnyEvent} [Events=never]
 */
export default class Base {
  /** @typedef {import("./events-types").BasedEvents<Events>} Event */
  /** @typedef {{ event: string, handler: Event[string]["callback"], once: boolean }} EventHandlerData */

  /** @type {EventHandlerData[]} */
  #handlers = [];

  /**
   * @template {Mapping} T
   * @param {T} traits
   * @returns {Derived<T, typeof Base>}
   */
  static implement(traits) {
    return implement(traits, Base);
  }

  constructor() {
    bindMethods(this, 'emit', 'on');
  }

  /**
   * @param {EventHandlerData[]} handlersToRemove
   */
  #removeHandlers(handlersToRemove) {
    for (const handler of handlersToRemove) {
      const index = this.#handlers.indexOf(handler);
      this.#handlers.splice(index, 1);
    }
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

  /**
   * @template {keyof Event} T
   * @param {T} event
   * @param {Event[T]["callback"]} handler
   * @param {boolean} [once]
   */
  on(event, handler, once = false) {
    this.#handlers.push({ event, handler, once });
  }

  /**
   * @template {keyof Event} T
   * @param {T} event
   * @param {Event[T]["params"]} args
   */
  emit(event, ...args) {
    /** @type {EventHandlerData[]} */
    const handlersToRemove = [];

    for (const handler of this.#handlers) {
      if (handler.event !== event) continue;
      try {
        handler.handler(.../** @type {Parameters<Event[T]["callback"]>} */ (args));
      } catch (e) {
        // avoid infinite recursion
        if (event === 'error') {
          const error = new Error('fatal error');
          error.stack = [
            'fatal error',
            `Original Error: ${args[0]} ${/** @type {Error} */ (args[1])?.stack ?? args[1]}`,
            `Caused error inside error handler: ${/** @type {Error} */ (e)?.stack ?? e}`,
            `Caused ${error.stack}`,
          ].join('\n\n');
          throw error;
        }
        this.emit('error', `Caught inside handler for "${event}":`, e);
      }
      if (handler.once) handlersToRemove.push(handler);
    }

    if (handlersToRemove.length) this.#removeHandlers(handlersToRemove);
  }

  /**
   * @template {keyof Event} T
   * @param {T} event
   * @param {Event[T]["callback"]} handler
   */
  off(event, handler) {
    const handlersToRemove = this.#handlers.filter(h => h.event === event && h.handler === handler);
    if (handlersToRemove.length) this.#removeHandlers(handlersToRemove);
  }

  /**
   * @template {keyof Event} T
   * @param {T} event
   * @returns {Event[T]["handler"][]}
   */
  list(event) {
    return this.#handlers.filter(h => h.event === event).map(h => h.handler);
  }
}
