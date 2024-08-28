import SubInstance from '../../../engine/cad/subinstance.js';

const { vec3, quat } = glMatrix;

/**
 * @param {Iterable<number>} f
 * @returns {string}
 */
const stringifyFloat32 = (f) => `[${[...f].map(v => v.toFixed(3)).join(', ')}]`;

/**
 * @param {import("../../../engine/3d/placement.js").default} placement
 * @param {import("../../lib").AnyUIContainer} container
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
 * @param {import("../../lib/index.js").UITabs} tabs
 */
export default (engine, tabs) => {
  const tab = tabs.addTab('Info');

  const render = () => {
    const instance = engine.scene.selectedInstance ?? engine.scene.enteredInstance;
    if (!instance) {
      tab.hide();
      return;
    }

    tab.rename(engine.scene.selectedInstance ? 'Selected instance' : 'Active instance');

    tab.show();
    tab.clearChildren();
    const general = tab.addGroup('General');
    const generalProps = general.addTable(2);
    generalProps.addMixedRow(1, 'Id', instance.Id.str);
    generalProps.addMixedRow(1, 'Body', instance.body.name);

    const parent = SubInstance.getParent(instance);
    if (parent) {
      generalProps.addMixedRow(1, 'Parent', parent.body.name);
      describePlacement(parent.subInstance.placement, tab.addGroup('Placement'));
    }
    describePlacement(instance.Placement, tab.addGroup(parent ? 'Global placement' : 'Placement'));

    const tip = instance.body.step?.State;
    generalProps.addMixedRow(1, 'Tip', tip ? `${tip.name} (${tip.type})` : '<none>');
  };

  /**
   * @param {Instance} changedInstance
   */
  const repopulateSelectedMenuOnInstanceChange = (changedInstance) => {
    const selectedInstance = engine.scene.selectedInstance ?? engine.scene.enteredInstance;
    if (changedInstance === selectedInstance) {
      render();
    }
  };

  render();

  engine.on('selectionchange', render);
  engine.on('currentchange', render);
  engine.on('instancetransformed', repopulateSelectedMenuOnInstanceChange);
  engine.on('instancetranslated', repopulateSelectedMenuOnInstanceChange);
};
