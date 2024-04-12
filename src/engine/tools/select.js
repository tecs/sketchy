/** @type {(engine: Engine) => Tool} */
export default (engine) => {
  const { config, scene } = engine;

  const doubleClickDelay = config.createNumber('mouse.doubleClickDelay', 'Double click delay', 'int', 200);

  let lastClick = 0;

  /** @type {Tool} */
  const select = {
    type: 'select',
    name: 'Select',
    shortcut: ' ',
    icon: '🮰',
    start() {},
    update() {},
    end() {
      const now = Date.now();
      const doubleClicked = now - lastClick < doubleClickDelay.value;
      lastClick = now;

      const { currentInstance } = scene;
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
      else scene.setCurrentInstance(currentInstance?.parent ?? null);
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
