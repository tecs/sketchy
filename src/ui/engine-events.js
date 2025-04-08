import { Properties } from '../engine/general/properties.js';
import { getCursor } from './assets.js';

/**
 * @param {Engine} engine
 * @param {import("./lib").AnyUIContainer} container
 */
export default (engine, container) => {
  engine.on('usererror', (message) => void(container.addDialog(message)));
  // eslint-disable-next-line no-console
  engine.on('error', console.error);

  engine.on('propertyrequest', (property, callback) => {
    const window = container.addWindow('Value');

    const submit = () => {
      property.value = Properties.parse(input.value, property.type) ?? property.value;
      /** @type {(value: typeof property["value"]) => void} */ (callback)(property.value);
      window.remove();
    };

    const value = Properties.stringify(property);
    const input = property.type === 'color'
      ? window.addContainer().addColorPicker(value)
      : window.addContainer().addInput(value, { onkeydown: ({ key }) => {
        if (key === 'Enter') submit();
      }});

    const buttons = window.addContainer();
    buttons.addButton('OK', submit);
    buttons.addButton('Cancel', () => window.remove());
    window.show();
    requestAnimationFrame(() => input.select());
  });

  engine.on('cursorchange', cursor => void(engine.driver.canvas.style.cursor = getCursor(cursor ?? 'default')));
};
