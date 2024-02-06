import Config from './config.js';
import History from './history.js';
import Driver from './driver.js';
import Input from './input.js';
import Camera from './camera.js';
import Renderer from './renderer.js';
import Scene from './scene/index.js';
import Tools from './tools/index.js';

import Events from './events.js';

import renderAxis from '../passes/axis.js';
import renderSkybox from '../passes/skybox.js';
import renderObjects from '../passes/objects.js';
import renderLines from '../passes/lines.js';
import extractId from '../passes/extractId.js';
import extractPosition from '../passes/extractPosition.js';

export default class Engine extends Events {
  /** @type {Readonly<Config>} */
  config;

  /** @type {Readonly<Driver>} */
  driver;

  /** @type {Readonly<History>} */
  history;

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

    this.config = new Config();
    this.driver = new Driver(canvas);
    this.history = new History(this);
    this.input = new Input(this);
    this.camera = new Camera(this);
    this.renderer = new Renderer(this);
    this.scene = new Scene(this);
    this.tools = new Tools(this);

    this.renderer.addToPipeline(renderSkybox);
    this.renderer.addToPipeline(renderObjects);
    this.renderer.addToPipeline(renderLines);
    this.renderer.addToPipeline(extractId);
    this.renderer.addToPipeline(extractPosition);
    this.renderer.addToPipeline(renderAxis);

    const onResize = () => this.emit('viewportresize', this.driver.getCanvasSize(), this.camera.screenResolution);
    onResize();
    window.addEventListener('resize', onResize);
  }
}
