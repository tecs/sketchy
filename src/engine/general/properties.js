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
/** @typedef {TypedPropertyData<number, "number">} NumberPropertyData */
/** @typedef {TypedPropertyData<boolean, "boolean">} BooleanPropertyData */
/** @typedef {TypedPropertyData<PlainVec3, "color">} ColorPropertyData */
/** @typedef {TypedPropertyData<vec2, "vec2">} Vec2PropertyData */
/** @typedef {TypedPropertyData<vec3, "vec3">} Vec3PropertyData */
/** @typedef {TypedPropertyData<vec2, "coord2d">} Coord2dPropertyData */
/** @typedef {TypedPropertyData<vec3, "coord">} CoordPropertyData */
/** @typedef {TypedPropertyData<number, "angle">} AnglePropertyData */
/** @typedef {TypedPropertyData<number, "distance">} DistancePropertyData */
/** @typedef {PlainPropertyData | BooleanPropertyData | NumberPropertyData} PrimitivePropertiesData */
/** @typedef {PrimitivePropertiesData | Vec2PropertyData | Vec3PropertyData | ColorPropertyData} PlainPropertiesData */
/** @typedef {DistancePropertyData | Coord2dPropertyData | CoordPropertyData} DistancePropertiesData */
/** @typedef {PlainPropertiesData | DistancePropertiesData | AnglePropertyData} PropertyData */
/** @typedef {Record<string, Record<string, PropertyData>>} PropertyDefinitions */
/** @typedef {[property: PropertyData, name: string, category: string]} PropertyMapping */

const RAD_TO_DEG = 180 / Math.PI;

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
    { suffix:   '°', toBase: Math.PI / 180, fromBase: RAD_TO_DEG },
    { suffix: 'deg', toBase: Math.PI / 180, fromBase: RAD_TO_DEG },
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
   * @returns {boolean?}
   */
  static parseBoolean(value) {
    switch(value.toLowerCase().trim()) {
      case '1':
      case 'y':
      case 'yes':
      case 'on':
      case 't':
      case 'true':
        return true;
      case '0':
      case 'n':
      case 'no':
      case 'off':
      case 'f':
      case 'false':
        return false;
    }
    return null;
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
   * @returns {PlainVec3?}
   */
  static parseColor(value) {
    value = value.trim().toUpperCase();
    if (!/^#[0-9A-F]{6}$/.test(value)) return null;

    return [Number(`0x${value.slice(1, 3)}`), Number(`0x${value.slice(3, 5)}`), Number(`0x${value.slice(5)}`)];
  }

  /**
   * @param {string} value
   * @returns {vec2?}
   */
  static parseVec2(value) {
    const components = Properties.parseComponents(value, Properties.parseNumber);
    if (components.length !== 2) return null;

    return vec2.fromValues(components[0], components[1]);
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
      case 'number': return Properties.parseNumber(value);
      case 'vec2': return Properties.parseVec2(value);
      case 'vec3': return Properties.parseVec3(value);
      case 'color': return Properties.parseColor(value);
      case 'coord2d': return Properties.parseCoord2d(value);
      case 'coord': return Properties.parseCoord3d(value);
      case 'angle': return Properties.parseAngle(value);
      case 'distance': return Properties.parseDistance(value);
      case 'boolean': return Properties.parseBoolean(value);
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
   * @param {PlainVec3} value
   * @returns {string}
   */
  static stringifyColor(value) {
    return `#${value.map(i => Math.min(Math.round(i), 255).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
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
      case 'vec2':
      case 'vec3': return Properties.stringifyVec(value, precision);
      case 'color': return Properties.stringifyColor(value);
      case 'coord2d':
      case 'coord': return Properties.stringifyCoord(value, precision);
      case 'angle': return Properties.stringifyAngle(value, precision);
      case 'distance': return Properties.stringifyDistance(value, precision);
      case 'number': return Properties.stringifyNumber(value, precision);
      case 'boolean': return String(value);
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
