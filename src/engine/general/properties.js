const { vec2, vec3 } = glMatrix;

/**
 * @template T
 * @template {string} S
 * @typedef {{ value: T, displayValue?: string, type: S, onEdit?: (value: T) => void }} TypedPropertyData
 */

/**
 * @template T
 * @template {string} S
 * @typedef {TypedPropertyData<T, S> & { formula?: string }} ParametricPropertyData
 */

/** @typedef {ParametricPropertyData<string, "plain">} PlainPropertyData */
/** @typedef {ParametricPropertyData<number, "number">} NumberPropertyData */
/** @typedef {ParametricPropertyData<boolean, "boolean">} BooleanPropertyData */
/** @typedef {TypedPropertyData<PlainVec3, "color">} ColorPropertyData */
/** @typedef {TypedPropertyData<vec2, "vec2">} Vec2PropertyData */
/** @typedef {TypedPropertyData<vec3, "vec3">} Vec3PropertyData */
/** @typedef {TypedPropertyData<vec2, "coord2d">} Coord2dPropertyData */
/** @typedef {TypedPropertyData<vec3, "coord">} CoordPropertyData */
/** @typedef {ParametricPropertyData<number, "angle">} AnglePropertyData */
/** @typedef {ParametricPropertyData<number, "distance">} DistancePropertyData */
/** @typedef {PlainPropertyData | BooleanPropertyData | NumberPropertyData} PrimitivePropertiesData */
/** @typedef {PrimitivePropertiesData | Vec2PropertyData | Vec3PropertyData | ColorPropertyData} PlainPropertiesData */
/** @typedef {DistancePropertyData | Coord2dPropertyData | CoordPropertyData} DistancePropertiesData */
/** @typedef {PlainPropertiesData | DistancePropertiesData | AnglePropertyData} PropertyData */
/** @typedef {Record<string, Record<string, PropertyData>>} PropertyDefinitions */
/** @typedef {[property: PropertyData, name: string, category: string]} PropertyMapping */

/**
 * @typedef Unit
 * @property {string} suffix
 * @property {number} toBase
 * @property {number} fromBase
 * @property {Exclude<Find<PropertyData, "value", number>["type"], "number">} type
 */

export const RAD_TO_DEG = 180 / Math.PI;
export const DEG_TO_RAD = Math.PI / 180;
export const TAU = Math.PI * 2;

/** @type {Readonly<Unit>[]} */
const DISTANCE_UNITS = [
  { suffix: 'pm', toBase: 1e-9, fromBase: 1e+9, type: 'distance' },
  { suffix: 'nm', toBase: 1e-6, fromBase: 1e+6, type: 'distance' },
  { suffix: 'um', toBase: 1e-3, fromBase: 1e+3, type: 'distance' },
  { suffix: 'mm', toBase: 1e+0, fromBase: 1e+0, type: 'distance' },
  { suffix: 'cm', toBase: 1e+1, fromBase: 1e-1, type: 'distance' },
  { suffix:  'm', toBase: 1e+3, fromBase: 1e-3, type: 'distance' },
  { suffix: 'km', toBase: 1e+6, fromBase: 1e-6, type: 'distance' },
];

/** @type {Readonly<Unit>[]} */
const ANGLE_UNITS = [
  { suffix: 'rad', toBase: 1, fromBase: 1, type: 'angle' },
  { suffix:   '°', toBase: DEG_TO_RAD, fromBase: RAD_TO_DEG, type: 'angle' },
  { suffix: 'deg', toBase: DEG_TO_RAD, fromBase: RAD_TO_DEG, type: 'angle' },
];

/** @type {Readonly<Unit>[]} */
const ALL_UNITS = DISTANCE_UNITS.concat(ANGLE_UNITS);

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
   * @param {string} unit
   * @returns {Unit["type"]?}
   */
  static findType(unit) {
    return ALL_UNITS.find(({ suffix }) => suffix === unit)?.type ?? null;
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
    let angle = Properties.parseUnit(value, ANGLE_UNITS);
    if (angle === null) return null;
    while (angle >= TAU || angle < 0) angle -= TAU * Math.sign(angle);
    return angle;
  }

  /**
   * @param {string} value
   * @returns {number?}
   */
  static parseDistance(value) {
    return Properties.parseUnit(value, DISTANCE_UNITS);
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
    const unit = DISTANCE_UNITS.find(u => searchValue <= u.toBase) ?? DISTANCE_UNITS[0];
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
   * @template {PropertyData} P
   * @param {P} property
   * @returns {P}
   */
  static clone(property) {
    const newProperty = /** @type {P} */ ({ ...property });

    switch (newProperty.type) {
      case 'vec2':
      case 'coord2d':
        newProperty.value = vec2.clone(newProperty.value);
        break;
      case 'vec3':
      case 'coord':
        newProperty.value = vec3.clone(newProperty.value);
        break;
      case 'color':
        newProperty.value = [...newProperty.value];
        break;
    }

    return newProperty;
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
