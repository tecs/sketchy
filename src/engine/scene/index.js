import Model from './model.js';
import Instance from './instance.js';

/**
 * @typedef Scene
 * @property {Model} rootModel
 * @property {Instance} rootInstance
 * @property {Instance} currentInstance
 * @property {Instance} selectedInstance
 * @property {Instance} hoveredInstance
 * @property {Model[]} models
 * @property {vec3} axisNormal
 * @property {vec3} hovered
 * @property {vec3} hoveredGlobal
 * @property {(model: Model, trs: Readonly<mat4>) => Instance} instanceModel
 * @property {(id: number) => void} setSelectedInstance
 * @property {(id: number) => void} setCurrentInstance
 * @property {(id: Readonly<Uint8Array>) => void} hoverOver
 * @property {(position: Readonly<vec4>) => void} hover
 * @property {(position: Readonly<vec4>) => void} hoverGlobal
 * @property {(normal: Readonly<vec3>) => void} setAxis
 */

/**
 * @param {Uint8Array} uuuu 
 * @returns {number}
 */
const uuuuToInt = (uuuu) => uuuu[0] + (uuuu[1] << 8) + (uuuu[2] << 16) + (uuuu[3] << 24);

/**
 * @type {(engine: Engine) => Scene}
 */
export default (engine) => {
  const { math: { mat4, vec3, vec4 }, camera, driver: { ctx, UintIndexArray }} = engine;

  const rootModel = new Model('', {}, engine);
  const rootInstance = new Instance(rootModel, mat4.create(), null, 0);

  const instanceById = new Map([[0, rootInstance]]);

  /** @type {Scene} */
  const scene = {
    rootModel,
    rootInstance,
    currentInstance: rootInstance,
    selectedInstance: rootInstance,
    hoveredInstance: rootInstance,
    models: [rootModel],
    axisNormal: vec3.fromValues(0, 1, 0),
    hovered: vec3.create(),
    hoveredGlobal: vec3.create(),
    instanceModel(model, trs) {
      if (model.getAllModels().includes(this.currentInstance.model)) {
        alert('Cannot add model to itself');
        throw new Error('Cannot add model to itself');
      }

      const instance = new Instance(model, trs, this.currentInstance);
      this.currentInstance.model.adopt(instance);
      if (!this.models.includes(model)) {
        this.models.push(model);
      }
      instanceById.set(instance.id.int, instance);

      engine.emit('scenechange');

      return instance;
    },
    setSelectedInstance(id) {
      const newInstance = instanceById.get(id);
      if (newInstance && newInstance !== this.selectedInstance) {
        const previous = this.selectedInstance;
        this.selectedInstance = newInstance;
        engine.emit('selectionchange', this.selectedInstance, previous);
      }
    },
    setCurrentInstance(id) {
      const newInstance = instanceById.get(id);
      if (newInstance && newInstance !== this.currentInstance) {
        const previous = this.currentInstance;
        this.currentInstance = newInstance;
        engine.emit('currentchange', this.selectedInstance, previous);
      }
    },
    hoverOver(id4u) {
      const id = uuuuToInt(id4u);
      if (id === this.hoveredInstance.id.int) return;

      this.hoveredInstance = instanceById.get(id) ?? rootInstance;
      
      if (!id) {
        this.hovered[0] = 0;
        this.hovered[1] = 0;
        this.hovered[2] = 0;
      }
    },
    hover(position) {
      vec4.transformMat4(this.hoveredGlobal, position, camera.inverseMvp);

      this.hovered[0] = position[0];
      this.hovered[1] = position[1];
      this.hovered[2] = position[3];
    },
    hoverGlobal(position) {
      this.hoveredGlobal[0] = position[0];
      this.hoveredGlobal[1] = position[1];
      this.hoveredGlobal[2] = position[2];

      vec4.transformMat4(this.hovered, position, camera.mvp);
      this.hovered[2] += camera.nearPlane * 2;
    },
    setAxis(normal) {
      this.axisNormal[0] = Math.abs(normal[0]);
      this.axisNormal[1] = Math.abs(normal[1]);
      this.axisNormal[2] = Math.abs(normal[2]);
    }
  };

  engine.on('mousedown', (button) => {
    if (button === 'left') engine.tools.selected.start();
  });

  engine.on('mouseup', (button) => {
    if (button === 'left') engine.tools.selected.end();
  });

  engine.on('mousemove', (_, delta) => {
    engine.tools.selected.update(delta);
  });

  engine.on('toolchange', (_, tool) => tool.abort());
  engine.on('keyup', (key) => {
    if (key === 'Escape') engine.tools.selected.abort();
  });

  return scene;
};