import Ui from './ui/index.js';
import Engine from './engine/index.js';
import $ from './ui/element.js';

window.addEventListener('load', () => {
  const ui = new Ui(document.body);

  const { canvas } = ui;
  const engine = new Engine(canvas);

  for (const tool of engine.tools.tools) {
    ui.sideMenu.addItem(tool.type, tool.name, tool.icon, () => engine.tools.setTool(tool));
  }
  ui.sideMenu.select(engine.tools.selected.type);
  engine.on('toolchange', (current) => {
    ui.canvas.style.cursor = current.cursor ?? 'default';
    ui.sideMenu.select(current.type);
  });

  ui.topMenu.addItem('new', 'New file', '🗋', () => engine.scene.reset({}));
  ui.topMenu.addItem('save', 'Save file', '🖫', () => {
    const json = engine.scene.export();
    const data = btoa(unescape(encodeURIComponent(json)));
    $('a', { href: `data:text/plain;charset=utf8,${encodeURIComponent(data)}`, download: 'Untitled.scene' }).click();
  });
  ui.topMenu.addItem('load', 'Load file', '🖿', () => {
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
  });

  ui.topMenu.addItem('undo', 'Undo', '↶', () => engine.history.undo());
  ui.topMenu.addItem('redo', 'Redo', '↷', () => engine.history.redo());
  ui.topMenu.toggleDisabled('undo');
  ui.topMenu.toggleDisabled('redo');

  engine.on('historychange', () => {
    ui.topMenu.toggleDisabled('undo', !engine.history.canUndo);
    ui.topMenu.toggleDisabled('redo', !engine.history.canRedo);
  });

  ui.topMenu.addItem('settings', 'Settings', '⚙', () => {
    const settings = engine.config.list();

    const settingsList = $('div', {}, settings.map(setting => {
      const originalValue = String(setting.value);

      const settingsItem = $('div', { className: 'setting' });

      const value = $('input', {
        type: 'number',
        value: originalValue,
        onchange() {
          setting.value = parseInt(value.value, 10);
          settingsItem.classList.toggle('changed', value.value !== originalValue);
        },
      });

      return $(settingsItem, {}, [
        ['label', {}, [['span', { innerText: setting.name }], value]],
        ['div', {
          className: 'button reset',
          innerText: '⟲',
          onclick() { setting.reset(); value.value = originalValue; },
        }],
      ]);
    }));

    const buttons = $('div', { className: 'settingsButtons' }, [
      ['button', {
        className: 'button',
        innerText: 'save',
        onclick() { settings.forEach(setting => setting.save()); ui.window.remove('settings'); },
      }],
      ['button', { className: 'button', innerText: 'close', onclick: () => ui.window.remove('settings') }],
    ]);

    ui.window.add({
      id: 'settings',
      title: 'Settings',
      contents: [settingsList, buttons],
    });
  });

  engine.on('usererror', (message) => ui.dialog.error(message));
  // eslint-disable-next-line no-console
  engine.on('error', console.error);

  canvas.addEventListener('wheel', ({ deltaY }) => engine.camera.zoom(Math.sign(deltaY)), { passive: true });

  canvas.addEventListener('mousedown', ({ button }) => engine.input.setButton(button, true));
  canvas.addEventListener('mouseup', ({ button }) => engine.input.setButton(button, false));

  canvas.addEventListener('mousemove', (e) => engine.input.setPosition(e.clientX, e.clientY, e.movementX, e.movementY));

  document.addEventListener('keydown', ({ key }) => engine.input.setKey(key, true));
  document.addEventListener('keyup', ({ key }) => engine.input.setKey(key, false));
});
