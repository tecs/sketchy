import { UIMenu } from '../../lib/index.js';
import renderActiveTab from './active.js';
import renderBodiesTab from './bodies.js';
import renderDebug from './debug.js';
import renderSceneTab from './scene.js';
import renderStepsTab from './steps.js';

/**
 * @param {Engine} engine
 * @returns {UIMenu}
 */
export default (engine) => {
  const menu = new UIMenu({ position: 'right' });
  menu.container.classList.add('rightMenu');

  const browser = menu.addTabs('tabContents');
  browser.$container({ className: 'tabContainer' });

  renderStepsTab(engine, browser);
  renderSceneTab(engine, browser);
  renderBodiesTab(engine, browser);

  const selected = menu.addTabs('tabContents');
  selected.$container({ className: 'tabContainer' });

  renderActiveTab(engine, selected);
  renderDebug(engine, selected);

  return menu;
};
