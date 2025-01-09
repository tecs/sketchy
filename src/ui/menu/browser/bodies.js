import Body from '../../../engine/cad/body.js';
import SubInstance from '../../../engine/cad/subinstance.js';

const { vec3 } = glMatrix;

/**
 * @param {Engine} engine
 * @param {import("../../lib/index.js").UITabs} tabs
 */
export default (engine, tabs) => {
  const { editor: { selection }, entities, history, scene, tools } = engine;
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

            const action = history.createAction(`Create a new instance of "${body.name}"`, {
              parent: enteredInstance,
              instance: /** @type {Instance | undefined} */ (undefined),
            });
            if (!action) return;

            action.append(
              data => void(data.instance = data.parent
                ? data.parent.body.createStep(SubInstance, { bodyId: body.Id.str }).instances.at(0)
                : body.instantiate()
              ),
              ({ parent, instance }) => {
                if (!instance) return;

                if (!parent) {
                  body.uninstantiate(instance);
                  return;
                }

                const step = SubInstance.getParent(instance)?.subInstance;
                if (step) parent.body.removeStep(step);
              },
            );

            const { instance } = action.data;
            if (!instance) return;

            action.commit();

            selection.set({ type: 'instance', instance, id: instance.Id.int });
            scene.hover(vec3.create());

            const tool = tools.get('move');
            tools.setTool(tool);
            tool?.start();
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
