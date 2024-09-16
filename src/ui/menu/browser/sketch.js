import Sketch from '../../../engine/cad/sketch.js';

/**
 * @param {Engine} engine
 * @param {import("../../lib/index.js").UITabs} tabs
 */
export default (engine, tabs) => {
  const { scene } = engine;
  const tab = tabs.addTab('Sketch');
  tab.addContainer().addButton('close sketch', () => scene.setCurrentStep(null));
  tab.hide();

  const table = tab.addTable(2);

  const render = () => {
    const sketch = scene.currentStep;
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

    const { enteredInstance: instance } = scene;
    if (!instance) return;

    for (let i = 0; i < elements.length; ++i) {
      const index = sketch.getLineIndex(elements[i]);
      if (!index) continue;

      const selected = scene.getSelectedElement({ type: 'line', index, instance })
        || sketch.getPoints(elements[i]).some(e => scene.getSelectedElement({ type:'point', index: e.index, instance }));

      table.addRow(`${i + 1}`, elements[i].type).$element({
        onclick: () => scene.setSelection([{ type: 'line', index, instance }]),
        style: { fontWeight: selected ? 'bold' : '' },
      });
    }
  };

  render();
  engine.on('selectionchange', render);
  engine.on('stepchange', render);
  engine.on('stepedited', render);
};
