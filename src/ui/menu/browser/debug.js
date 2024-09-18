import Body from '../../../engine/cad/body.js';

/**
 * @param {number} v
 * @returns {string}
 */
const size = (v) => {
  const suffix = ['GB', 'MB', 'KB', 'b'];
  while (v > 1000 && suffix.length > 1) {
    v /= 1000;
    suffix.pop();
  }
  return v.toFixed(2).replace(/\.$/, '') + suffix.pop();
};

/**
 * @template {number} S
 * @param {string} name
 * @param {S} cols
 * @param {import("../../lib").AnyUIContainer} container
 * @param {(v: number|string|null|undefined) => string} [filter]
 * @param {OptionalTuple<string, S>} header
 * @returns {(v: [label: string, fn: () => (number|string|null|undefined)[]]) => Function}
 */
const rowFn = (name, cols, container, filter = String, ...header) => {
  const table = container.addGroup(name).addTable(cols);
  if (/** @type {string[]} */ (header).length) table.addHeader(...header);

  return ([label, fn]) => {
    const row = table.addMixedRow(1, ...(/** @type {any} */ ([label])));
    return () => {
      const values = fn();
      /** @type {import("../../lib").UICell[]} */ (row.cells)
        .slice(1)
        .forEach((cell, i) => cell.$container({ innerText: filter(values[i] ?? '') }));
    };
  };
};

const { vec3, mat4 } = glMatrix;

/**
 * @param {Engine} engine
 * @param {import("../../lib").UITabs} tabs
 */
export default (engine, tabs) => {
  const { camera, editor: { edited: active, selection }, scene, entities } = engine;

  const tempD = vec3.create();
  const vZ = vec3.create();

  const config = engine.config.createBoolean('advanced.debug', 'Show debug information', 'toggle', false);

  const tab = tabs.addTab('Debug', { expandParent: true });
  if (!config.value) tab.hide();

  const coordsFns = Object.entries({
    'World offset': () => [...vec3.rotateY(tempD, vec3.rotateX(tempD, mat4.getTranslation(tempD, camera.world), vZ, -camera.pitch), vZ, -camera.yaw)],
    'Eye position': () => [...camera.eye],
    'Eye normal': () => [...camera.eyeNormal],
    'Pitch / Yaw / Scale': () => [camera.pitch, camera.yaw, camera.scale],
    'Mouse coords': () => [...scene.hoveredView],
    'Hovered global': () => [...scene.hovered],
    'Hovered local ': () => [...scene.currentInstance.Placement.toLocalCoords(tempD, scene.hovered)],
    'Hovered normal': () => [...scene.axisNormal],
  }).map(rowFn('Coordinates', 4, tab, (v) => typeof v === 'number' ? v.toFixed(3) : String(v), '', 'x', 'y', 'z'));

  const editorFns = Object.entries({
    'Current': () => [scene.currentInstance.Id.int],
    'Hovered': () => [scene.hoveredInstance?.Id.int, scene.hoveredLineIndex, scene.hoveredPointIndex],
    'Selected': () => [
      selection.getByType('instance').map(el => el.index).join(', '),
      selection.getByType('line').map(el => el.index).join(', '),
      selection.getByType('point').map(el => el.index).join(', '),
    ],
    'Active': () => [
      active.getByType('instance').map(el => el.index).join(', '),
      active.getByType('line').map(el => el.index).join(', '),
      active.getByType('point').map(el => el.index).join(', '),
    ],
  }).map(rowFn('Editor', 4, tab, undefined, '', 'Instance', 'Line', 'Point'));

  const toolFns = Object.entries({
    'Selected': () => [engine.tools.selected?.name],
    'Active': () => [engine.tools.selected?.active ? 'yes' : 'no'],
  }).map(rowFn('Tool', 2, tab));

  const driverFns = Object.entries({
    'Buffer size': () => [
      size(entities.values(Body)
        .flatMap(body => body.listSteps().map(step => step.model))
        .filter((v, i, a) => a.indexOf(v) === i)
        .map(model => Object.values(model.data).reduce((sum, data) => sum + data.length * 4, 0))
        .reduce((sum, v) => sum + v, 0)),
    ],
    'Instances': () => [entities.values(Body).reduce((sum, b) => sum + b.instances.length, 0)],
    'Triangles': () => [entities.values(Body).reduce((sum, b) => sum + (b.instances.length * (b.currentModel?.data.index.length ?? 0)) / 3, 0)],
    'Lines': () => [entities.values(Body).reduce((sum, b) => sum + (b.instances.length * (b.currentModel?.data.lineIndex.length ?? 0)) / 2, 0)],
    'Supports UInt32 indexes': () => [engine.driver.supportsUIntIndexes ? 'yes' : 'no'],
  }).map(rowFn('Driver', 2, tab));

  const fns = [coordsFns, editorFns, toolFns, driverFns].flat();

  let pending = 0;
  const showDebugInfo = () => {
    if (!config.value || pending++) return;

    requestAnimationFrame(() => {
      for (const fn of fns) fn();

      if (--pending) {
        pending = 0;
        showDebugInfo();
      }
    });
  };

  engine.on('mousemove', showDebugInfo);
  engine.on('camerachange', showDebugInfo);
  engine.on('selectionchange', showDebugInfo);
  engine.on('currentchange', showDebugInfo);
  engine.on('scenechange', showDebugInfo);
  showDebugInfo();

  engine.on('settingchange', (setting) => {
    if (setting !== config) return;
    if (config.value) tab.show(true);
    else tab.hide();
  });
};
