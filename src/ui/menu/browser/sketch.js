import Sketch from '../../../engine/cad/sketch.js';

/**
 * @param {Engine} engine
 * @param {import("../../lib/index.js").UITabs} tabs
 */
export default (engine, tabs) => {
  const { editor: { selection }, scene } = engine;
  const tab = tabs.addTab('Sketch');
  tab.addContainer().addButton('close sketch', () => scene.setCurrentStep(null)).$element({ style: { marginBottom: '1em' }});
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
      const id = sketch.getLineId(elements[i]);
      if (id === null) continue;

      const selected = !!selection.getElement({ type: 'line', id, instance })
        || sketch.getPoints(elements[i]).some(e => selection.getElement({ type: 'point', id: e.id, instance }));

      table.addRow(`${i + 1}`, elements[i].type).$element({
        onclick: () => selection.set({ type: 'line', id, instance }),
        style: { fontWeight: selected ? 'bold' : '' },
      });
    }
  };

  render();
  engine.on('selectionchange', render);
  engine.on('stepchange', render);
  engine.on('stepedited', render);
};
