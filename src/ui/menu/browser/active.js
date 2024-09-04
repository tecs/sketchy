import renderProperties from './render-properties.js';

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

    renderProperties(instance.Properties.get(), tab);
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
