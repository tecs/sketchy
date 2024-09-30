import Model from '../3d/model.js';
import Base, { generateName } from '../general/base.js';
import { Properties } from '../general/properties.js';
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
export default class Step extends Base.implement({ Properties }) {
  static registered = false;

  /** @type {import("../general/state.js").StateType<StepState<T>>} */
  State;

  /** @type {Model} */
  model;

  /** @type {Body} */
  body;

  /** @type {Step<Value> | undefined} */
  previousStep;

  /** @type {Readonly<Record<keyof Model["data"], number>>} */
  offsets;

  /** @type {Record<keyof Model["data"], number>} */
  lengths;

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

    super({ Properties: [() => ({
      General: {
        Name: {
          value: this.name,
          type: 'plain',
          onEdit: (newName) => {
            if (newName === '' || newName === this.name) return;
            this.State.name = generateName(newName, this.body.listSteps(), step => step.name);
            this.engine.emit('stepedited', this);
          },
        },
        Type: { value: this.State.type, type: 'plain' },
        Parent: { value: this.body.name, type: 'plain' },
      },
    })] });

    this.State = new /** @type {import("../general/state.js").StateConstructor<StepState<T>>} */ (State)({
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
    this.lengths = this.assertProperty('lengths');
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
      lineVertex: this.model.data.lineVertex.length,
    };

    this.lengths = {
      vertex: 0,
      normal: 0,
      color: 0,
      index: 0,
      lineIndex: 0,
      lineVertex: 0,
    };
  }

  /**
   * @param {keyof Model["data"]} part
   * @param {number} index
   * @returns {boolean}
   */
  indexBelongsTo(part, index) {
    return index >= this.offsets[part] && index <= this.offsets[part] + this.lengths[part];
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
