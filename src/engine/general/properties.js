/** @typedef {Record<string, Record<string, string>>} PropertyData */

export class Properties {
  /** @type {() => PropertyData} */
  #getFn;

  /**
   * @param {() => PropertyData} getFn
   */
  constructor(getFn) {
    this.#getFn = getFn;
  }

  /**
   * @param {PropertyData} [overrides]
   * @returns {PropertyData}
   */
  get(overrides = {}) {
    const out = this.#getFn();

    for (const [category, properties] of Object.entries(overrides)) {
      if (category in out) Object.assign(out[category], properties);
      else out[category] = properties;
    }

    return out;
  }
}
