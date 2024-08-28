import { $ } from './ui/lib/index.js';
import UI from './ui/index.js';
import Engine from './engine/index.js';
import Body from './engine/cad/body.js';
import SubInstance from './engine/cad/subinstance.js';
import Instance from './engine/scene/instance.js';

const { vec3, quat } = glMatrix;

window.addEventListener('load', () => {
  const { canvas, dialog, windows, topMenu, leftMenu, rightMenu, bottomMenu } = new UI(document.body);
  const engine = new Engine(canvas);

  window.addEventListener('resize', engine.driver.resize);
  engine.driver.resize();

  /** @type {Record<string, import("./ui/lib").UIButton>} */
  const toolMap = {};
  for (const tool of engine.tools.tools) {
    toolMap[tool.type] = leftMenu.addButton(tool.icon, () => engine.tools.setTool(tool), tool.name);
  }
  leftMenu.select(toolMap[engine.tools.selected.type]);
  engine.on('toolchange', (current) => {
    canvas.style.cursor = current.cursor ?? 'default';
    leftMenu.select(toolMap[current.type]);
  });

  topMenu.addButton('🗋', () => engine.scene.reset(), 'New file');
  topMenu.addButton('🖫', () => {
    const json = engine.scene.export();
    const data = btoa(unescape(encodeURIComponent(json)));
    $('a', { href: `data:text/plain;charset=utf8,${encodeURIComponent(data)}`, download: 'Untitled.scene' }).click();
  }, 'Save file');
  topMenu.addButton('🖿', () => {
    $('input', {
      type: 'file',
      accept: '.scene',
      onchange({ currentTarget: el }) {
        if (!(el instanceof HTMLInputElement) || !el.files?.length) return;
        const reader = new FileReader();
        reader.addEventListener('load', () => {
          const json = decodeURIComponent(escape(atob(reader.result?.toString() ?? '')));
          engine.scene.import(json);
        });
        reader.readAsText(el.files[0]);
      },
    }).click();
  }, 'Load file');

  const undoButton = topMenu.addButton('↶', () => engine.history.undo(), 'Undo');
  const redoButton = topMenu.addButton('↷', () => engine.history.redo(), 'Redo');
  undoButton.toggleDisabled();
  redoButton.toggleDisabled();

  engine.on('historychange', () => {
    undoButton.toggleDisabled(!engine.history.canUndo);
    redoButton.toggleDisabled(!engine.history.canRedo);
  });

  topMenu.addButton('⚙', () => {
    const settingsWindow = windows.addWindow('Settings');
    const settingsWindowContents = settingsWindow.addContainer();

    const tabs = settingsWindowContents.addTabs('settingsContents');
    tabs.$element({ className: 'settings' });
    tabs.$container({ className: 'settingsCategories' });

    /** @type {Record<import("./engine/config.js").Setting["type"], string>} */
    const InputTypeMap = {
      int: 'number',
      key: 'text',
      toggle: 'checkbox',
    };

    /** @type {Record<string, import("./ui/lib").AnyUIParent>} */
    const tabMap = {};

    /** @type {(el: HTMLElement) => boolean} */
    const forceChange = (el) => el.dispatchEvent(new Event('change'));

    const settingsItems = engine.config.list().map(setting => {
      const el = $('div', { className: 'setting' });
      const originalValue = String(setting.value);

      const [category] = setting.id.split('.');
      tabMap[category] ??= tabs.addTab(category);
      tabMap[category].$container({}, [el]);

      const input = $('input', {
        type: InputTypeMap[setting.type],
        value: originalValue,
        checked: setting.type === 'toggle' && setting.value,
        onkeydown({ key }) {
          if (setting.type !== 'key') return true;

          // block non-printable keys
          if (key.length !== 1) return false;

          input.value = key;
          forceChange(input);
          input.blur();

          return false;
        },
        onchange() {
          if (setting.type === 'toggle') el.classList.toggle('changed', setting.value !== input.checked);
          else el.classList.toggle('changed', input.value !== originalValue);

          if (setting.type !== 'key') return;

          // make sure there are no shortcut conflicts
          for (const item of settingsItems) {
            if (item.setting !== setting && item.setting.type === 'key' && item.input.value === input.value) {
              item.input.value = '';
              forceChange(item.input);
            }
          }
        },
      });

      $(el, {}, [
        ['label', {}, [['span', { innerText: setting.name }], input]],
        ['div', {
          className: 'button reset',
          innerText: '⟲',
          onclick: () => {
            input.value = originalValue;
            input.checked = originalValue === 'true';
            forceChange(input);
          },
        }],
      ]);

      return { setting, originalValue, input };
    });

    const buttons = settingsWindowContents.addContainer({ className: 'settingsButtons' });
    buttons.addButton('save', () => {
      for (const { input, originalValue, setting } of settingsItems) {
        if ((setting.type === 'toggle' ? String(input.checked) : input.value) === originalValue) continue;

        if (setting.type === 'int') setting.set(parseInt(input.value, 10));
        else if (setting.type === 'key') setting.set(input.value);
        else setting.set(input.checked);
      }
      settingsWindow.remove();
    }, { className: 'button' });
    buttons.addButton('close', () => settingsWindow.remove(), { className: 'button' });
  }, 'Settings');

  bottomMenu.addLabel('Measurements');
  const measurementsInput = bottomMenu.addInput('', { disabled: true }).element;

  rightMenu.container.classList.add('rightMenu');
  const browser = rightMenu.addTabs('tabContents');
  browser.$container({ className: 'tabContainer' });

  const stepsTab = browser.addTab('');
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

  const sceneTab = browser.addTab('Scene');
  const bodyTab = browser.addTab('Bodies');
  const repopulateEntitiesMenu = () => {
    const instances = engine.entities.values(Instance);
    /** @type {Record<string, import("./ui/lib").AnyUIParent>} */
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

  repopulateStepsMenu();
  repopulateEntitiesMenu();

  const selected = rightMenu.addTabs('tabContents');
  selected.$container({ className: 'tabContainer' });
  selected.hide();

  /**
   * @param {Iterable<number>} f
   * @returns {string}
   */
  const stringifyFloat32 = (f) => `[${[...f].map(v => v.toFixed(3)).join(', ')}]`;

  const infoTab = selected.addTab('Info');
  /**
   * @param {import("./engine/3d/placement.js").default} placement
   * @param {import("./ui/lib").AnyUIContainer} container
   */
  const describePlacement = (placement, container) => {
    const axis = vec3.create();
    const angle = quat.getAxisAngle(axis, placement.rotation);

    const table = container.addTable(2);
    table.addRow('Position', stringifyFloat32(placement.translation));
    table.addRow('Axis', stringifyFloat32(axis));
    table.addRow('Angle', `${(angle * 180 / Math.PI).toFixed(3)}°`);
  };
  const repopulateSelectedMenu = () => {
    const instance = engine.scene.selectedInstance ?? engine.scene.enteredInstance;
    if (!instance) {
      selected.hide();
      return;
    }

    infoTab.rename(engine.scene.selectedInstance ? 'Selected instance' : 'Active instance');

    selected.show();
    infoTab.clearChildren();
    const general = infoTab.addGroup('General');
    const generalProps = general.addTable(2);
    generalProps.addRow('Id', instance.Id.str);
    generalProps.addRow('Body', instance.body.name);

    const parent = SubInstance.getParent(instance);
    if (parent) {
      generalProps.addRow('Parent', parent.body.name);
      describePlacement(parent.subInstance.placement, infoTab.addGroup('Placement'));
    }
    describePlacement(instance.Placement, infoTab.addGroup(parent ? 'Global placement' : 'Placement'));

    const tip = instance.body.step?.State;
    generalProps.addRow('Tip', tip ? `${tip.name} (${tip.type})` : '<none>');
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

  engine.on('toolactive', () => {
    measurementsInput.disabled = !engine.tools.selected.setDistance;
  });
  engine.on('toolinactive', () => {
    measurementsInput.value = '';
    measurementsInput.setAttribute('x-changed', 'false');
    measurementsInput.disabled = true;
  });
  engine.on('scenechange', () => {
    measurementsInput.value = engine.tools.selected.distance?.map(v => v.toFixed(2)).join(', ') ?? '';
    measurementsInput.setAttribute('x-changed', 'false');
  });
  engine.on('keydown', (key) => {
    const { distance } = engine.tools.selected;
    if (!distance || !engine.tools.selected.setDistance) return;

    switch (key) {
      case 'Enter': {
        const newDistance = measurementsInput.value.replace(/[, ]+/g, ' ').trim().split(' ').map(v => parseFloat(v));
        if (newDistance.some(v => typeof v !== 'number') || newDistance.length !== distance.length) return;

        engine.tools.selected.setDistance(newDistance);
        break;
      }
      case 'Delete':
        measurementsInput.value = '';
        break;
      case 'Backspace':
        measurementsInput.value = measurementsInput.value.substring(0, measurementsInput.value.length - 1);
        break;
    }

    if (key.length === 1) {
      const changed = measurementsInput.getAttribute('x-changed') === 'true';
      measurementsInput.value = changed ? `${measurementsInput.value}${key}` : key;
    }

    measurementsInput.setAttribute('x-changed', 'true');
  });

  engine.on('usererror', (message) => dialog.error(message));
  // eslint-disable-next-line no-console
  engine.on('error', console.error);

  canvas.addEventListener('wheel', ({ deltaY }) => engine.input.scroll(/** @type {-1|1} */ (Math.sign(deltaY))), { passive: true });

  canvas.addEventListener('mousedown', ({ button }) => engine.input.setButton(button, true));
  canvas.addEventListener('mouseup', ({ button }) => engine.input.setButton(button, false));

  canvas.addEventListener('mousemove', (e) => engine.input.setPosition(e.clientX, e.clientY, e.movementX, e.movementY));

  document.addEventListener('keydown', ({ key }) => engine.input.setKey(key, true));
  document.addEventListener('keyup', ({ key }) => engine.input.setKey(key, false));
});
