import { UIMenu } from '../../lib/index.js';
import renderActiveTab from './active.js';
import renderBodiesTab from './bodies.js';
import renderDebugTab from './debug.js';
import renderSceneTab from './scene.js';
import renderStepsTab from './steps.js';
import renderCurrentSketchTab from './sketch.js';
import renderSelectedBodyTab from './bodies-selected.js';
import renderSelectedStepTab from './steps-selected.js';
import renderSketchConstraintsTab from './constraints.js';

/**
 * @param {Engine} engine
 * @returns {UIMenu}
 */
export default (engine) => {
  const menu = new UIMenu({ position: 'right' });
  menu.container.classList.add('rightMenu');

  const browser = menu.addTabs('tabContents');
  browser.$container({ className: 'tabContainer' });

  renderCurrentSketchTab(engine, browser);
  renderStepsTab(engine, browser);
  renderSceneTab(engine, browser);
  renderBodiesTab(engine, browser);

  const selected = menu.addTabs('tabContents');
  selected.$container({ className: 'tabContainer' });

  renderSketchConstraintsTab(engine, selected);
  renderSelectedStepTab(engine, selected);
  renderSelectedBodyTab(engine, selected);
  renderActiveTab(engine, selected);
  renderDebugTab(engine, selected);

  return menu;
};
