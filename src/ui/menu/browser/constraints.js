import Sketch from '../../../engine/cad/sketch.js';
import { stringifyDistance } from './render-properties.js';

/**
 * @param {Engine} engine
 * @param {import("../../lib/index.js").UITabs} tabs
 */
export default (engine, tabs) => {
  const tab = tabs.addTab('Constraints');
  const table = tab.addTable(3);
  tab.hide();

  const render = () => {
    const sketch = engine.scene.currentStep;
    if (!(sketch instanceof Sketch)) {
      tab.hide();
      return;
    }
    tab.show(true);
    tab.rename(`Constraints (${sketch.name})`);
    table.clearChildren();

    const constraints = sketch.listConstraints();

    if (constraints.length) table.addRow('', 'type', 'value');
    else table.addHeader('', 'No constraints yet');

    const { selectedLineIndex, selectedPointIndex } = engine.scene;
    const selectedLine = selectedLineIndex !== null ? sketch.getLine(selectedLineIndex) : null;
    const selectedLineConstraints = selectedLine ? sketch.getConstraints(selectedLine) : [];
    for (let i = 0; i < constraints.length; ++i) {
      const constraint = constraints[i];
      const selected = (selectedPointIndex !== null && constraint.indices.includes(selectedPointIndex))
        || selectedLineConstraints.includes(constraint);

      table.addRow(`${i + 1}`, constraint.type, stringifyDistance(constraint.data, 3)).$element({
        onclick: ({ detail }) => {
          if (detail !== 2) return;
          engine.emit('propertyrequest', { type: 'distance', value: constraint.data });
          engine.on('propertyresponse', (property) => {
            if (property?.type !== 'distance') return;
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
