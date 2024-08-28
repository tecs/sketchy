import Body from '../../../engine/cad/body.js';
import SubInstance from '../../../engine/cad/subinstance.js';

const { vec3 } = glMatrix;

/**
 * @param {Engine} engine
 * @param {import("../../lib/index.js").UITabs} tabs
 */
export default (engine, tabs) => {
  const tab = tabs.addTab('Bodies');

  const render = () => {
    const currentInstance = engine.scene.enteredInstance;

    const bodies = engine.entities.values(Body);
    tab.clearChildren();
    const currentBody = currentInstance?.body;
    for (const body of bodies) {
      tab.addContainer()
        .addLabel(body.name).$element({
          ondblclick: () => {
            const { enteredInstance } = engine.scene;
            const instance = enteredInstance
              ? enteredInstance.body.createStep(SubInstance, { bodyId: body.Id.str }).instances.at(0)
              : body.instantiate();

            if (!instance) return;

            engine.scene.setSelectedInstance(instance);
            engine.scene.hover(vec3.create());

            const tool = engine.tools.tools.find(({ type }) => type === 'move');
            if (tool) {
              engine.tools.setTool(tool);
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
};
