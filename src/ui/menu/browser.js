import Body from '../../engine/cad/body.js';
import SubInstance from '../../engine/cad/subinstance.js';
import Instance from '../../engine/scene/instance.js';
import { UIMenu } from '../lib/index.js';

const { vec3, quat } = glMatrix;

/**
 * @param {Iterable<number>} f
 * @returns {string}
 */
const stringifyFloat32 = (f) => `[${[...f].map(v => v.toFixed(3)).join(', ')}]`;

/**
 * @param {import("../../engine/3d/placement.js").default} placement
 * @param {import("../lib").AnyUIContainer} container
 */
const describePlacement = (placement, container) => {
  const axis = vec3.create();
  const angle = quat.getAxisAngle(axis, placement.rotation);

  const table = container.addTable(2);
  table.addMixedRow(1, 'Position', stringifyFloat32(placement.translation));
  table.addMixedRow(1, 'Axis', stringifyFloat32(axis));
  table.addMixedRow(1, 'Angle', `${(angle * 180 / Math.PI).toFixed(3)}°`);
};

/**
 * @param {Engine} engine
 * @returns {UIMenu}
 */
export default (engine) => {
  const menu = new UIMenu({ position: 'right' });

  menu.container.classList.add('rightMenu');
  const browser = menu.addTabs('tabContents');
  browser.$container({ className: 'tabContainer' });

  const stepsTab = browser.addTab('');
  const sceneTab = browser.addTab('Scene');
  const bodyTab = browser.addTab('Bodies');

  const selected = menu.addTabs('tabContents');
  selected.$container({ className: 'tabContainer' });

  const infoTab = selected.addTab('Info');

  const repopulateStepsMenu = () => {
    const instance = engine.scene.enteredInstance;
    if (!instance) {
      stepsTab.hide();
      return;
    }
    stepsTab.show(true);
    stepsTab.clearChildren();
    stepsTab.rename(`Steps (${instance.body.name})`);
    const currentStep = instance.body.step;
    for (const step of instance.body.listSteps()) {
      stepsTab.addContainer()
        .addLabel(`${step === currentStep ? '* ' : ''}${step.name}`).$element({
          ondblclick: () => engine.scene.setCurrentStep(step),
          style: { fontWeight: step === engine.scene.currentStep ? 'bold' : undefined },
        });
    }
  };

  const repopulateEntitiesMenu = () => {
    const instances = engine.entities.values(Instance);
    /** @type {Record<string, import("../lib").AnyUIParent>} */
    const instanceCache = {};
    const currentInstance = engine.scene.enteredInstance;
    sceneTab.clearChildren();
    for (const instance of instances) {
      const parent = SubInstance.getParent(instance)?.instance;
      const parentContainer = (parent ? instanceCache[parent.Id.str] : null) ?? sceneTab;
      const instanceContainer = parentContainer.addContainer({ className: 'tree' });
      instanceContainer.addLabel(instance.body.name).$element({
        ondblclick: () => engine.scene.setEnteredInstance(instance),
        onclick: () => {
          const { enteredInstance } = engine.scene;
          if (instance !== enteredInstance && SubInstance.belongsTo(instance, enteredInstance)) {
            engine.scene.setSelectedInstance(instance);
          }
        },
        style: { fontWeight: instance === currentInstance ? 'bold' : undefined },
        className: instance === engine.scene.selectedInstance ? 'selected' : '',
      });
      instanceCache[instance.Id.str] = instanceContainer;
    }

    const bodies = engine.entities.values(Body);
    bodyTab.clearChildren();
    const currentBody = currentInstance?.body;
    for (const body of bodies) {
      bodyTab.addContainer()
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
  const repopulateSelectedMenu = () => {
    const instance = engine.scene.selectedInstance ?? engine.scene.enteredInstance;
    if (!instance) {
      infoTab.hide();
      return;
    }

    infoTab.rename(engine.scene.selectedInstance ? 'Selected instance' : 'Active instance');

    infoTab.show();
    infoTab.clearChildren();
    const general = infoTab.addGroup('General');
    const generalProps = general.addTable(2);
    generalProps.addMixedRow(1, 'Id', instance.Id.str);
    generalProps.addMixedRow(1, 'Body', instance.body.name);

    const parent = SubInstance.getParent(instance);
    if (parent) {
      generalProps.addMixedRow(1, 'Parent', parent.body.name);
      describePlacement(parent.subInstance.placement, infoTab.addGroup('Placement'));
    }
    describePlacement(instance.Placement, infoTab.addGroup(parent ? 'Global placement' : 'Placement'));

    const tip = instance.body.step?.State;
    generalProps.addMixedRow(1, 'Tip', tip ? `${tip.name} (${tip.type})` : '<none>');
  };

  /**
   * @param {Instance} changedInstance
   */
  const repopulateSelectedMenuOnInstanceChange = (changedInstance) => {
    const selectedInstance = engine.scene.selectedInstance ?? engine.scene.enteredInstance;
    if (changedInstance === selectedInstance) {
      repopulateSelectedMenu();
    }
  };

  repopulateStepsMenu();
  repopulateEntitiesMenu();
  repopulateSelectedMenu();

  engine.on('currentchange', repopulateStepsMenu);
  engine.on('scenechange', repopulateStepsMenu);
  engine.on('stepchange', repopulateStepsMenu);

  engine.on('entityadded', repopulateEntitiesMenu);
  engine.on('entityremoved', repopulateEntitiesMenu);
  engine.on('currentchange', repopulateEntitiesMenu);
  engine.on('selectionchange', repopulateEntitiesMenu);

  engine.on('selectionchange', repopulateSelectedMenu);
  engine.on('currentchange', repopulateSelectedMenu);
  engine.on('instancetransformed', repopulateSelectedMenuOnInstanceChange);
  engine.on('instancetranslated', repopulateSelectedMenuOnInstanceChange);

  return menu;
};
