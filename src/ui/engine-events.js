import { PRIMITIVE_NAME, PRIMITIVE_TYPE } from '../engine/cad/solver/solver.js';
import { Properties } from '../engine/general/properties.js';
import { getCursor } from './assets.js';

const { NUMBER, QUANTITY, STRING, BOOLEAN } = PRIMITIVE_TYPE;

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

    /** @type {import("../engine/cad/solver/solver.js").PrimitiveType?} */
    let formulaType = null;
    switch (property.type) {
      case 'number':
        formulaType = NUMBER;
        break;
      case 'boolean':
        formulaType = BOOLEAN;
        break;
      case 'plain':
        formulaType = STRING;
        break;
      case 'distance':
      case 'angle':
        formulaType = QUANTITY;
        break;
    }

    const submit = () => {
      const formula = input.value;
      if (formulaType !== null) {
        try {
          const result = engine.solver.solve(formula);
          if (result && result.type !== formulaType && (result.type !== NUMBER || formulaType !== QUANTITY)) {
            throw new Error(`Expected ${PRIMITIVE_NAME[formulaType]}, got ${PRIMITIVE_NAME[result.type]} instead`);
          } else if (result && result.type === QUANTITY && result.quantity !== property.type) {
            throw new Error(`Expected ${property.type}, got ${result.quantity} instead`);
          } else if (result) {
            property.value = result.value;
          }
        } catch (e) {
          formulaResult.$container({ innerText: /** @type {Error} */ (e).message, className: 'error' });
          return;
        }
      } else {
        property.value = Properties.parse(formula, property.type) ?? property.value;
      }
      /** @type {(value: typeof property["value"], formula: string) => void} */ (callback)(property.value, formula);
      window.remove();
    };

    let skipParsing = false;

    const value = 'formula' in property && property.formula !== undefined
      ? property.formula
      : Properties.stringify(property);

    const input = property.type === 'color'
      ? window.addContainer().addColorPicker(value)
      : window.addContainer().addInput(value, { onkeydown: ({ key }) => {
        if (key === 'Enter') {
          submit();
          skipParsing = true;
        }
      }});

    const formulaResult = window.addContainer();
    if (formulaType !== null) {
      input.$element({ oninput: () => {
        if (skipParsing) {
          skipParsing = false;
          return;
        }

        formulaResult.$container({ innerText: '', className: '' });

        try {
          const result = engine.solver.solve(input.value);
          if (!result) throw new Error();

          switch (result.type) {
            case NUMBER:
              formulaResult.$container({ innerText: Properties.stringify({ ...result, type: 'number' })});
              break;
            case STRING:
              formulaResult.$container({ innerText: Properties.stringify({ ...result, type: 'plain' })});
              break;
            case BOOLEAN:
              formulaResult.$container({ innerText: Properties.stringify({ ...result, type: 'boolean' })});
              break;
            case QUANTITY:
              formulaResult.$container({ innerText: Properties.stringify({ ...result, type: result.quantity })});
              break;
          }
        } catch (_) { }
      } });
    }

    const buttons = window.addContainer();
    buttons.addButton('OK', submit);
    buttons.addButton('Cancel', () => window.remove());
    window.show();
    requestAnimationFrame(() => input.select());
  });

  engine.on('cursorchange', cursor => void(engine.driver.canvas.style.cursor = getCursor(cursor ?? 'default')));
};
