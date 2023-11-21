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

      const currentInstance = scene.currentInstance ?? scene.rootInstance;
      let clickedInstance = scene.hoveredInstance;
      while (clickedInstance && clickedInstance !== currentInstance && clickedInstance.parent !== currentInstance) {
        clickedInstance = clickedInstance.parent;
      }

      if (doubleClicked && clickedInstance === scene.selectedInstance) {
        scene.setSelectedInstance(null);
        scene.setCurrentInstance(clickedInstance);
        return;
      }
      if (scene.selectedInstance && clickedInstance === scene.selectedInstance) return;
      const clickedOwn = clickedInstance?.belongsTo(currentInstance);

      if (clickedInstance === currentInstance) scene.setSelectedInstance(null);
      else if (clickedOwn) scene.setSelectedInstance(clickedInstance);
      else if (scene.selectedInstance) scene.setSelectedInstance(null);
      else scene.setCurrentInstance(currentInstance.parent);
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
