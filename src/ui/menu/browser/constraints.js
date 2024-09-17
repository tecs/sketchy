import Sketch from '../../../engine/cad/sketch.js';
import { stringifyDistance } from './render-properties.js';

/**
 * @param {Engine} engine
 * @param {import("../../lib/index.js").UITabs} tabs
 */
export default (engine, tabs) => {
  const { editor: { selection }, scene } = engine;
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

    const selectedLineConstraints = selection.getByType('line')
      .map(({ index }) => sketch.getLine(index))
      .flatMap(line => line ? sketch.getConstraints(line) : []);

    const selectedPointIndices = selection.getByType('point').map(({ index }) => index);

    for (let i = 0; i < constraints.length; ++i) {
      const constraint = constraints[i];
      const selected = constraint.indices.some(index => selectedPointIndices.includes(index))
        || selectedLineConstraints.includes(constraint);

      table.addRow(`${i + 1}`, constraint.type, constraint.data !== null ? stringifyDistance(constraint.data, 3) : '').$element({
        onclick: ({ detail }) => {
          if (detail !== 2 || constraint.type === 'coincident') return;
          engine.emit('propertyrequest', { type: constraint.type, value: constraint.data });
          engine.on('propertyresponse', (property) => {
            if (property?.type !== 'distance' || property.value <= 0) return;
            constraint.data = property.value;
            sketch.update();
          }, true);
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
