/** @type {(engine: Engine) => Tool} */
export default (engine) => {
  const { driver, state, scene, camera, input, math: { vec3 } } = engine;

  // cached structures
  const origin = vec3.create();

  /** @type {Tool} */
  let lastTool = {
    type: 'orbit',
    name: 'Orbit',
    shortcut: 'o',
    icon: '🞋',
    start() {
      if (state.orbiting) return;
      driver.canvas.requestPointerLock();
      state.setOrbiting(true);
      vec3.copy(origin, scene.hovered);
      state.setHoveredInstance(scene.hoveredInstance);
      lastTool = this;
    },
    update(delta) {
      if (!state.orbiting) return;

      if (!delta[0] && !delta[1]) return;

      const dX = delta[0] / camera.screenResolution[0];
      const dY = delta[1] / camera.screenResolution[1];

      if (input.shift) {
        camera.pan(dX, dY, origin);
      } else {
        camera.orbit(dX, dY, origin);
      }
    },
    end() {
      if (!state.orbiting || input.middleButton) return;
      state.setOrbiting(false);
      document.exitPointerLock();
    },
    abort() {
      if (!state.orbiting) return;
      state.setOrbiting(false);
      document.exitPointerLock();
    },
  };

  const orbit = lastTool;

  engine.on('mousedown', (button) => {
    if (button !== 'middle' || state.orbiting) return;

    const selectedTool = engine.tools.selected;
    if (selectedTool !== orbit) engine.tools.setTool(orbit);

    orbit.start();
    lastTool = selectedTool;
  });

  engine.on('mouseup', (button) => {
    if (button !== 'middle' || !state.orbiting) return;

    if (lastTool !== orbit) engine.tools.setTool(lastTool);
    else if (!input.leftButton) orbit.end();
  });

  return orbit;
};
