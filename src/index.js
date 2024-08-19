import UI from './ui/index.js';
import Engine from './engine/index.js';
import $, { UIContainer } from './ui/element.js';
import UITabs from './ui/tabs.js';

window.addEventListener('load', () => {
  const { canvas, dialog, windows, topMenu, leftMenu, bottomMenu } = new UI(document.body);
  const engine = new Engine(canvas);

  window.addEventListener('resize', engine.driver.resize);
  engine.driver.resize();

  for (const tool of engine.tools.tools) {
    leftMenu.addButton(tool.type, tool.icon, () => engine.tools.setTool(tool), tool.name);
  }
  leftMenu.select(engine.tools.selected.type);
  engine.on('toolchange', (current) => {
    canvas.style.cursor = current.cursor ?? 'default';
    leftMenu.select(current.type);
  });

  topMenu.addButton('new', '🗋', () => engine.scene.reset(), 'New file');
  topMenu.addButton('save', '🖫', () => {
    const json = engine.scene.export();
    const data = btoa(unescape(encodeURIComponent(json)));
    $('a', { href: `data:text/plain;charset=utf8,${encodeURIComponent(data)}`, download: 'Untitled.scene' }).click();
  }, 'Save file');
  topMenu.addButton('load', '🖿', () => {
    $('input', {
      type: 'file',
      accept: '.scene',
      onchange({ currentTarget: el }) {
        if (!(el instanceof HTMLInputElement) || !el.files?.length) return;
        const reader = new FileReader();
        reader.addEventListener('load', () => {
          const json = decodeURIComponent(escape(atob(reader.result?.toString() ?? '')));
          engine.scene.import(json);
        });
        reader.readAsText(el.files[0]);
      },
    }).click();
  }, 'Load file');

  const undoButton = topMenu.addButton('undo', '↶', () => engine.history.undo(), 'Undo');
  const redoButton = topMenu.addButton('redo', '↷', () => engine.history.redo(), 'Redo');
  undoButton.toggleDisabled();
  redoButton.toggleDisabled();

  engine.on('historychange', () => {
    undoButton.toggleDisabled(!engine.history.canUndo);
    redoButton.toggleDisabled(!engine.history.canRedo);
  });

  topMenu.addButton('settings', '⚙', () => {
    const settingsWindowContents = windows.addWindow('settings', 'Settings').addContainer('settings');

    const tabs = settingsWindowContents.addChild('tabs', new UITabs('settingsContents'));
    tabs.$element({ className: 'settings' });
    tabs.$container({ className: 'settingsCategories' });

    /** @type {Record<import('./engine/config.js').Setting["type"], string>} */
    const InputTypeMap = {
      int: 'number',
      key: 'text',
      toggle: 'checkbox',
    };

    /** @type {(el: HTMLElement) => boolean} */
    const forceChange = (el) => el.dispatchEvent(new Event('change'));

    const settingsItems = engine.config.list().map(setting => {
      const el = $('div', { className: 'setting' });
      const originalValue = String(setting.value);

      const [category] = setting.id.split('.');
      const tab = tabs.children.get(category);
      (tab instanceof UIContainer ? tab : tabs.addTab(category, category)).$container({}, [el]);

      const input = $('input', {
        type: InputTypeMap[setting.type],
        value: originalValue,
        checked: setting.type === 'toggle' && setting.value,
        onkeydown({ key }) {
          if (setting.type !== 'key') return true;

          // block non-printable keys
          if (key.length !== 1) return false;

          input.value = key;
          forceChange(input);
          input.blur();

          return false;
        },
        onchange() {
          if (setting.type === 'toggle') el.classList.toggle('changed', setting.value !== input.checked);
          else el.classList.toggle('changed', input.value !== originalValue);

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
          onclick() {
            input.value = originalValue;
            input.checked = originalValue === 'true';
            forceChange(input);
          },
        }],
      ]);

      return { setting, originalValue, input };
    });

    const buttons = settingsWindowContents.addContainer('buttons', { className: 'settingsButtons' });
    buttons.addButton('save', 'save', () => {
      for (const { input, originalValue, setting } of settingsItems) {
        if ((setting.type === 'toggle' ? String(input.checked) : input.value) === originalValue) continue;

        if (setting.type === 'int') setting.set(parseInt(input.value, 10));
        else if (setting.type === 'key') setting.set(input.value);
        else setting.set(input.checked);
      }
      windows.removeChild('settings');
    }, { className: 'button' });
    buttons.addButton('close', 'close', () => windows.removeChild('settings'), { className: 'button' });
  }, 'Settings');

  bottomMenu.addLabel('measurements', 'Measurements');
  const measurementsInput = bottomMenu.addInput('measurements-input', '', { disabled: true }).element;

  engine.on('toolactive', () => {
    measurementsInput.disabled = !engine.tools.selected.setDistance;
  });
  engine.on('toolinactive', () => {
    measurementsInput.value = '';
    measurementsInput.setAttribute('x-changed', 'false');
    measurementsInput.disabled = true;
  });
  engine.on('scenechange', () => {
    measurementsInput.value = engine.tools.selected.distance?.map(v => v.toFixed(2)).join(', ') ?? '';
    measurementsInput.setAttribute('x-changed', 'false');
  });
  engine.on('keydown', (key) => {
    const { distance } = engine.tools.selected;
    if (!distance || !engine.tools.selected.setDistance) return;

    switch (key) {
      case 'Enter': {
        const newDistance = measurementsInput.value.replace(/[, ]+/g, ' ').trim().split(' ').map(v => parseFloat(v));
        if (newDistance.some(v => typeof v !== 'number') || newDistance.length !== distance.length) return;

        engine.tools.selected.setDistance(newDistance);
        break;
      }
      case 'Delete':
        measurementsInput.value = '';
        break;
      case 'Backspace':
        measurementsInput.value = measurementsInput.value.substring(0, measurementsInput.value.length - 1);
        break;
    }

    if (key.length === 1) {
      const changed = measurementsInput.getAttribute('x-changed') === 'true';
      measurementsInput.value = changed ? `${measurementsInput.value}${key}` : key;
    }

    measurementsInput.setAttribute('x-changed', 'true');
  });

  engine.on('usererror', (message) => dialog.error(message));
  // eslint-disable-next-line no-console
  engine.on('error', console.error);

  canvas.addEventListener('wheel', ({ deltaY }) => engine.input.scroll(/** @type {-1|1} */ (Math.sign(deltaY))), { passive: true });

  canvas.addEventListener('mousedown', ({ button }) => engine.input.setButton(button, true));
  canvas.addEventListener('mouseup', ({ button }) => engine.input.setButton(button, false));

  canvas.addEventListener('mousemove', (e) => engine.input.setPosition(e.clientX, e.clientY, e.movementX, e.movementY));

  document.addEventListener('keydown', ({ key }) => engine.input.setKey(key, true));
  document.addEventListener('keyup', ({ key }) => engine.input.setKey(key, false));
});
