import Model from '../3d/model.js';
import Base from '../general/base.js';
import State from '../general/state.js';

/** @typedef {import("./body.js").default} Body */
/** @typedef {import("../general/state.js").Value} Value */

/**
 * @template {Value} T
 * @typedef {[data: T, name: string, body: Body, engine: Engine]} BaseParams
 */

/**
 * @template {Value} T
 * @typedef {typeof Step<T>} StepConstructor
 */

/**
 * @template {Value} T
 * @typedef StepState
 * @property {string} name
 * @property {string} type
 * @property {T} data
 */

/**
 * @template {Value} T
 */
export default class Step extends Base {
  static registered = false;

  /** @type {import('../general/state.js').StateType<StepState<T>>} */
  State;

  /** @type {Model} */
  model;

  /** @type {Body} */
  body;

  /** @type {Step<Value> | undefined} */
  previousStep;

  /** @type {Readonly<Record<keyof Model["data"], number>>} */
  offsets;

  /** @type {Engine} */
  engine;

  get name() {
    return this.State.name;
  }

  get data() {
    return this.State.data;
  }

  /**
   * @param {BaseParams<T>} args
   */
  constructor(...args) {
    const [data, name, body, engine] = args;

    super();
    this.State = new /** @type {import('../general/state.js').StateConstructor<StepState<T>>} */ (State)({
      name,
      type: /** @type {typeof Step<T>} */ (this.constructor).getType(),
      data,
    }, {
      onImport: () => this.recompute(),
      onExport: () => this.export(),
    });

    this.engine = engine;
    this.body = body;

    this.#recompute();
    this.model = this.assertProperty('model');
    this.offsets = this.assertProperty('offsets');
  }

  /**
   * @abstract
   * @returns {string}
   */
  static getType() {
    throw new Error(`${this.name}::getType() is not implemented`);
  }

  /**
   * @param {Engine} _
   */
  static register(_) {
    if (this.registered) {
      throw new Error(`${this.name} is already registered`);
    }
    this.registered = true;
  }

  #recompute() {
    const bodySteps = this.body.listSteps();
    const currentIndex = bodySteps.indexOf(this);
    this.previousStep = currentIndex === -1 ? bodySteps.pop() : bodySteps[currentIndex - 1];

    this.model = this.previousStep?.model.clone() ?? new Model(undefined, this.body, this.engine.driver);

    this.offsets = {
      vertex: this.model.data.vertex.length,
      normal: this.model.data.normal.length,
      color: this.model.data.color.length,
      index: this.model.data.index.length,
      lineIndex: this.model.data.lineIndex.length,
    };
  }

  recompute() {
    this.#recompute();
    this.update();
  }

  update() {
    this.body.stepUpdated(this);
  }

  /**
   * @abstract
   */
  // eslint-disable-next-line class-methods-use-this
  uninit() {}

  /**
   * @returns {StepState<T> | undefined}
   */
  // eslint-disable-next-line class-methods-use-this
  export() {
    return undefined;
  }
}
