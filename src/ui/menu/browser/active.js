import renderProperties from './render-properties.js';

/**
 * @param {Engine} engine
 * @param {import("../../lib/index.js").UITabs} tabs
 */
export default (engine, tabs) => {
  const { editor: { selection }, scene } = engine;
  const tab = tabs.addTab('Info');

  const render = () => {
    const selectedInstance = selection.getByType('instance').pop()?.instance;
    const instance = selectedInstance ?? scene.enteredInstance;
    if (!instance) {
      tab.hide();
      return;
    }

    tab.rename(selectedInstance ? 'Selected instance' : 'Active instance');

    tab.show();
    tab.clearChildren();

    renderProperties(instance.Properties.get(), tab);
  };

  /**
   * @param {Instance} changedInstance
   */
  const repopulateSelectedMenuOnInstanceChange = (changedInstance) => {
    const selectedInstance = selection.getByType('instance').pop()?.instance;
    const activeInstance = selectedInstance ?? scene.enteredInstance;
    if (changedInstance === activeInstance) {
      render();
    }
  };

  render();

  engine.on('selectionchange', render);
  engine.on('currentchange', render);
  engine.on('instancetransformed', repopulateSelectedMenuOnInstanceChange);
  engine.on('instancetranslated', repopulateSelectedMenuOnInstanceChange);
};
