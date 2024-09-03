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
    measurementsInput.setAttribute('x-changed', 'false');
    measurementsInput.disabled = true;
  });
  engine.on('scenechange', () => {
    measurementsInput.value = engine.tools.selected?.distance?.map(v => v.toFixed(2)).join(', ') ?? '';
    measurementsInput.setAttribute('x-changed', 'false');
  });
  engine.on('keydown', (key) => {
    const distance = engine.tools.selected?.distance;
    if (!distance || !engine.tools.selected?.setDistance) return;

    switch (key) {
      case 'enter': {
        const newDistance = measurementsInput.value.replace(/[, ]+/g, ' ').trim().split(' ').map(v => parseFloat(v));
        if (newDistance.some(v => typeof v !== 'number') || newDistance.length !== distance.length) return;

        engine.tools.selected.setDistance(newDistance);
        break;
      }
      case 'delete':
        measurementsInput.value = '';
        break;
      case 'backspace':
        measurementsInput.value = measurementsInput.value.substring(0, measurementsInput.value.length - 1);
        break;
    }

    if (key.length === 1) {
      const changed = measurementsInput.getAttribute('x-changed') === 'true';
      measurementsInput.value = changed ? `${measurementsInput.value}${key}` : key;
    }

    measurementsInput.setAttribute('x-changed', 'true');
  });

  return menu;
};
