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
        scene.setSelectedInstance(0);
        scene.setCurrentInstance(scene.hoveredInstance.id.int);
        return;
      } else if (scene.selectedInstance.id.int && scene.hoveredInstance === scene.selectedInstance) return;

      const clickedOwn = scene.hoveredInstance.belongsTo(scene.currentInstance);
      
      if (scene.hoveredInstance === scene.currentInstance) scene.setSelectedInstance(0);
      else if (clickedOwn) scene.setSelectedInstance(scene.hoveredInstance.id.int);
      else if (scene.selectedInstance.id.int) scene.setSelectedInstance(0);
      else scene.setCurrentInstance(scene.currentInstance.parent?.id.int ?? 0);
    },
    abort() {
      if (engine.tools.selected !== this) return;

      if (scene.selectedInstance.id.int) {
        scene.setSelectedInstance(0);
      } else if (scene.currentInstance.id.int) {
        scene.setCurrentInstance(scene.currentInstance.parent?.id.int ?? 0);
      }
    },
  };

  return select;
};