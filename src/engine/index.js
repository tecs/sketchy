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

export default class Engine extends Events {
  /** @type {Readonly<GLMatrix>} */
  math = glMatrix;

  /** @type {Readonly<import('./driver.js').Driver>} */
  driver;

  /** @type {Readonly<import('./state.js').State>} */

  state;
  /** @type {Readonly<import('./input.js').InputState>} */
  input;

  /** @type {Readonly<import('./camera.js').Camera>} */
  camera;

  /** @type {Readonly<import('./renderer.js').Renderer>} */
  renderer;

  /** @type {Readonly<import('./scene').Scene>} */
  scene;

  /** @type {Readonly<import('./tools').Tools>} */
  tools;

  /**
   * @param {HTMLCanvasElement} canvas
   */
  constructor(canvas) {
    super();

    this.driver = makeDriver(canvas);
    this.state = makeState(this);
    this.input = makeInput(this);
    this.camera = makeCamera(this);
    this.renderer = makeRenderer(this);
    this.scene = makeScene(this);
    this.tools = makeTools(this);

    this.renderer.addToPipeline(renderSkybox);
    this.renderer.addToPipeline(renderObjects);
    this.renderer.addToPipeline(extractData);
    this.renderer.addToPipeline(renderAxis);

    const onResize = () => this.emit('viewportresize', this.driver.getCanvasSize(), this.camera.screenResolution);
    onResize();
    window.addEventListener('resize', onResize);
  }
}
