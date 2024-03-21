/**
 * @typedef NumberSetting
 * @property {string} id
 * @property {string} name
 * @property {"int"} type
 * @property {number} value
 * @property {number} defaultValue
 * @property {(newValue: number) => void} set
 * @property {() => number} reset
 *
 * @typedef StringSetting
 * @property {string} id
 * @property {string} name
 * @property {"key"} type
 * @property {string} value
 * @property {string} defaultValue
 * @property {(newValue: string) => void} set
 * @property {() => string} reset
 *
 * @typedef BooleanSetting
 * @property {string} id
 * @property {string} name
 * @property {"toggle"} type
 * @property {boolean} value
 * @property {boolean} defaultValue
 * @property {(newValue: boolean) => void} set
 * @property {() => boolean} reset
 *
 * @typedef {NumberSetting|StringSetting|BooleanSetting} Setting
 */

export default class Config {
  /** @type {Record<string, Readonly<Setting>>} */
  #settings = {};

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
      set(newValue) {
        setting.value = newValue;
      },
      reset() {
        setting.value = value;
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
