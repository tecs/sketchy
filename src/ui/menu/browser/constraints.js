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

    const selectedConstraints = selection.getByType('constraint').map(({ index }) => index);
    const selectedLineConstraints = selection.getByType('line')
      .map(({ index }) => sketch.getLine(index))
      .flatMap(line => line ? sketch.getConstraints(line) : []);

    const selectedPointIndices = selection.getByType('point').map(({ index }) => index);

    for (let i = 0; i < constraints.length; ++i) {
      const constraint = constraints[i];
      const selected = selectedConstraints.includes(i)
        || constraint.indices.some(index => selectedPointIndices.includes(index))
        || selectedLineConstraints.includes(constraint);

      table.addRow(`${i + 1}`, constraint.type, constraint.data !== null ? stringifyDistance(constraint.data, 3) : '').$element({
        onclick: ({ detail }) => {
          if (detail === 1) {
            selection.set({ index: i, type: 'constraint', instance: scene.currentInstance });
            return;
          }
          const isDistance = constraint.type === 'distance' || constraint.type === 'width' || constraint.type === 'height';
          if (detail !== 2 || !isDistance) return;
          engine.emit('propertyrequest', {
            type: 'distance',
            value: constraint.data,
          }, /** @param {number} value */ (value) => {
            if (value <= 0) return;
            constraint.data = value;
            sketch.update();
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
