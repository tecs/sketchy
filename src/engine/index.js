import Base from './general/base.js';

import Entities from './entities.js';
import Config from './config.js';
import History from './history.js';
import Driver from './driver.js';
import Editor from './editor.js';
import Input from './input.js';
import Camera from './3d/camera.js';
import Renderer from './renderer.js';
import Scene from './scene/index.js';
import Tools from './tools.js';

import Body from './cad/body.js';
import Sketch from './cad/sketch.js';
import RawData from './cad/rawdata.js';
import SubInstance from './cad/subinstance.js';

/** @typedef {import("./3d/bounding-box-types").BoundingBoxEvent} BoundingBoxEv */
/** @typedef {import("./3d/camera-types").CameraEvent} CameraEv */
/** @typedef {import("./cad/types").CadEvent} CadEv */
/** @typedef {import("./config-types").ConfigEvent} ConfigEv */
/** @typedef {import("./editor-types").EditorEvent} EditorEv */
/** @typedef {import("./entities-types").EntitiesEvent} EntitiesEv */
/** @typedef {import("./history-types").HistoryEvent} HistoryEv */
/** @typedef {import("./input-types").InputEvent} InputEv */
/** @typedef {import("./scene/types").SceneEvent} SceneEv */
/** @typedef {import("./tools-types").ToolEvent} ToolEv */
/** @typedef {import("./scene/intance-types").InstanceEvent} InstanceEv */
// eslint-disable-next-line max-len
/** @typedef {BoundingBoxEv|CadEv|CameraEv|ConfigEv|EditorEv|EntitiesEv|HistoryEv|InputEv|SceneEv|ToolEv|InstanceEv} EngineEvent */

/** @augments Base<EngineEvent> */
export default class Engine extends Base {
  /** @type {Readonly<Entities>} */
  entities;

  /** @type {Readonly<Config>} */
  config;

  /** @type {Readonly<Driver>} */
  driver;

  /** @type {Readonly<Editor>} */
  editor;

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

    this.entities = new Entities(this);
    this.config = new Config(this);
    this.driver = new Driver(this, canvas);
    this.editor = new Editor(this);
    this.history = new History(this);
    this.input = new Input(this);
    this.camera = new Camera(this);
    this.renderer = new Renderer(this);
    this.scene = new Scene(this);
    this.tools = new Tools(this);

    Body.registerStep(Sketch, this);
    Body.registerStep(RawData, this);
    Body.registerStep(SubInstance, this);
  }
}
