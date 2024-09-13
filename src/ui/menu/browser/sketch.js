import Sketch from '../../../engine/cad/sketch.js';

/**
 * @param {Engine} engine
 * @param {import("../../lib/index.js").UITabs} tabs
 */
export default (engine, tabs) => {
  const tab = tabs.addTab('Sketch');
  tab.addContainer().addButton('close sketch', () => engine.scene.setCurrentStep(null));
  tab.hide();

  const table = tab.addTable(2);

  const render = () => {
    const sketch = engine.scene.currentStep;
    if (!(sketch instanceof Sketch)) {
      tab.hide();
      return;
    }
    tab.show(true);
    table.clearChildren();
    tab.rename(`Sketch (${sketch.name})`);
    const elements = sketch.listElements();

    if (elements.length) table.addRow('', 'type').$element({ className: 'disabled' });
    else table.addHeader('', 'No elements yet');

    const { selectedLineIndex, selectedPointIndex } = engine.scene;
    for (let i = 0; i < elements.length; ++i) {
      const lineIndex = sketch.getLineIndex(elements[i]);
      const selected = lineIndex === selectedLineIndex
        || sketch.getPoints(elements[i]).some(e => e.index === selectedPointIndex);

      table.addRow(`${i + 1}`, elements[i].type).$element({
        onclick: () => engine.scene.setSelectedLine(lineIndex),
        style: { fontWeight: selected ? 'bold' : '' },
      });
    }
  };

  render();
  engine.on('selectionchange', render);
  engine.on('stepchange', render);
  engine.on('stepedited', render);
};
