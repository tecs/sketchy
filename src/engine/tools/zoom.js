/** @type {(engine: Engine) => Tool} */
export default (engine) => {
  const { camera, input, scene } = engine;

  /** @type {Tool} */
  const zoom = {
    type: 'zoom',
    name: 'Zoom',
    shortcut: 'z',
    icon: '🔍',
    cursor: 'zoom-in',
    active: false,
    start() {
      camera.zoom(input.ctrl ? 2 : -2, scene.hovered);
    },
    update() {},
    end() {},
    abort() {},
  };

  engine.on('mousescroll', (direction) => {
    const { selected } = engine.tools;

    if (selected.type === 'orbit' && selected.active) return;
    camera.zoom(direction, scene.hovered);
  });

  engine.on('keyup', () => {
    if (!input.ctrl && zoom.cursor === 'zoom-out') {
      zoom.cursor = 'zoom-in';
      if (engine.tools.selected === zoom) engine.emit('toolchange', zoom, zoom);
    }
  });

  engine.on('keydown', () => {
    if (input.ctrl && zoom.cursor === 'zoom-in') {
      zoom.cursor = 'zoom-out';
      if (engine.tools.selected === zoom) engine.emit('toolchange', zoom, zoom);
    }
  });

  return zoom;
};
