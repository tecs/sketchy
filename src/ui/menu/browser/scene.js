import SubInstance from '../../../engine/cad/subinstance.js';
import Instance from '../../../engine/scene/instance.js';

/**
 * @param {Engine} engine
 * @param {import("../../lib/index.js").UITabs} tabs
 */
export default (engine, tabs) => {
  const tab = tabs.addTab('Scene');
  const { entities, scene } = engine;

  const render = () => {
    const instances = entities.values(Instance);
    /** @type {Record<string, import("../../lib").AnyUIParent>} */
    const instanceCache = {};
    const currentInstance = scene.enteredInstance;
    tab.clearChildren();
    for (const instance of instances) {
      const parent = SubInstance.getParent(instance)?.instance;
      const parentContainer = (parent ? instanceCache[parent.Id.str] : null) ?? tab;
      const instanceContainer = parentContainer.addContainer({ className: 'tree' });
      instanceContainer.addLabel(instance.name).$element({
        onclick: ({ detail }) => {
          if (detail === 2) return void(scene.setEnteredInstance(instance));

          const { enteredInstance } = scene;
          if (instance !== enteredInstance && SubInstance.belongsTo(instance, enteredInstance)) {
            scene.setSelection([{ type: 'instance', instance, index: instance.Id.int }]);
          }
        },
        style: { fontWeight: instance === currentInstance ? 'bold' : undefined },
        className: scene.getSelectedElement({ type: 'instance', instance, index: instance.Id.int }) ? 'selected' : '',
      });
      instanceCache[instance.Id.str] = instanceContainer;
    }
  };

  render();

  engine.on('entityadded', render);
  engine.on('entityremoved', render);
  engine.on('instanceedited', render);
  engine.on('currentchange', render);
  engine.on('selectionchange', render);
};
