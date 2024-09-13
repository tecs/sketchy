/** @typedef {import("../../../engine/general/properties").PropertyData} PropertyData */
/**
 * @typedef Unit
 * @property {string} suffix
 * @property {number} toBase
 * @property {number} fromBase
 */

const { vec3 } = glMatrix;

/** @type {Unit[]} */
const DISTANCE_UNITS = [
  { suffix: 'pm', toBase: 1e-9, fromBase: 1e+9 },
  { suffix: 'nm', toBase: 1e-6, fromBase: 1e+6 },
  { suffix: 'um', toBase: 1e-3, fromBase: 1e+3 },
  { suffix: 'mm', toBase: 1e+0, fromBase: 1e+0 },
  { suffix: 'cm', toBase: 1e+1, fromBase: 1e-1 },
  { suffix:  'm', toBase: 1e+3, fromBase: 1e-3 },
  { suffix: 'km', toBase: 1e+6, fromBase: 1e-6 },
];

/** @type {Unit[]} */
const ANGLE_UNITS = [
  { suffix: 'rad', toBase: 1, fromBase: 1 },
  { suffix: 'tau', toBase: 2, fromBase: 0.5 },
  { suffix:   '°', toBase: Math.PI / 180, fromBase: 180 / Math.PI },
  { suffix: 'deg', toBase: Math.PI / 180, fromBase: 180 / Math.PI },
];

/**
 * @param {string} value
 * @param {Unit[]} units
 * @returns {number | null}
 */
const parseUnit = (value, units) => {
  value = value.replace(/\s/g, '');
  const unit = units.filter(({ suffix }) => value.endsWith(suffix))
    .sort((a, b) => a.suffix.length - b.suffix.length)
    .pop();
  if (unit) value = value.slice(0, -unit.suffix.length);

  const distance = parseFloat(value);
  if (typeof distance !== 'number' || Number.isNaN(distance) || !Number.isFinite(distance)) return null;

  return unit ? distance * unit.toBase : distance;
};

/**
 * @param {vec3} value
 * @param {number} [precision]
 * @returns {string}
 */
export const stringifyVec3 = (value, precision) => {
  return precision === undefined ? `[${value.join(', ')}]` : `[${[...value].map(v => v.toFixed(3)).join(', ')}]`;
};

/**
 * @param {number} value
 * @param {number} [precision]
 * @returns {string}
 */
export const stringifyAngle = (value, precision) => {
  value *= 180 / Math.PI;
  return precision === undefined ? `${value}°` : `${value.toFixed(3)}°`;
};

/**
 * @param {number} value
 * @param {number} [precision]
 * @returns {string}
 */
export const stringifyDistance = (value, precision) => {
  const searchValue = Math.abs(value === 0 ? 1 : value * 0.1);
  const unit = DISTANCE_UNITS.find(u => searchValue <= u.toBase) ?? DISTANCE_UNITS[0];
  value *= unit.fromBase;
  return precision === undefined ? `${value}${unit.suffix}` : `${value.toFixed(precision)}${unit.suffix}`;
};

/**
 * @param {string} value
 * @returns {number | null}
 */
export const typifyAngle = (value) => parseUnit(value, ANGLE_UNITS);

/**
 * @param {string} value
 * @returns {number | null}
 */
export const typifyDistance = (value) => parseUnit(value, DISTANCE_UNITS);

/**
 * @template {PropertyData} T
 * @param {string} value
 * @param {T} property
 * @returns {T["value"]}
 */
export const typifyString = (value, property) => {
  switch (property.type) {
    case 'angle': return typifyAngle(value) ?? property.value;
    case 'distance': return typifyDistance(value) ?? property.value;
  }

  return property.value;
};

/**
 * @param {PropertyData} property
 * @param {number} [precision]
 * @returns {string}
 */
export const stringifyValue = ({ type, value, displayValue }, precision) => {
  if (typeof displayValue === 'string') return displayValue;

  switch(type) {
    case 'vec3': return stringifyVec3(value, precision);
    case 'angle': return stringifyAngle(value, precision);
    case 'distance': return stringifyDistance(value, precision);
    case 'plain': return value;
    default: return '<<UNSUPPORTED PROPERTY TYPE>>';
  }
};

/**
 * @param {PropertyData} property
 * @param {import("../../lib").AnyUIContainer} container
 */
export const renderInput = ({ type, value, onEdit }, container) => {
  if (!onEdit) return;

  switch (type) {
    case 'vec3': {
      /**
       * @param {0|1|2} component
       * @param {string} str
       */
      const typifyComponent = (component, str) => {
        const newValue = parseFloat(str);
        if (typeof newValue !== 'number' || Number.isNaN(newValue) || !Number.isFinite(newValue)) return;
        if (newValue === value[component]) return;

        const newVec = vec3.clone(value);
        newVec[component] = newValue;

        onEdit(newVec);
      };
      const x = container.addInput(`${value[0]}`, { onchange: () => typifyComponent(0, x.value) });
      const y = container.addInput(`${value[1]}`, { onchange: () => typifyComponent(1, y.value) });
      const z = container.addInput(`${value[2]}`, { onchange: () => typifyComponent(2, z.value) });
      break;
    }
    case 'angle': {
      const input = container.addInput(stringifyAngle(value), { onchange: () => {
        const newAngle = typifyAngle(input.value);
        if (newAngle !== null && newAngle !== value) onEdit(newAngle);
      } });
      break;
    }
    case 'distance': {
      const input = container.addInput(stringifyAngle(value), { onchange: () => {
        const newDistance = typifyDistance(input.value);
        if (newDistance !== null && newDistance !== value) onEdit(newDistance);
      } });
      break;
    }
    case 'plain': {
      const input = container.addInput(value, { onchange: () => {
        if (input.value !== value) onEdit(input.value);
      } });
      break;
    }
    default:
      container.addLabel('<<UNSUPPORTED PROPERTY TYPE>>');
  }
};

/**
 * @param {import("../../../engine/general/properties").PropertyDefinitions} propertyData
 * @param {import("../../lib").AnyUIContainer} container
 */
export default (propertyData, container) => {
  for (const [category, properties] of Object.entries(propertyData)) {
    const props = container.addGroup(category).addTable(2);
    for (const [name, property] of Object.entries(properties)) {
      const [, cell] = props.addMixedRow(1, name).cells;
      const label = cell.addLabel(stringifyValue(property, 3));

      if (!property.onEdit) {
        label.$element({ className: 'disabled' });
        continue;
      }

      const editor = cell.addContainer();

      renderInput(property, editor);

      editor.hide();
      label.$element({
        style: { cursor: 'pointer' },
        onclick: () => {
          if (!label.hide() || !editor.show()) {
            editor.hide();
            label.show();
          }
        },
      });
    }
  }
};
