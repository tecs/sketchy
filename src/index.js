import Ui from './ui/index.js';
import Engine from './engine/index.js';

window.addEventListener('load', () => {
  const ui = new Ui(document.body);

  const { canvas } = ui;
  const engine = new Engine(canvas);

  for (const tool of engine.tools.tools) {
    ui.sideMenu.addItem(tool.type, tool.name, tool.icon, () => engine.tools.setTool(tool));
  }
  ui.sideMenu.select(engine.tools.selected.type);
  engine.on('toolchange', (current) => ui.sideMenu.select(current.type));

  ui.topMenu.addItem('new', 'New file', '🗋', () => engine.scene.reset({}));
  ui.topMenu.addItem('save', 'Save file', '🖫', () => {
    const json = engine.scene.export();
    const data = btoa(unescape(encodeURIComponent(json)));
    const el = document.createElement('a');
    el.setAttribute('href', `data:text/plain;charset=utf8,${encodeURIComponent(data)}`);
    el.setAttribute('download', 'Untitled.scene');
    el.click();
  });
  ui.topMenu.addItem('load', 'Load file', '🖿', () => {
    const el = document.createElement('input');
    el.setAttribute('type', 'file');
    el.setAttribute('accept', '.scene');
    el.addEventListener('change', () => {
      if (!el.files?.length) return;
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        const json = decodeURIComponent(escape(atob(reader.result?.toString() ?? '')));
        engine.scene.import(json);
      });
      reader.readAsText(el.files[0]);
    }, false);
    el.click();
  });

  ui.topMenu.addItem('settings', 'Settings', '⚙', () => {
    const settings = engine.config.list();

    const settingsList = document.createElement('div');
    for (const setting of settings) {
      const settingsItem = document.createElement('div');
      settingsItem.className = 'setting';

      const label = document.createElement('label');

      const name = document.createElement('span');
      name.innerText = setting.name;

      const originalValue = String(setting.value);

      const value = document.createElement('input');
      value.type = 'number';
      value.value = originalValue;
      value.addEventListener('change', () => {
        setting.value = parseInt(value.value, 10);
        settingsItem.classList.toggle('changed', value.value !== originalValue);
      });

      label.appendChild(name);
      label.appendChild(value);

      const onReset = () => {
        setting.reset();
        value.value = originalValue;
      };
      const reset = document.createElement('div');
      reset.className = 'button reset';
      reset.innerText = '⟲';

      reset.addEventListener('click', onReset);

      settingsItem.appendChild(label);
      settingsItem.appendChild(reset);

      settingsList.appendChild(settingsItem);
    }

    const save = document.createElement('button');
    save.className = 'button';
    save.innerText = 'save';
    save.addEventListener('click', () => {
      for (const setting of settings) setting.save();
      ui.window.remove('settings');
    });

    const close = document.createElement('button');
    close.className = 'button';
    close.innerText = 'close';
    close.addEventListener('click', () => ui.window.remove('settings'));

    const buttons = document.createElement('div');
    buttons.className = 'settingsButtons';
    buttons.appendChild(save);
    buttons.appendChild(close);

    ui.window.add({
      id: 'settings',
      title: 'Settings',
      contents: [settingsList, buttons],
    });
  });

  engine.on('usererror', (message) => ui.dialog.error(message));
  // eslint-disable-next-line no-console
  engine.on('error', console.error);

  canvas.addEventListener('wheel', ({ deltaY }) => engine.camera.zoom(Math.sign(deltaY)));

  canvas.addEventListener('mousedown', ({ button }) => engine.input.setButton(button, true));
  canvas.addEventListener('mouseup', ({ button }) => engine.input.setButton(button, false));

  canvas.addEventListener('mousemove', (e) => engine.input.setPosition(e.clientX, e.clientY, e.movementX, e.movementY));

  document.addEventListener('keydown', ({ key }) => engine.input.setKey(key, true));
  document.addEventListener('keyup', ({ key }) => engine.input.setKey(key, false));
});
