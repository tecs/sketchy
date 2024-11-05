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
      key: 'hidden',
      toggle: 'checkbox',
    };

    /** @type {Record<string, import("../../lib/index.js").AnyUIParent>} */
    const tabMap = {};

    /** @type {(el: HTMLElement, event: string) => boolean} */
    const dispatchEvent = (el, event) => el.dispatchEvent(new Event(event));

    /**
     * @param {HTMLElement} el
     * @param {string} keyCombo
     */
    const renderKeyCombo = (el, keyCombo) => {
      const elements = /** @type {import("../../lib/element.js").Opts[2] & {}} */ ([]);

      const combo = keyCombo !== '' ? keyCombo.split(' + ') : [];
      for (const key of combo) {
        if (key !== combo[0]) {
          elements.push(['span', { innerText: '+' }]);
        }
        elements.push(['kbd', { innerText: key === ' ' ? 'space' : key }]);
      }

      if (elements.length === 0) elements.push(['em', { innerText: '<unset>' }]);

      $(el, { innerHTML: '' }, elements);
    };

    const settingsItems = engine.config.list().map(setting => {
      const el = $('div', { className: `setting${setting.value !== setting.defaultValue ? ' changed' : ''}` });
      const originalValue = String(setting.value);
      const defaultValue = String(setting.defaultValue);

      const [category] = setting.id.split('.');
      tabMap[category] ??= tabs.addTab(category);
      tabMap[category]?.$container({}, [el]);

      const keyInput = $('div');
      const input = $('input', {
        type: InputTypeMap[setting.type],
        value: originalValue,
        checked: setting.type === 'toggle' && setting.value,
        onchange() {
          if (setting.type === 'toggle') el.classList.toggle('changed', input.checked !== setting.defaultValue);
          else el.classList.toggle('changed', input.value !== defaultValue);

          if (setting.type !== 'key') return;

          dispatchEvent(keyInput, 'blur');

          if (input.value === '') return;

          // make sure there are no shortcut conflicts
          for (const item of settingsItems) {
            if (item.setting !== setting && item.setting.type === 'key' && item.input.value === input.value) {
              item.input.value = '';
              dispatchEvent(item.input, 'change');
            }
          }
        },
      });

      /** @type {HTMLElement[]} */
      const children = [input];
      if (setting.type === 'key') {
        children.push(keyInput);
        renderKeyCombo(keyInput, originalValue);
        $(keyInput, {
          className: 'keyInput',
          tabIndex: 0,
          onclick() {
            keyInput.focus();
          },
          onfocus() {
            $(keyInput, { innerHTML: '' }, [['strong', { innerText: 'Press a key or key combination...' }]]);
          },
          onblur() {
            if (document.activeElement === keyInput) {
              keyInput.blur();
            }
            renderKeyCombo(keyInput, input.value);
          },
          onkeydown({ key, ctrlKey, altKey, shiftKey }) {
            if (key === 'Escape') dispatchEvent(keyInput, 'blur');
            else if (key === 'Delete') {
              input.value = '';
              dispatchEvent(input, 'change');
            }

            // block non-printable keys
            if (key.length !== 1) return false;

            const combo = [key.toLowerCase()];
            if (shiftKey) combo.unshift('shift');
            if (altKey) combo.unshift('alt');
            if (ctrlKey) combo.unshift('control');

            input.value = combo.join(' + ');
            dispatchEvent(input, 'change');

            return false;
          },
        });
      }
      const wrapper = $('div', { className: 'shortcutWrapper' }, children);

      $(el, {}, [
        ['label', {}, [['span', { innerText: setting.name }], wrapper]],
        ['div', {
          className: 'button reset',
          innerText: '⟲',
          onclick: () => {
            input.value = defaultValue;
            input.checked = defaultValue === 'true';
            dispatchEvent(input, 'change');
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
