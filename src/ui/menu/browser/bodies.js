import Body from '../../../engine/cad/body.js';
import SubInstance from '../../../engine/cad/subinstance.js';

const { vec3 } = glMatrix;

/**
 * @param {Engine} engine
 * @param {import("../../lib/index.js").UITabs} tabs
 */
export default (engine, tabs) => {
  const { editor: { selection }, entities, scene, tools } = engine;
  const tab = tabs.addTab('Bodies');

  const render = () => {
    const currentInstance = scene.enteredInstance;

    const bodies = entities.values(Body);
    tab.clearChildren();
    const currentBody = currentInstance?.body;
    for (const body of bodies) {
      tab.addContainer()
        .addLabel(body.name).$element({
          className: body === scene.selectedBody ? 'selected' : '',
          onclick: ({ detail }) => {
            switch (detail) {
              case 1: scene.setSelectedBody(body); return;
              case 2: break;
              default: return;
            }

            const { enteredInstance } = scene;
            const instance = enteredInstance
              ? enteredInstance.body.createStep(SubInstance, { bodyId: body.Id.str }).instances.at(0)
              : body.instantiate();

            if (!instance) return;

            selection.set({ type: 'instance', instance, index: instance.Id.int });
            scene.hover(vec3.create());

            const tool = tools.tools.find(({ type }) => type === 'move');
            if (tool) {
              tools.setTool(tool);
              tool.start();
            }
          },
          style: { fontWeight: body === currentBody ? 'bold' : undefined },
        });
    }
  };

  render();

  engine.on('entityadded', render);
  engine.on('entityremoved', render);
  engine.on('currentchange', render);
  engine.on('selectionchange', render);
  engine.on('selectedbodychange', render);
  engine.on('bodyedited', render);
  engine.on('mousedown', () => engine.scene.setSelectedBody(null));
};
