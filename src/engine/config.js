/**
 * @typedef Setting
 * @property {string} id
 * @property {string} name
 * @property {"int"} type
 * @property {number} value
 * @property {number} defaultValue
 * @property {(newValue: number) => void} set
 * @property {() => number} reset
 */

export default class Config {
  /** @type {Record<string, Readonly<Setting>>} */
  #settings = {};

  /**
   * @param {string} id
   * @param {string} name
   * @param {Setting["type"]} type
   * @param {Setting["value"]} value
   * @returns {Readonly<Setting>}
   */
  create(id, name, type, value) {
    if (this.#settings[id]) throw new Error(`Setting "${id}" already exists`);

    const setting = /** @type {Setting} */ ({
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
   * @returns {Readonly<Setting>[]}
   */
  list() {
    return Object.values(this.#settings);
  }
}
