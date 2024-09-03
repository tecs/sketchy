import SubInstance from '../../../engine/cad/subinstance.js';

/**
 * @param {Engine} engine
 * @param {import("../../lib/index.js").UITabs} tabs
 */
export default (engine, tabs) => {
  const tab = tabs.addTab('Info');

  const render = () => {
    const instance = engine.scene.selectedInstance ?? engine.scene.enteredInstance;
    if (!instance) {
      tab.hide();
      return;
    }

    tab.rename(engine.scene.selectedInstance ? 'Selected instance' : 'Active instance');

    tab.show();
    tab.clearChildren();

    const propertyData = instance.Properties.get(SubInstance.getParent(instance)?.subInstance.Properties.get());
    for (const [category, properties] of Object.entries(propertyData)) {
      const props = tab.addGroup(category).addTable(2);
      for (const [name, { value, displayValue, type }] of Object.entries(properties)) {
        props.addMixedRow(1, name).cells[1].addLabel(type === 'plain' ? value : displayValue);
      }
    }
  };

  /**
   * @param {Instance} changedInstance
   */
  const repopulateSelectedMenuOnInstanceChange = (changedInstance) => {
    const selectedInstance = engine.scene.selectedInstance ?? engine.scene.enteredInstance;
    if (changedInstance === selectedInstance) {
      render();
    }
  };

  render();

  engine.on('selectionchange', render);
  engine.on('currentchange', render);
  engine.on('instancetransformed', repopulateSelectedMenuOnInstanceChange);
  engine.on('instancetranslated', repopulateSelectedMenuOnInstanceChange);
};
