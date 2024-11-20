import { Properties } from '../../engine/general/properties.js';
import { UIMenu } from '../lib/index.js';

/**
 * @param {Engine} engine
 * @returns {UIMenu}
 */
export default (engine) => {
  const menu = new UIMenu({ position: 'bottom' });

  menu.addLabel('Measurements');
  const measurementsInput = menu.addInput('', { disabled: true }).element;

  engine.on('toolactive', () => {
    measurementsInput.disabled = !engine.tools.selected?.setDistance;
  });
  engine.on('toolinactive', () => {
    measurementsInput.value = '';
    measurementsInput.disabled = true;
  });
  engine.on('scenechange', () => {
    const distance = engine.tools.selected?.distance;
    if (!distance) measurementsInput.value = '';
    else if (distance.length === 1) measurementsInput.value = Properties.stringifyDistance(distance[0], 2);
    else measurementsInput.value = Properties.stringifyCoord(distance, 2);
    if (!measurementsInput.disabled) measurementsInput.select();
  });
  measurementsInput.addEventListener('keydown', ({ key }) => {
    if (key === 'Escape') {
      engine.tools.selected?.abort();
      return;
    }

    const distance = engine.tools.selected?.distance;
    if (!distance || !engine.tools.selected?.setDistance || key !== 'Enter') return;

    let newDistance = /** @type {number[]?} */ (null);
    switch (distance.length) {
      case 1: {
        const d = Properties.parseDistance(measurementsInput.value);
        if (d !== null) newDistance = [d];
        break;
      }
      case 2: {
        const d = Properties.parseCoord2d(measurementsInput.value);
        if (d) newDistance = [...d];
        break;
      }
      case 3: {
        const d = Properties.parseCoord2d(measurementsInput.value);
        if (d) newDistance = [...d];
        break;
      }
    }

    if (newDistance) {
      engine.tools.selected.setDistance(newDistance);
    }
  });

  return menu;
};
