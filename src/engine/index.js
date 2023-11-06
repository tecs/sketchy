import makeCamera from './camera.js';
import makeScene from './scene/index.js';
import makeRenderer from './renderer.js';
import makeDriver from './driver.js';
import makeInput from './input.js';
import makeState from './state.js';
import makeTools from './tools/index.js';

import Events from './events.js';

import renderAxis from '../passes/axis.js';
import renderSkybox from '../passes/skybox.js';
import renderObjects from '../passes/objects.js';
import extractData from '../passes/extractData.js';

/**
 * @typedef {import("./events.js").EngineEvent} EngineEvent
 * 
 * @typedef Engine
 * @property {Readonly<GLMatrix>} math
 * @property {Readonly<import('./driver.js').Driver>} driver
 * @property {Readonly<import('./input.js').InputState>} input
 * @property {Readonly<import('./camera.js').Camera>} camera
 * @property {Readonly<import('./renderer.js').Renderer>} renderer
 * @property {Readonly<import('./scene').Scene>} scene
 * @property {Readonly<import('./state.js').State>} state
 * @property {Readonly<import('./tools').Tools>} tools
 * @property {import('./events.js').EventHandler} on
 * @property {(event: EngineEvent, handler: Function) => void} off
 * @property {import('./events.js').EventEmitter} emit
 * @property {(event: EngineEvent) => Function[]} list
 */

/**
 * @param {HTMLCanvasElement} canvas 
 * @returns {Engine}
 */
const Engine = (canvas) => {
  /** @type {Engine} */
  const engine = new class Engine extends Events {
    math = glMatrix;
    driver = makeDriver(canvas);
    state = makeState(this);
    input = makeInput(this);
    camera = makeCamera(this);
    renderer = makeRenderer(this);
    scene = makeScene(this);
    tools = makeTools(this);
  };

  engine.renderer.addToPipeline(renderSkybox);
  engine.renderer.addToPipeline(renderObjects);
  engine.renderer.addToPipeline(extractData);
  engine.renderer.addToPipeline(renderAxis);

  engine.emit('viewportresize', engine.math.vec3.fromValues(canvas.clientWidth, canvas.clientHeight, 0), engine.math.vec3.create());
  window.addEventListener('resize', () => engine.emit('viewportresize', engine.math.vec3.fromValues(canvas.clientWidth, canvas.clientHeight, 0), engine.camera.screenResolution));

  return engine;
};

export default Engine;
