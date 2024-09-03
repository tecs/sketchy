/**
 * @template T
 * @template {string} S
 * @template {unknown[]} [E=[string]]
 * @typedef {{ value: T, displayValue: string, type: S }} TypedPropertyData
 */

/** @typedef {Omit<TypedPropertyData<string, "plain">, "displayValue"> & { displayValue?: string }} PlainPropertyData */
/** @typedef {TypedPropertyData<vec3, "vec3", [component: 0|1|2, value: string]>} Vec3PropertyData */
/** @typedef {TypedPropertyData<number, "angle">} AnglePropertyData */
/** @typedef {PlainPropertyData | Vec3PropertyData | AnglePropertyData} PropertyData */
/** @typedef {Record<string, Record<string, PropertyData>>} PropertyDefinitions */
/** @typedef {[property: PropertyData, name: string, category: string]} PropertyMapping */

export class Properties {
  /** @type {() => PropertyDefinitions} */
  #getFn;

  /**
   * @param {() => PropertyDefinitions} getFn
   */
  constructor(getFn) {
    this.#getFn = getFn;
  }

  /**
   * @param {PropertyDefinitions} [overrides]
   * @returns {PropertyDefinitions}
   */
  get(overrides = {}) {
    const out = this.#getFn();

    for (const [category, properties] of Object.entries(overrides)) {
      if (category in out) Object.assign(out[category], properties);
      else out[category] = properties;
    }

    return out;
  }

  /**
   * @param {(...args: PropertyMapping) => PropertyData | PropertyMapping} mapFn
   * @returns {PropertyDefinitions}
   */
  map(mapFn) {
    const out = /** @type {PropertyDefinitions} */ ({});
    const definitions = this.#getFn();

    for (const [category, properties] of Object.entries(definitions)) {
      for (const [name, property] of Object.entries(properties)) {
        const mapped = mapFn(property, name, category);
        const [newProperty, newName, newCategory] = Array.isArray(mapped) ? mapped : [mapped, name, category];
        out[newCategory] ??= {};
        out[newCategory][newName] = newProperty;
      }
    }

    return out;
  }
}
