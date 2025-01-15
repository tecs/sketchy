const { vec3 } = glMatrix;

/** @type {(engine: Engine) => BaseTool} */
export default (engine) => {
  const { driver, scene, camera, input } = engine;

  // cached structures
  const origin = vec3.create();

  /** @type {BaseTool} */
  let lastTool = {
    type: 'orbit',
    name: 'Orbit',
    shortcut: 'o',
    icon: '🞋',
    cursor: 'orbit',
    active: false,
    start() {
      driver.canvas.requestPointerLock();
      this.active = true;
      vec3.copy(origin, scene.hoveredView);
      lastTool = this;
    },
    update(delta) {
      if (!delta[0] && !delta[1]) return;

      const dX = delta[0] / camera.screenResolution[0];
      const dY = delta[1] / camera.screenResolution[1];

      if (input.shift) {
        camera.pan(dX, dY, 0, origin);
      } else {
        camera.orbit(dX, dY, origin);
      }
    },
    end() {
      if (input.middleButton) return;
      this.abort();
    },
    abort() {
      this.active = false;
      document.exitPointerLock();
    },
  };

  const orbit = lastTool;

  engine.on('mousedown', (button) => {
    if (button !== 'middle' || orbit.active) return;

    const { selected } = engine.tools;
    if (selected && selected !== orbit) engine.tools.setTool(orbit);

    orbit.start();
    if (selected) lastTool = selected;
  });

  engine.on('mouseup', (button) => {
    if (button !== 'middle' || !orbit.active) return;

    if (lastTool !== orbit) engine.tools.setTool(lastTool);
    else if (!input.leftButton) orbit.end();
  });

  engine.on('mousescroll', (direction) => {
    if (input.shift) camera.pan(0, 0, -direction, scene.hoveredView);
  });

  return orbit;
};
