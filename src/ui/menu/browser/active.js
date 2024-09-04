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

    const propertyData = instance.Properties.get();
    for (const [category, properties] of Object.entries(propertyData)) {
      const props = tab.addGroup(category).addTable(2);
      for (const [name, { value, displayValue, type, onEdit }] of Object.entries(properties)) {
        const [, cell] = props.addMixedRow(1, name).cells;
        const label = cell.addLabel(type === 'plain' ? value : displayValue);

        if (!onEdit) {
          label.$element({ className: 'disabled' });
          continue;
        }

        const editor = cell.addContainer();

        switch (type) {
          case 'vec3': {
            const x = editor.addInput(`${value[0]}`, { onchange: () => onEdit(0, x.value) });
            const y = editor.addInput(`${value[1]}`, { onchange: () => onEdit(1, y.value) });
            const z = editor.addInput(`${value[2]}`, { onchange: () => onEdit(2, z.value) });
            break;
          }
          case 'angle': {
            const input = editor.addInput(`${value}`, { onchange: () => onEdit(input.value) });
            break;
          }
          default: {
            const input = editor.addInput(value, { onchange: () => onEdit(input.value) });
            break;
          }
        }

        editor.hide();
        label.$element({
          style: { cursor: 'pointer' },
          onclick: () => {
            if (!label.hide() || !editor.show()) {
              editor.hide();
              label.show();
            }
          },
        });
      }
    }
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
