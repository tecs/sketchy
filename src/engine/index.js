import Base from './base.js';

import Config from './config.js';
import History from './history.js';
import Driver from './driver.js';
import Input from './input.js';
import Camera from './camera.js';
import Renderer from './renderer.js';
import Scene from './scene/index.js';
import Tools from './tools/index.js';

import renderAxis from '../passes/axis.js';
import renderSkybox from '../passes/skybox.js';
import renderObjects from '../passes/objects.js';
import renderLines from '../passes/lines.js';
import extractId from '../passes/extractId.js';
import extractPosition from '../passes/extractPosition.js';

/**
 * @typedef {import('./events-types').EngineEvent} EngineEvent
 * @typedef {{ event: EngineEvent['type'], handler: Function, once: boolean }} EventHandlerData
 */

export default class Engine extends Base {
  /** @type {EventHandlerData[]} */
  #handlers = [];

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

    this.config = new Config(this);
    this.driver = new Driver(this, canvas);
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
  }

  /**
   * @param {EventHandlerData[]} handlersToRemove
   */
  #removeHandlers(handlersToRemove) {
    for (const handler of handlersToRemove) {
      const index = this.#handlers.indexOf(handler);
      this.#handlers.splice(index, 1);
    }
  }

  /** @type {EngineEvent["handler"]} */
  on = (event, handler, once = false) => {
    this.#handlers.push({ event, handler, once });
  };

  /** @type {EngineEvent["emitter"]} */
  emit = (event, ...args) => {
    /** @type {EventHandlerData[]} */
    const handlersToRemove = [];

    for (const handler of this.#handlers) {
      if (handler.event !== event) continue;
      try {
        handler.handler(...args);
      } catch (e) {
        // avoid infinite recursion
        if (event === 'error') {
          const error = new Error('fatal error');
          error.stack = [
            'fatal error',
            `Original Error: ${args[0]} ${/** @type {Error} */ (args[1])?.stack ?? args[1]}`,
            `Caused error inside error handler: ${/** @type {Error} */ (e)?.stack ?? e}`,
            `Caused ${error.stack}`,
          ].join('\n\n');
          throw error;
        }
        this.emit('error', `Caught inside handler for "${event}":`, e);
      }
      if (handler.once) handlersToRemove.push(handler);
    }

    if (handlersToRemove.length) this.#removeHandlers(handlersToRemove);
  };

  /**
   * @param {EngineEvent["type"]} event
   * @param {Function} handler
   */
  off(event, handler) {
    const handlersToRemove = this.#handlers.filter(h => h.event === event && h.handler === handler);
    if (handlersToRemove.length) this.#removeHandlers(handlersToRemove);
  }

  /**
   * @param {EngineEvent["type"]} event
   * @returns {Function[]}
   */
  list(event) {
    return this.#handlers.filter(h => h.event === event).map(h => h.handler);
  }
}
