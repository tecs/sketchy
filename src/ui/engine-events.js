import { stringifyValue, typifyString } from './menu/browser/render-properties.js';

/**
 * @param {Engine} engine
 * @param {import("./lib").AnyUIContainer} container
 */
export default (engine, container) => {
  engine.on('usererror', (message) => container.addDialog(message));
  // eslint-disable-next-line no-console
  engine.on('error', console.error);

  engine.on('propertyrequest', (property, callback) => {
    const window = container.addWindow('Value');

    const submit = () => {
      property.value = typifyString(input.value, property);
      /** @type {(value: typeof property["value"]) => void} */ (callback)(property.value);
      window.remove();
    };

    const input = window.addContainer().addInput(stringifyValue(property), { onkeydown: ({ key }) => {
      if (key === 'Enter') submit();
    }});

    const buttons = window.addContainer();
    buttons.addButton('OK', submit);
    buttons.addButton('Cancel', () => window.remove());
    window.show();
    requestAnimationFrame(() => input.element.select());
  });

  engine.on('cursorchange', cursor => void(engine.driver.canvas.style.cursor = cursor ?? 'default'));
};
