import Input from '../../../engine/input.js';
import { $ } from '../../lib/element.js';

/** @typedef {import("../../lib/element.js").Opts[2] & {}} Opts */
const WAITING_FOR_KEY_ELEMENT = /** @type {Opts[number]} */ (['strong', { innerText: 'Press a key or key combination...' }]);
const LAST_VALUE_KEY = 'lastValue';

/** @type {Record<ReturnType<Engine["config"]["list"]>[number]["type"], string>} */
const InputTypeMap = {
  int: 'number',
  key: 'hidden',
  toggle: 'checkbox',
};

/** @type {(el: HTMLElement, event: string) => boolean} */
const dispatchEvent = (el, event) => el.dispatchEvent(new Event(event));

/**
 * @param {HTMLElement} el
 * @param {string} keyCombo
 */
const renderKeyCombo = (el, keyCombo) => {
  if (keyCombo.length === 0) {
    $(el, { innerHTML: '' }, [['em', { innerText: '<unset>' }]]);
    return;
  }

  const sequence = Input.parse(keyCombo);
  const elements = /** @type {Opts} */ ([]);

  for (const [i, shortcut] of sequence.entries()) {
    if (i > 0) elements.push(['span', { innerText: ',' }]);
    if (shortcut.length === 0) elements.push(['kbd', undefined, [WAITING_FOR_KEY_ELEMENT]]);
    for (const [k, key] of shortcut.entries()) {
      if (k > 0) elements.push(['span', { innerText: '+' }]);
      elements.push(['kbd', { innerText: key }]);
    }
  }

  $(el, { innerHTML: '' }, elements);
};

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

    /** @type {Record<string, import("../../lib/index.js").AnyUIParent>} */
    const tabMap = {};

    /**
     * @param {typeof items[number]} item
     * @returns {typeof items}
     */
    const otherItems = (item) => (
      items.filter(other => other !== item && other.setting.type === item.setting.type)
    );

    /**
     * @param {typeof items[number]} item
     * @returns {boolean}
     */
    const shouldBeConvertedToSequence = (item) => otherItems(item).some(other => {
      const otherSequence = Input.parse(other.input.value);
      return otherSequence.length > 1 && Input.stringify(otherSequence[0]) === item.input.value;
    });

    const items = engine.config.list().map(setting => {
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

          if (shouldBeConvertedToSequence(thisItem)) {
            input.value = '';
            el.classList.toggle('changed', input.value !== defaultValue);
          }

          input.setAttribute(LAST_VALUE_KEY, input.value);
          dispatchEvent(keyInput, 'blur');

          if (input.value === '') return;

          // make sure there are no shortcut conflicts
          for (const item of otherItems(thisItem)) {
            if (item.input.value === input.value) {
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
        input.setAttribute(LAST_VALUE_KEY, originalValue);
        renderKeyCombo(keyInput, originalValue);
        $(keyInput, {
          className: 'keyInput',
          tabIndex: 0,
          onclick() {
            keyInput.focus();
          },
          onfocus() {
            $(keyInput, { innerHTML: '' }, [WAITING_FOR_KEY_ELEMENT]);
          },
          onblur() {
            if (document.activeElement === keyInput) {
              keyInput.blur();
            }
            const parsedInput = Input.parse(input.value);
            if (parsedInput[1]?.length === 0) {
              parsedInput.pop();
              input.value = Input.stringify(parsedInput);
              if (shouldBeConvertedToSequence(thisItem)) {
                input.value = input.getAttribute(LAST_VALUE_KEY) ?? '';
              }
            }
            renderKeyCombo(keyInput, input.value);
          },
          onkeyup(e) {
            e.stopPropagation();
          },
          onkeydown(e) {
            e.stopPropagation();

            const { key, ctrlKey, altKey, shiftKey } = e;
            const parsedInput = Input.parse(input.value);
            const isSequence = parsedInput.length === 2;
            const isPendingSequence = parsedInput[1]?.length === 0;

            switch (Input.normalizeKey(key)) {
              case 'esc':
                if (isPendingSequence) {
                  parsedInput.pop();
                  input.value = Input.stringify(parsedInput);

                  if (shouldBeConvertedToSequence(thisItem)) {
                    input.value = input.getAttribute(LAST_VALUE_KEY) ?? '';
                  }
                }
                dispatchEvent(keyInput, 'blur');
                break;
              case 'delete':
                input.value = '';
                dispatchEvent(input, 'change');
                break;
              case 'tab':
                if (input.value.length > 0 && !isSequence) {
                  parsedInput.push([]);
                  input.value = Input.stringify(parsedInput);
                  renderKeyCombo(keyInput, input.value);
                }
                break;
            }

            // block non-printable keys
            if (key.length !== 1) return;

            const combo = /** @type {import("../../../engine/input.js").NonNullKeyboardShortcut} */ ([key]);
            if (shiftKey) combo.unshift(Input.normalizeKey('shift'));
            if (altKey) combo.unshift(Input.normalizeKey('alt'));
            if (ctrlKey) combo.unshift(Input.normalizeKey('control'));

            input.value = Input.stringify([combo]);

            if (!isSequence && shouldBeConvertedToSequence(thisItem)) {
              input.value = Input.stringify([combo, []]);
              renderKeyCombo(keyInput, input.value);
              return;
            }

            if (isPendingSequence) {
              parsedInput[1] = combo;
              input.value = Input.stringify(parsedInput);
            }
            dispatchEvent(input, 'change');

            return;
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

      const thisItem = { setting, originalValue, input };
      return thisItem;
    });

    const buttons = settingsWindowContents.addContainer({ className: 'settingsButtons' });
    buttons.addButton('save', () => {
      for (const { input, originalValue, setting } of items) {
        if ((setting.type === 'toggle' ? String(input.checked) : input.value) === originalValue) continue;

        switch (setting.type) {
          case 'int':
            setting.set(parseInt(input.value, 10));
            break;
          case 'key':
            if (Input.parse(input.value)[1]?.length !== 0) setting.set(input.value);
            break;
          case 'toggle':
            setting.set(input.checked);
            break;
        }
      }
      settingsWindow.remove();
    }, { className: 'button' });
    buttons.addButton('close', () => settingsWindow.remove(), { className: 'button' });
  }, 'Settings');
};
