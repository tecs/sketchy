/**
 * @template T
 * @template {string} S
 * @typedef {{ value: T, displayValue?: string, type: S, onEdit?: (value: T) => void }} TypedPropertyData
 */

/**
 * @typedef Unit
 * @property {string} suffix
 * @property {number} toBase
 * @property {number} fromBase
 */

/** @typedef {TypedPropertyData<string, "plain">} PlainPropertyData */
/** @typedef {TypedPropertyData<vec3, "vec3">} Vec3PropertyData */
/** @typedef {TypedPropertyData<vec3, "coord">} CoordPropertyData */
/** @typedef {TypedPropertyData<number, "angle">} AnglePropertyData */
/** @typedef {TypedPropertyData<number, "distance">} DistancePropertyData */
/** @typedef {PlainPropertyData | Vec3PropertyData} PlainPropertiesData */
/** @typedef {DistancePropertyData | CoordPropertyData} DistancePropertiesData */
/** @typedef {PlainPropertiesData | DistancePropertiesData | AnglePropertyData} PropertyData */
/** @typedef {Record<string, Record<string, PropertyData>>} PropertyDefinitions */
/** @typedef {[property: PropertyData, name: string, category: string]} PropertyMapping */

export class Properties {
  /** @type {() => PropertyDefinitions} */
  #getFn;

  /** @type {Readonly<Unit>[]} */
  static DISTANCE_UNITS = [
    { suffix: 'pm', toBase: 1e-9, fromBase: 1e+9 },
    { suffix: 'nm', toBase: 1e-6, fromBase: 1e+6 },
    { suffix: 'um', toBase: 1e-3, fromBase: 1e+3 },
    { suffix: 'mm', toBase: 1e+0, fromBase: 1e+0 },
    { suffix: 'cm', toBase: 1e+1, fromBase: 1e-1 },
    { suffix:  'm', toBase: 1e+3, fromBase: 1e-3 },
    { suffix: 'km', toBase: 1e+6, fromBase: 1e-6 },
  ];

  /** @type {Readonly<Unit>[]} */
  static ANGLE_UNITS = [
    { suffix: 'rad', toBase: 1, fromBase: 1 },
    { suffix: 'tau', toBase: 2, fromBase: 0.5 },
    { suffix:   '°', toBase: Math.PI / 180, fromBase: 180 / Math.PI },
    { suffix: 'deg', toBase: Math.PI / 180, fromBase: 180 / Math.PI },
  ];

  /**
   * @param {() => PropertyDefinitions} getFn
   */
  constructor(getFn) {
    this.#getFn = getFn;
  }

  /**
   * @param {string} value
   * @param {Readonly<Unit>[]} units
   * @returns {number?}
   */
  static parseUnit(value, units) {
    value = value.replace(/\s/g, '');
    const unit = units.filter(({ suffix }) => value.endsWith(suffix))
      .sort((a, b) => a.suffix.length - b.suffix.length)
      .pop();
    if (unit) value = value.slice(0, -unit.suffix.length);

    const distance = parseFloat(value);
    if (Number.isNaN(distance) || !Number.isFinite(distance)) return null;

    return unit ? distance * unit.toBase : distance;
  }

  /**
   * @param {string} value
   * @returns {number?}
   */
  static parseAngle(value) {
    return Properties.parseUnit(value, Properties.ANGLE_UNITS);
  }

  /**
   * @param {string} value
   * @returns {number?}
   */
  static parseDistance(value) {
    return Properties.parseUnit(value, Properties.DISTANCE_UNITS);
  }

  /**
   * @template {PropertyData["type"]} T
   * @param {string} value
   * @param {T} type
   * @returns {Find<PropertyData, "type", T>["value"]?}
   */
  static parse(value, type) {
    switch (type) {
      case 'angle': return Properties.parseAngle(value);
      case 'distance': return Properties.parseDistance(value);
      case 'plain': return value;
    }

    return null;
  }

  /**
   * @param {number} value
   * @param {number} [precision]
   * @returns {string}
   */
  static stringifyDistance(value, precision) {
    const searchValue = Math.abs(value === 0 ? 1 : value * 0.1);
    const unit = Properties.DISTANCE_UNITS.find(u => searchValue <= u.toBase) ?? Properties.DISTANCE_UNITS[0];
    value *= unit.fromBase;
    return precision === undefined ? `${value}${unit.suffix}` : `${value.toFixed(precision)}${unit.suffix}`;
  };

  /**
   * @param {number} value
   * @param {number} [precision]
   * @returns {string}
   */
  static stringifyAngle(value, precision) {
    value *= 180 / Math.PI;
    return precision === undefined ? `${value}°` : `${value.toFixed(3)}°`;
  };

  /**
   * @param {ReadonlyVec3} value
   * @param {number} [precision]
   * @returns {string}
   */
  static stringifyVec3(value, precision) {
    return precision === undefined ? `[${value.join(', ')}]` : `[${[...value].map(v => v.toFixed(3)).join(', ')}]`;
  };

  /**
   * @param {ReadonlyVec3} value
   * @param {number} [precision]
   * @returns {string}
   */
  static stringifyCoord(value, precision) {
    return `[${[...value].map(component => Properties.stringifyDistance(component, precision)).join(', ')}]`;
  };

  /**
   * @param {Readonly<PropertyData>} property
   * @param {number} [precision]
   * @returns {string}
   */
  static stringify({ type, value, displayValue }, precision) {
    if (typeof displayValue === 'string') return displayValue;

    switch(type) {
      case 'vec3': return Properties.stringifyVec3(value, precision);
      case 'coord': return Properties.stringifyCoord(value, precision);
      case 'angle': return Properties.stringifyAngle(value, precision);
      case 'distance': return Properties.stringifyDistance(value, precision);
      case 'plain': return value;
      default: return '<<UNSUPPORTED PROPERTY TYPE>>';
    }
  }

  /**
   * @param {...PropertyDefinitions} definitions
   * @returns {PropertyDefinitions}
   */
  static merge(...definitions) {
    const out = /** @type {PropertyDefinitions} */ ({});

    for (const overrides of definitions) {
      for (const [category, properties] of Object.entries(overrides)) {
        if (category in out) Object.assign(out[category], properties);
        else out[category] = properties;
      }
    }

    return out;
  }

  /**
   * @param {PropertyDefinitions} [overrides]
   * @returns {PropertyDefinitions}
   */
  get(overrides = {}) {
    return Properties.merge(this.#getFn(), overrides);
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

  /**
   * @param {(prev: PropertyDefinitions) => PropertyDefinitions} next
   */
  extend(next) {
    const prevFn = this.#getFn;
    this.#getFn = () => next(prevFn());
  }
}
