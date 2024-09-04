import renderProperties from './render-properties.js';

/**
 * @param {Engine} engine
 * @param {import("../../lib/index.js").UITabs} tabs
 */
export default (engine, tabs) => {
  const tab = tabs.addTab('Selected step');
  tab.hide();

  const render = () => {
    const step = engine.scene.selectedStep;
    if (!step) {
      tab.hide();
      return;
    }
    tab.show(true);
    tab.clearChildren();
    tab.rename(`Selected step (${step.name})`);

    renderProperties(step.Properties.get(), tab);
  };

  render();
  engine.on('stepchange', render);
  engine.on('stepedited', render);
};
