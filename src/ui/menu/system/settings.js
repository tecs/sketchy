import { $ } from '../../lib/element.js';

/**
 * @param {Engine} engine
 * @param {import("../../lib/index.js").AnyUIContainer} container
 */
export default (engine, container) => {
  container.addButton('⚙', () => {
    const settingsWindow = container.addWindow('Settings');
    const settingsWindowContents = settingsWindow.addContainer();

    const tabs = settingsWindowContents.addTabs('settingsContents');
    tabs.$element({ className: 'settings' });
    tabs.$container({ className: 'settingsCategories' });

    /** @type {Record<ReturnType<Engine["config"]["list"]>[number]["type"], string>} */
    const InputTypeMap = {
      int: 'number',
      key: 'text',
      toggle: 'checkbox',
    };

    /** @type {Record<string, import("../../lib/index.js").AnyUIParent>} */
    const tabMap = {};

    /** @type {(el: HTMLElement) => boolean} */
    const forceChange = (el) => el.dispatchEvent(new Event('change'));

    const settingsItems = engine.config.list().map(setting => {
      const el = $('div', { className: `setting${setting.value !== setting.defaultValue ? ' changed' : ''}` });
      const originalValue = String(setting.value);
      const defaultValue = String(setting.defaultValue);

      const [category] = setting.id.split('.');
      tabMap[category] ??= tabs.addTab(category);
      tabMap[category]?.$container({}, [el]);

      const input = $('input', {
        type: InputTypeMap[setting.type],
        value: originalValue,
        checked: setting.type === 'toggle' && setting.value,
        onkeydown({ key, ctrlKey, altKey, shiftKey }) {
          if (setting.type !== 'key') return true;

          // block non-printable keys
          if (key.length !== 1) return false;

          const combo = [key.toLowerCase()];
          if (shiftKey) combo.unshift('shift');
          if (altKey) combo.unshift('alt');
          if (ctrlKey) combo.unshift('control');

          input.value = combo.join(' + ');
          forceChange(input);
          input.blur();

          return false;
        },
        onchange() {
          if (setting.type === 'toggle') el.classList.toggle('changed', input.checked !== setting.defaultValue);
          else el.classList.toggle('changed', input.value !== defaultValue);

          if (setting.type !== 'key') return;

          // make sure there are no shortcut conflicts
          for (const item of settingsItems) {
            if (item.setting !== setting && item.setting.type === 'key' && item.input.value === input.value) {
              item.input.value = '';
              forceChange(item.input);
            }
          }
        },
      });

      $(el, {}, [
        ['label', {}, [['span', { innerText: setting.name }], input]],
        ['div', {
          className: 'button reset',
          innerText: '⟲',
          onclick: () => {
            input.value = defaultValue;
            input.checked = defaultValue === 'true';
            forceChange(input);
          },
        }],
      ]);

      return { setting, originalValue, input };
    });

    const buttons = settingsWindowContents.addContainer({ className: 'settingsButtons' });
    buttons.addButton('save', () => {
      for (const { input, originalValue, setting } of settingsItems) {
        if ((setting.type === 'toggle' ? String(input.checked) : input.value) === originalValue) continue;

        if (setting.type === 'int') setting.set(parseInt(input.value, 10));
        else if (setting.type === 'key') setting.set(input.value);
        else setting.set(input.checked);
      }
      settingsWindow.remove();
    }, { className: 'button' });
    buttons.addButton('close', () => settingsWindow.remove(), { className: 'button' });
  }, 'Settings');
};
