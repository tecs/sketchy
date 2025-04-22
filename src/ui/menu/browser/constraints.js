import Sketch from '../../../engine/cad/sketch.js';
import { Properties } from '../../../engine/general/properties.js';

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

      table.addRow(
        `${i + 1}`,
        constraint.type,
        constraint.data !== null ? Properties.stringify({
          type: constraint.type === 'angle' ? 'angle' : 'distance',
          value: constraint.data,
        }, 3) : '',
      ).$element({
        onclick: ({ detail }) => {
          if (detail === 1) {
            selection.set({ id: i, type: 'constraint', instance: scene.currentInstance });
            return;
          }
          const isNumeric = ['distance', 'width', 'height', 'angle'].includes(constraint.type);
          if (detail !== 2 || !isNumeric) return;
          const propertyData = /** @type {{ type: "distance", value: number }} */ ({
            type: constraint.type === 'angle' ? 'angle' : 'distance',
            value: constraint.data,
          });
          engine.emit('propertyrequest', propertyData, /** @param {number} value */ (value) => {
            if (value <= 0 && propertyData.type === 'distance') return;
            if (value === constraint.data) return;

            const action = history.createAction(`Change value of ${constraint.type} constraint `, constraint.data);
            if (!action) return;

            action.append(
              () => {
                constraint.data = value;
                sketch.update();
              },
              oldValue => {
                constraint.data = oldValue;
                sketch.update();
              },
            );
            action.commit();
          });
        },
        style: { fontWeight: selected ? 'bold' : '' },
      });
    }
  };

  render();
  engine.on('selectionchange', render);
  engine.on('stepchange', render);
  engine.on('stepedited', render);
};
