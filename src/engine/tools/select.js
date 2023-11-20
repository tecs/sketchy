/** @type {(engine: Engine) => Tool} */
export default (engine) => {
  const { scene } = engine;

  let lastClick = 0;

  /** @type {Tool} */
  const select = {
    type: 'select',
    name: 'Select',
    shortcut: ' ',
    icon: '🮰',
    start() {
    },
    update() {
    },
    end() {
      const now = Date.now();
      const doubleClicked = now - lastClick < 200;
      lastClick = now;

      if (doubleClicked) {
        scene.setSelectedInstance(null);
        scene.setCurrentInstance(scene.hoveredInstance);
        return;
      }
      if (scene.selectedInstance && scene.hoveredInstance === scene.selectedInstance) return;
      const clickedOwn = scene.hoveredInstance?.belongsTo(scene.currentInstance ?? scene.rootInstance);

      if (scene.hoveredInstance === scene.currentInstance) scene.setSelectedInstance(null);
      else if (clickedOwn) scene.setSelectedInstance(scene.hoveredInstance);
      else if (scene.selectedInstance) scene.setSelectedInstance(null);
      else scene.setCurrentInstance(scene.currentInstance?.parent ?? null);
    },
    abort() {
      if (engine.tools.selected !== this) return;

      if (scene.selectedInstance) {
        scene.setSelectedInstance(null);
      } else if (scene.currentInstance) {
        scene.setCurrentInstance(scene.currentInstance.parent ?? null);
      }
    },
  };

  return select;
};
