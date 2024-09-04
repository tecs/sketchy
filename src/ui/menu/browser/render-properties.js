/**
 * @param {import("../../../engine/general/properties").PropertyData} property
 * @returns {string}
 */
const stringifyValue = ({ type, value, displayValue }) => {
  if (typeof displayValue === 'string') return displayValue;

  switch(type) {
    case "vec3": return `[${[...value].map(v => v.toFixed(3)).join(', ')}]`;
    case "angle": return `${value.toFixed(3)}°`;
    case "plain": return value;
    default: return '<<UNSUPPORTED PROPERTY TYPE>>';
  }
};

/**
 * @param {import("../../../engine/general/properties").PropertyData} property
 * @param {import("../../lib").AnyUIContainer} container
 */
const renderInput = ({ type, value, onEdit }, container) => {
  if (!onEdit) return;

  switch (type) {
    case 'vec3': {
      const x = container.addInput(`${value[0]}`, { onchange: () => onEdit(0, x.value) });
      const y = container.addInput(`${value[1]}`, { onchange: () => onEdit(1, y.value) });
      const z = container.addInput(`${value[2]}`, { onchange: () => onEdit(2, z.value) });
      break;
    }
    case 'angle': {
      const input = container.addInput(`${value}`, { onchange: () => onEdit(input.value) });
      break;
    }
    case 'plain': {
      const input = container.addInput(value, { onchange: () => onEdit(input.value) });
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
      const label = cell.addLabel(stringifyValue(property));

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
