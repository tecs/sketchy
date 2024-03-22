/**
 * @template T
 * @template {string} N
 * @typedef BaseSetting
 * @property {string} id
 * @property {string} name
 * @property {N} type
 * @property {T} value
 * @property {T} defaultValue
 * @property {(newValue: T) => void} set
 * @property {() => T} reset
 */

/**
 * @typedef {BaseSetting<number, "int">} NumberSetting
 * @typedef {BaseSetting<string, "key">} StringSetting
 * @typedef {BaseSetting<boolean, "toggle">} BooleanSetting
 * @typedef {NumberSetting|StringSetting|BooleanSetting} Setting
 */

/** @type {(engine: Engine, setting: Setting, current: Setting["value"], previous: Setting["value"] ) => void} */
const forceEmit = (engine, setting, current, previous) => engine.emit(
  'settingchange',
  /** @type {NumberSetting} */(setting),
  /** @type {number} */ (current),
  /** @type {number} */ (previous),
);

export default class Config {
  /** @type {Engine} */
  #engine;

  /** @type {Record<string, Readonly<Setting>>} */
  #settings = {};

  /**
   * @param {Engine} engine
   */
  constructor(engine) {
    this.#engine = engine;
  }

  /**
   * @template {Setting} T
   * @param {string} id
   * @param {string} name
   * @param {T["type"]} type
   * @param {T["value"]} value
   * @returns {Readonly<T>}
   */
  #create(id, name, type, value) {
    if (this.#settings[id]) throw new Error(`Setting "${id}" already exists`);

    const setting = /** @type {T} */ ({
      id,
      name,
      type,
      value,
      defaultValue: value,
      /**
       * @param {typeof setting["value"]} newValue
       */
      set: (newValue) => {
        const oldValue = setting.value;
        setting.value = newValue;
        forceEmit(this.#engine, setting, newValue, oldValue);
      },
      reset: () => {
        const oldValue = setting.value;
        setting.value = value;
        forceEmit(this.#engine, setting, value, oldValue);
        return value;
      },
    });

    this.#settings[id] = setting;

    return setting;
  }

  /**
  * @param {string} id
  * @param {string} name
  * @param {NumberSetting["type"]} type
  * @param {NumberSetting["value"]} value
  * @returns {Readonly<NumberSetting>}
  */
  createNumber(id, name, type, value) {
    return this.#create(id, name, type, value);
  }

  /**
  * @param {string} id
  * @param {string} name
  * @param {StringSetting["type"]} type
  * @param {StringSetting["value"]} value
  * @returns {Readonly<StringSetting>}
  */
  createString(id, name, type, value) {
    return this.#create(id, name, type, value);
  }

  /**
  * @param {string} id
  * @param {string} name
  * @param {BooleanSetting["type"]} type
  * @param {BooleanSetting["value"]} value
  * @returns {Readonly<BooleanSetting>}
  */
  createBoolean(id, name, type, value) {
    return this.#create(id, name, type, value);
  }

  /**
   * @returns {Readonly<Setting>[]}
   */
  list() {
    return Object.values(this.#settings);
  }
}
