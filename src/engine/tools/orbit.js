/** @type {(engine: Engine) => Tool} */
export default (engine) => {
  const { driver, state, scene, camera, input } = engine;

  /** @type {Tool} */
  const orbit = {
    type: 'orbit',
    name: 'Orbit',
    shortcut: 'o',
    icon: '🞋',
    start() {
      if (state.orbiting) return;
      driver.canvas.requestPointerLock();
      state.setOrbiting(true);
      state.setHovered(scene.hovered);
      state.setHoveredGlobal(scene.hoveredGlobal);
      state.setHoveredInstance(scene.hoveredInstance);
      lastTool = orbit;
    },
    update(delta) {
      if (!state.orbiting) return;

      if (!delta[0] && !delta[1]) return;

      const dX = delta[0] / camera.screenResolution[0];
      const dY = delta[1] / camera.screenResolution[1];

      if (input.shift) {
        camera.pan(dX, dY);
      } else {
        camera.orbit(dX, dY);
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

  let lastTool = orbit;

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