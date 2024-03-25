const { vec3 } = glMatrix;

/** @type {(engine: Engine) => Tool} */
export default (engine) => {
  const { camera, input, scene } = engine;

  // cached structures
  const neutralZoomOrigin = vec3.fromValues(0, 0, -1);

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

  const zoomInKey = engine.config.createString('shortcuts.zoomIn', 'Zoom in', 'key', '=');
  const zoomOutKey = engine.config.createString('shortcuts.zoomOut', 'Zoom out', 'key', '-');

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

  engine.on('keydown', (key) => {
    switch (key) {
      case zoomInKey.value:
        camera.zoom(-1, neutralZoomOrigin);
        return;
      case zoomOutKey.value:
        camera.zoom(1, neutralZoomOrigin);
        return;
    }
    if (input.ctrl && zoom.cursor === 'zoom-in') {
      zoom.cursor = 'zoom-out';
      if (engine.tools.selected === zoom) engine.emit('toolchange', zoom, zoom);
    }
  });

  return zoom;
};
