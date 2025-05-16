import Sketch from '../../../engine/cad/sketch.js';
import { Properties } from '../../../engine/general/properties.js';

/** @typedef {(value: number, formula: string) => void} PropHandler */

/**
 * @param {Engine} engine
 * @param {import("../../lib/index.js").UITabs} tabs
 */
export default (engine, tabs) => {
  const { editor: { selection }, history, scene } = engine;
  const tab = tabs.addTab('Constraints');
  const table = tab.addTable(3);
  tab.hide();

  const render = () => {
    const sketch = scene.currentStep;
    if (!(sketch instanceof Sketch)) {
      tab.hide();
      return;
    }
    tab.show(true);
    tab.rename(`Constraints (${sketch.name})`);
    table.clearChildren();

    const constraints = sketch.listConstraints();

    if (constraints.length) table.addRow('', 'type', 'value').$element({ className: 'disabled' });
    else table.addHeader('', 'No constraints yet');

    const selectedConstraints = selection.getByType('constraint').map(({ id }) => id);
    const selectedLineConstraints = selection.getByType('line')
      .map(({ id }) => sketch.getLine(id))
      .flatMap(line => line ? sketch.getConstraints(line) : []);

    const selectedPointIndices = selection.getByType('point').map(({ id }) => id);

    for (let i = 0; i < constraints.length; ++i) {
      const constraint = constraints[i];
      const selected = selectedConstraints.includes(i)
        || constraint.indices.some(index => selectedPointIndices.includes(index))
        || selectedLineConstraints.includes(constraint);

      let displayValue = '';
      let isFormula = false;

      if (typeof constraint.data === 'number') {
        const prop = /** @type {const} */ ({
          type: constraint.type === 'angle' ? 'angle' : 'distance',
          value: constraint.data,
        });

        displayValue = Properties.stringify(prop, 3);

        const formula = constraint.formula.trim();
        isFormula = formula !== String(constraint.data) && formula !== Properties.stringify(prop);
      }

      const row = table.addRow(`${i + 1}`, constraint.type, displayValue).$element({
        onclick: ({ detail }) => {
          if (detail === 1) {
            selection.set({ id: i, type: 'constraint', instance: scene.currentInstance });
            return;
          }
          if (detail !== 2 || typeof constraint.data !== 'number') return;
          const propertyData = /** @type {{ type: "distance", value: number }} */ ({
            type: constraint.type === 'angle' ? 'angle' : 'distance',
            value: constraint.data,
            formula: constraint.formula,
          });
          engine.emit('propertyrequest', propertyData, /** @type {PropHandler} */ ((value, formula) => {
            if (value <= 0 && propertyData.type === 'distance') return;
            if (value === constraint.data && formula === constraint.formula) return;

            const action = history.createAction(`Change value of ${constraint.type} constraint `, {
              oldValue: constraint.data,
              oldFormula: constraint.formula,
            });
            if (!action) return;

            action.append(
              () => {
                constraint.data = value;
                constraint.formula = formula;
                sketch.update();
              },
              ({ oldValue, oldFormula }) => {
                constraint.data = oldValue;
                constraint.formula = oldFormula;
                sketch.update();
              },
            );
            action.commit();
          }));
        },
        style: { fontWeight: selected ? 'bold' : '' },
      });

      if (isFormula) {
        row.children[2].innerHTML += '<sup><em>(fn)</em></sup>';
      }
    }
  };

  render();
  engine.on('selectionchange', render);
  engine.on('stepchange', render);
  engine.on('stepedited', render);
};
