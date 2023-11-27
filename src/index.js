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
