import renderProperties from './render-properties.js';

/**
 * @param {Engine} engine
 * @param {import("../../lib/index.js").UITabs} tabs
 */
export default (engine, tabs) => {
  const tab = tabs.addTab('Selected body');
  tab.hide();

  const render = () => {
    const body = engine.scene.selectedBody;
    if (!body) {
      tab.hide();
      return;
    }
    tab.show(true);
    tab.clearChildren();
    tab.rename(`Selected body (${body.name})`);

    renderProperties(body.Properties.get(), tab, engine.history);
  };

  render();
  engine.on('selectedbodychange', render);
  engine.on('bodyedited', render);
};
