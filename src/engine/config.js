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

/** @typedef {BaseSetting<number, "int">} NumberSetting */
/** @typedef {BaseSetting<string, "key">} StringSetting */
/** @typedef {BaseSetting<boolean, "toggle">} BooleanSetting */
/** @typedef {NumberSetting|StringSetting|BooleanSetting} Setting */
/** @typedef {{ id: string, value: import("./general/state").Primitive }} Override */

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

  /** @type {Setting[]} */
  #settings = [];

  /** @type {Override[]} */
  #overrides = [];

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
    if (!id.includes('.')) id = `general.${id}`;

    if (this.#settings.some(setting => setting.id === id)) throw new Error(`Setting "${id}" already exists`);

    const override = this.#overrides.find(o => o.id === id)?.value;

    const setting = /** @type {T} */ ({
      id,
      name,
      type,
      value: typeof value === typeof override ? override : value,
      defaultValue: value,
      /**
       * @param {T["value"]} newValue
       */
      set: (newValue) => {
        const oldValue = setting.value;
        setting.value = newValue;
        forceEmit(this.#engine, setting, newValue, oldValue);
      },
      reset: () => {
        const oldValue = setting.value;
        setting.value = setting.defaultValue;
        forceEmit(this.#engine, setting, setting.defaultValue, oldValue);
        return setting.defaultValue;
      },
    });

    this.#settings.push(setting);

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
   * @returns {Setting[]}
   */
  list() {
    return this.#settings.toSorted((a, b) => {
      // make sure settings under the "general" namespace appear first
      if (a.id.startsWith('general.')) return -1;
      if (b.id.startsWith('general.')) return 1;
      return this.#settings.indexOf(a) - this.#settings.indexOf(b);
    });
  }

  /**
   * @param {Override[]} overrides
   */
  import(overrides) {
    this.#overrides = overrides;
    for (const { id, value } of overrides) {
      const setting = this.#settings.find(s => s.id === id);
      if (setting && typeof setting.value === typeof value && setting.value !== value) {
        /** @type {BaseSetting<typeof value, string>} */ (setting).set(value);
      };
    }
  }

  /**
   * @returns {Override[]}
   */
  export() {
    return this.#settings.map(({ id, value }) => ({ id, value }));
  }
}
