import { Properties } from '../../../engine/general/properties.js';

const { vec3 } = glMatrix;

/**
 * @param {import("../../lib").AnyUIContainer} container
 * @param {vec3} value
 * @param {(v: vec3) => void} onEdit
 * @param {(n: number) => string} [stringify]
 * @param {(s: string) => number | null} [parse]
 */
const renderComponents = (container, value, onEdit, stringify = String, parse = parseFloat) => {
  for (let component = /** @type {0 | 1 | 2} */ (0); component < 3; ++component) {
    const c = container.addInput(stringify(value[component]), {
      onchange: () => {
        const newValue = parse(c.value);
        if (typeof newValue !== 'number' || Number.isNaN(newValue) || !Number.isFinite(newValue)) return;
        if (newValue === value[component]) return;

        const newVec = vec3.clone(value);
        newVec[component] = newValue;

        onEdit(newVec);
      },
    });
  }
};

/**
 * @param {import("../../../engine/general/properties.js").PropertyData} property
 * @param {import("../../lib").AnyUIContainer} container
 */
export const renderInput = ({ type, value, onEdit }, container) => {
  if (!onEdit) return;

  switch (type) {
    case 'vec3':
      renderComponents(container, value, onEdit);
      break;
    case 'coord':
      renderComponents(container, value, onEdit, Properties.stringifyDistance, Properties.parseDistance);
      break;
    case 'angle': {
      const input = container.addInput(Properties.stringifyAngle(value), { onchange: () => {
        const newAngle = Properties.parseAngle(input.value);
        if (newAngle !== null && newAngle !== value) onEdit(newAngle);
      } });
      break;
    }
    case 'distance': {
      const input = container.addInput(Properties.stringifyDistance(value), { onchange: () => {
        const newDistance = Properties.parseDistance(input.value);
        if (newDistance !== null && newDistance !== value) onEdit(newDistance);
      } });
      break;
    }
    case 'boolean': {
      const input = container.addInput('', {
        type: 'checkbox',
        checked: value,
        onchange: () => onEdit(input.element.checked),
      });
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
      const label = cell.addLabel(Properties.stringify(property, 3));

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
