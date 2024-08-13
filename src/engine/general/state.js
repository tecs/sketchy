/** @typedef {boolean | number | string | null} Primitive */
/** @typedef {Primitive | PlainObject | PlainArray} Value */
/** @typedef {Value[]} PlainArray */
/** @typedef {{ [key: string]: Value }} PlainObject */

/**
 * @template {Value} T
 * @typedef {() => T | undefined} Exporter
 */

/**
 * @template {Value} T
 * @typedef {(state: T) => void} Importer
 */

/**
 * @template {Value} T
 * @typedef {{ onExport?: Exporter<T>, onImport?: Importer<T> }} Handlers
 */

/**
 * @template {PlainObject} T
 * @typedef {T & State<T>} StateType
 */

/**
 * @template {PlainObject} T
 * @typedef StaticState
 * @property {(defaultState: T) => DefaultStateConstructor<T>} withDefaults
 */

/**
 * @template {PlainObject} T
 * @typedef {(new(initialState: T, handlers?: Handlers<T>) => StateType<T>) & StaticState<T>} StateConstructor
 */

/**
 * @template {PlainObject} T
 * @typedef {(new(initialState?: T, handlers?: Handlers<T>) => StateType<T>) & StaticState<T>} DefaultStateConstructor
 */

/**
 * @template {Value} T
 * @param {T} obj
 * @returns {T}
 */
export const deepCopy = (obj) => {
  if (Array.isArray(obj))
    return /** @type {T} */ (obj.map(element => deepCopy(element)));
  if (typeof obj === 'object' && obj)
    return /** @type {T} */ (Object.keys(obj).reduce((o, key) => ({ ...o, [key]: deepCopy(obj[key])}), {}));
  return obj;
};

/**
 * @template {PlainObject} T
 * @augments T
 */
export default class State {
  /** @type {Exporter<T> | undefined} */
  #onExport;

  /** @type {Importer<T> | undefined} */
  #onImport;

  /** @type {(keyof T)[]} */
  #keys;

  /**
   * @param {T} initialState
   * @param {Handlers<T>} [handlers]
   */
  constructor(initialState, handlers) {
    this.#keys = /** @type {(keyof T)[]} */ (Object.keys(initialState));
    this.#onExport = handlers?.onExport;
    this.#onImport = handlers?.onImport;

    this.import(initialState, false);
  }

  /**
   * @template {PlainObject} T1
   * @param {T1} defaultState
   * @returns {DefaultStateConstructor<T1>}
   */
  static withDefaults(defaultState) {
    /**
     * @augments State<T1>
     */
    class DefaultState extends State {
      /**
       * @param {T1} [initialState]
       * @param {Handlers<T1>} [handlers]
       */
      constructor(initialState = deepCopy(defaultState), handlers) {
        super(initialState, handlers);
      }
    };

    return /** @type {DefaultStateConstructor<T1>} */ (DefaultState);
  }

  /**
   * @returns {T}
   */
  export() {
    const newState = this.#onExport?.();
    if (newState) {
      this.import(newState, false);
    }
    return this.#keys.reduce(
      (obj, key) => Object.assign(obj, { [key]: this[/** @type {keyof State<T>}*/ (key)] }),
      /** @type {T} */ ({}),
    );
  }

  /**
   * @param {T} state
   * @param {boolean} [notify]
   */
  import(state, notify = true) {
    Object.assign(this, state);
    if (notify) this.#onImport?.(state);
  }
};
