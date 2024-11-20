const { vec2, vec3 } = glMatrix;

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
/** @typedef {TypedPropertyData<vec2, "coord2d">} Coord2dPropertyData */
/** @typedef {TypedPropertyData<vec3, "coord">} CoordPropertyData */
/** @typedef {TypedPropertyData<number, "angle">} AnglePropertyData */
/** @typedef {TypedPropertyData<number, "distance">} DistancePropertyData */
/** @typedef {PlainPropertyData | Vec3PropertyData} PlainPropertiesData */
/** @typedef {DistancePropertyData | Coord2dPropertyData | CoordPropertyData} DistancePropertiesData */
/** @typedef {PlainPropertiesData | DistancePropertiesData | AnglePropertyData} PropertyData */
/** @typedef {Record<string, Record<string, PropertyData>>} PropertyDefinitions */
/** @typedef {[property: PropertyData, name: string, category: string]} PropertyMapping */

const RAD_TO_DEG = Math.PI / 180;

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
    { suffix:   '°', toBase: RAD_TO_DEG, fromBase: 180 / Math.PI },
    { suffix: 'deg', toBase: RAD_TO_DEG, fromBase: 180 / Math.PI },
  ];

  /**
   * @param {() => PropertyDefinitions} getFn
   */
  constructor(getFn) {
    this.#getFn = getFn;
  }

  /**
   * @param {string} value
   * @returns {number?}
   */
  static parseNumber(value) {
    const parsed = parseFloat(value);
    if (Number.isNaN(parsed) || !Number.isFinite(parsed)) return null;
    return parsed;
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

    const distance = Properties.parseNumber(value);
    return unit && distance !== null ? distance * unit.toBase : distance;
  }

  /**
   * @param {string} value
   * @param {(component: string) => number?} parser
   * @returns {number[]}
   */
  static parseComponents(value, parser) {
    return value.trim().replace(/^\[(.+?)\]$/, '$1').split(',').map(parser).filter(n => n !== null);
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
   * @param {string} value
   * @returns {vec3?}
   */
  static parseVec3(value) {
    const components = Properties.parseComponents(value, Properties.parseNumber);
    if (components.length !== 3) return null;

    return vec3.fromValues(components[0], components[1], components[2]);
  }

  /**
   * @param {string} value
   * @returns {vec2?}
   */
  static parseCoord2d(value) {
    const components = Properties.parseComponents(value, Properties.parseDistance);
    if (components.length !== 2) return null;

    return vec2.fromValues(components[0], components[1]);
  }

  /**
   * @param {string} value
   * @returns {vec3?}
   */
  static parseCoord3d(value) {
    const components = Properties.parseComponents(value, Properties.parseDistance);
    if (components.length !== 3) return null;

    return vec3.fromValues(components[0], components[1], components[2]);
  }

  /**
   * @template {PropertyData["type"]} T
   * @param {string} value
   * @param {T} type
   * @returns {Find<PropertyData, "type", T>["value"]?}
   */
  static parse(value, type) {
    switch (type) {
      case 'vec3': return Properties.parseVec3(value);
      case 'coord2d': return Properties.parseCoord2d(value);
      case 'coord': return Properties.parseCoord3d(value);
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
  static stringifyNumber(value, precision) {
    return precision === undefined ? `${value}` : `${value.toFixed(precision)}`;
  }

  /**
   * @param {ReadonlyVec2 | ReadonlyVec3 | number[]} value
   * @param {(component: number, precision?: number) => string} toString
   * @param {number} [precision]
   * @returns {string}
   */
  static stringifyComponents(value, toString, precision) {
    return `[${[...value].map(v => toString(v, precision)).join(', ')}]`;
  }

  /**
   * @param {number} value
   * @param {number} [precision]
   * @returns {string}
   */
  static stringifyDistance(value, precision) {
    const searchValue = Math.abs(value === 0 ? 1 : value * 0.1);
    const unit = Properties.DISTANCE_UNITS.find(u => searchValue <= u.toBase) ?? Properties.DISTANCE_UNITS[0];
    return `${Properties.stringifyNumber(value * unit.fromBase, precision)}${unit.suffix}`;
  }

  /**
   * @param {number} value
   * @param {number} [precision]
   * @returns {string}
   */
  static stringifyAngle(value, precision) {
    return `${Properties.stringifyNumber(value * RAD_TO_DEG, precision)}°`;
  }

  /**
   * @param {ReadonlyVec2 | ReadonlyVec3 | number[]} value
   * @param {number} [precision]
   * @returns {string}
   */
  static stringifyVec(value, precision) {
    return Properties.stringifyComponents(value, Properties.stringifyNumber, precision);
  }

  /**
   * @param {ReadonlyVec2 | ReadonlyVec3 | number[]} value
   * @param {number} [precision]
   * @returns {string}
   */
  static stringifyCoord(value, precision) {
    return Properties.stringifyComponents(value, Properties.stringifyDistance, precision);
  }

  /**
   * @param {Readonly<PropertyData>} property
   * @param {number} [precision]
   * @returns {string}
   */
  static stringify({ type, value, displayValue }, precision) {
    if (typeof displayValue === 'string') return displayValue;

    switch(type) {
      case 'vec3': return Properties.stringifyVec(value, precision);
      case 'coord2d':
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
