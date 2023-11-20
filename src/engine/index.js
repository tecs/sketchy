import Driver from './driver.js';
import State from './state.js';
import Input from './input.js';
import Camera from './camera.js';
import Renderer from './renderer.js';
import Scene from './scene/index.js';
import Tools from './tools/index.js';

import Events from './events.js';

import renderAxis from '../passes/axis.js';
import renderSkybox from '../passes/skybox.js';
import renderObjects from '../passes/objects.js';
import extractData from '../passes/extractData.js';

export default class Engine extends Events {
  /** @type {Readonly<GLMatrix>} */
  math = glMatrix;

  /** @type {Readonly<Driver>} */
  driver;

  /** @type {Readonly<State>} */
  state;

  /** @type {Readonly<Input>} */
  input;

  /** @type {Readonly<Camera>} */
  camera;

  /** @type {Readonly<Renderer>} */
  renderer;

  /** @type {Readonly<Scene>} */
  scene;

  /** @type {Readonly<Tools>} */
  tools;

  /**
   * @param {HTMLCanvasElement} canvas
   */
  constructor(canvas) {
    super();

    this.driver = new Driver(canvas);
    this.state = new State(this);
    this.input = new Input(this);
    this.camera = new Camera(this);
    this.renderer = new Renderer(this);
    this.scene = new Scene(this);
    this.tools = new Tools(this);

    this.renderer.addToPipeline(renderSkybox);
    this.renderer.addToPipeline(renderObjects);
    this.renderer.addToPipeline(extractData);
    this.renderer.addToPipeline(renderAxis);

    const onResize = () => this.emit('viewportresize', this.driver.getCanvasSize(), this.camera.screenResolution);
    onResize();
    window.addEventListener('resize', onResize);
  }
}
