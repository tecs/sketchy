import { stringifyValue, typifyString } from './menu/browser/render-properties.js';

/**
 * @param {Engine} engine
 * @param {import("./lib").AnyUIContainer} container
 */
export default (engine, container) => {
  engine.on('usererror', (message) => container.addDialog(message));
  // eslint-disable-next-line no-console
  engine.on('error', console.error);

  engine.on('propertyrequest', (property) => {
    /**
     * @param {typeof property} [prop]
     */
    let send = (prop) => {
      send = () => {};
      engine.emit('propertyresponse', prop);
    };

    const window = container.addWindow('Value', () => send());

    const submit = () => {
      property.value = typifyString(input.value, property);
      send(property);
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
};
