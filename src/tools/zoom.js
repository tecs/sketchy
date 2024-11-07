import Input from '../engine/input.js';

const { vec3 } = glMatrix;

/** @type {(engine: Engine) => Tool} */
export default (engine) => {
  const { camera, input, scene, emit } = engine;

  // cached structures
  const neutralZoomOrigin = vec3.fromValues(0, 0, -1);

  /** @type {Tool} */
  const zoom = {
    type: 'zoom',
    name: 'Zoom',
    shortcut: 'z',
    icon: '🔍',
    cursor: 'zoom-in',
    start() {
      camera.zoom(input.ctrl ? 2 : -2, scene.hoveredView);
    },
    update() {},
    end() {},
    abort() {},
  };

  const zoomInKey = engine.config.createString('shortcuts.zoomIn', 'Zoom in', 'key', Input.stringify(['shift', '+']));
  const zoomOutKey = engine.config.createString('shortcuts.zoomOut', 'Zoom out', 'key', Input.stringify('-'));

  input.registerShortcuts(zoomInKey, zoomOutKey);

  engine.on('mousescroll', (direction) => {
    const { selected } = engine.tools;

    if (input.shift || (selected?.type === 'orbit' && selected.active)) return;
    camera.zoom(direction, scene.hoveredView);
  });

  engine.on('keyup', () => {
    if (!input.ctrl && engine.tools.selected === zoom) emit('cursorchange', 'zoom-in');
  });

  engine.on('keydown', () => {
    if (input.ctrl && engine.tools.selected === zoom) emit('cursorchange', 'zoom-out');
  });

  engine.on('shortcut', setting => {
    switch (setting) {
      case zoomInKey: camera.zoom(-1, neutralZoomOrigin); break;
      case zoomOutKey: camera.zoom(1, neutralZoomOrigin); break;
    }
  });

  return zoom;
};
