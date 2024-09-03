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
    measurementsInput.value = engine.tools.selected?.distance?.map(v => v.toFixed(2)).join(', ') ?? '';
    if (!measurementsInput.disabled) measurementsInput.select();
  });
  measurementsInput.addEventListener('keydown', ({ key }) => {
    if (key === 'Escape') {
      engine.tools.selected?.abort();
      return;
    }

    const distance = engine.tools.selected?.distance;
    if (!distance || !engine.tools.selected?.setDistance || key !== 'Enter') return;

    const newDistance = measurementsInput.value.replace(/[, ]+/g, ' ').trim().split(' ').map(v => parseFloat(v));
    if (newDistance.every(v => !Number.isNaN(v)) && newDistance.length === distance.length) {
      engine.tools.selected.setDistance(newDistance);
    }
  });

  return menu;
};
