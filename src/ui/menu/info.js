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
    measurementsInput.disabled = !engine.tools.selected || !('value' in engine.tools.selected);
  });
  engine.on('toolinactive', () => {
    measurementsInput.value = '';
    measurementsInput.disabled = true;
  });
  engine.on('scenechange', () => {
    const tool = engine.tools.selected;
    if (tool && 'value' in tool && tool?.value !== undefined) {
      switch (tool?.valueType) {
        case 'angle':
          measurementsInput.value = Properties.stringifyAngle(tool.value, 2);
          break;
        case 'number':
          measurementsInput.value = Properties.stringifyNumber(tool.value, 2);
          break;
        case 'distance':
          measurementsInput.value = Properties.stringifyDistance(tool.value, 2);
          break;
        case 'coord2d':
          measurementsInput.value = Properties.stringifyCoord(tool.value, 2);
          break;
      }
    } else measurementsInput.value = '';

    if (!measurementsInput.disabled) measurementsInput.select();
  });
  measurementsInput.addEventListener('keydown', ({ key }) => {
    const tool = engine.tools.selected;
    if (!tool) return;

    if (key === 'Escape') {
      tool.abort();
      return;
    }

    if (!('value' in tool) || tool.value === undefined || !tool.setValue || key !== 'Enter') return;

    switch (tool.valueType) {
      case 'angle': {
        const value = Properties.parseAngle(measurementsInput.value);
        if (value) tool.setValue(value);
        break;
      }
      case 'number': {
        const value = Properties.parseNumber(measurementsInput.value);
        if (value) tool.setValue(value);
        break;
      }
      case 'distance': {
        const value = Properties.parseDistance(measurementsInput.value);
        if (value !== null) tool.setValue(value);
        break;
      }
      case 'coord2d': {
        const value = Properties.parseCoord2d(measurementsInput.value);
        if (value) tool.setValue(value);
        break;
      }
    }
  });

  return menu;
};
