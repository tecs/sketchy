import { UIMenu } from '../../lib/index.js';
import renderFileButtons from './file.js';
import renderHistoryButtons from './history.js';
import renderSettingsButton from './settings.js';

/**
 * @param {Engine} engine
 * @returns {UIMenu}
 */
export default (engine) => {
  const menu = new UIMenu({ position: 'top' });

  renderFileButtons(engine, menu);
  renderHistoryButtons(engine, menu);
  renderSettingsButton(engine, menu);

  return menu;
};
