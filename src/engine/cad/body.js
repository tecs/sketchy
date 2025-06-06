import UnsupportedStep from './unsupported.js';

import Instance from '../scene/instance.js';
import BoundingBox from '../3d/bounding-box.js';
import Base, { generateName } from '../general/base.js';
import Id from '../general/id.js';
import State from '../general/state.js';
import { Properties } from '../general/properties.js';

/** @typedef {import("./step.js").default<any>} AnyStep */
/** @typedef {import("./step.js").StepConstructor<any>} StepConstructor */

/**
 * @typedef BodyState
 * @property {string} name
 * @property {import("../entities.js").Key} id
 * @property {import("./step.js").StepState<any>[]} stack
 * @property {boolean} visibility
 */

export default class Body extends Base.implement({
  BoundingBox,
  Id,
  Properties,
  State: State.withDefaults(/** @type {BodyState} */ ({
    name: '',
    id: '',
    stack: [],
    visibility: true,
  })),
}) {
  /** @type {Engine} */
  #engine;

  /** @type {AnyStep[]} */
  #stack = [];

  /** @type {Instance[]} */
  instances = [];

  #step = -1;
  #editedStep = -1;

  /** @type {Record<string, StepConstructor>} */
  static #actions = {};

  static #initialized = false;

  get name() {
    return this.State.name;
  }

  /** @type {AnyStep|undefined} */
  get step() {
    return this.#stack[this.#step];
  }

  /** @type {boolean} */
  get isAtTip() {
    return this.#step + 1 === this.#stack.length;
  }

  /** @type {Model?} */
  get currentModel() {
    return this.#stack[this.#editedStep > -1 ? this.#editedStep : this.#step]?.model ?? null;
  }

  /**
   * @param {Engine} engine
   * @param {Partial<BodyState>} [state]
   */
  constructor(engine, state) {
    super({
      Id: [state?.id],
      Properties: [(stepState = this.step?.State) => ({
        General: {
          Id: { value: this.State.id, type: 'plain' },
          Name: {
            value: this.name,
            type: 'plain',
            onEdit: (name) => {
              if (name === '' || name === this.State.name) return;
              this.State.name = generateName(name, engine.entities.values(Body), body => body.name);
              engine.emit('bodyedited', this);
            },
          },
          Tip: { value: stepState ? `${stepState.name} (${stepState.type})` : '<none>', type: 'plain' },
        },
        Appearance: {
          Visibility: {
            value: this.State.visibility,
            type: 'boolean',
            onEdit: (visibility) => this.toggleVisibility(visibility),
          },
        },
      })],
      State: [
        undefined,
        {
          onExport: () => ({
            ...this.State,
            stack: this.#stack.map(step => step.State.export()),
          }),
          onImport: ({ id, stack }) => {
            this.Id.str = id;

            if (this.#stack.length) {
              this.listSteps().reverse().forEach(step => this.removeStep(step));
            }

            for (const { type, name, data } of stack) {
              if (type in Body.#actions) {
                this.#importStep(new Body.#actions[type](data, name, this, engine));
              } else {
                this.#importStep(UnsupportedStep(type, data, name, this, engine));
              }
            }
          },
        },
      ],
    });

    this.on('usererror', (message) => engine.emit('usererror', message));

    this.#engine = engine;

    this.State.import({
      name: state?.name ?? generateName('Body', engine.entities.values(Body), body => body.name),
      id: this.Id.str,
      stack: state?.stack ?? [],
      visibility: state?.visibility ?? true,
    });

    Body.#initialize(engine);
  }

  /**
   * @param {StepConstructor} Action
   * @param {Engine} engine
   */
  static registerStep(Action, engine) {
    Action.register(engine);
    Body.#actions[Action.getType()] = Action;
  }

  /**
   * @param {Engine} engine
   */
  static #initialize(engine) {
    if (this.#initialized) return;
    this.#initialized = true;

    engine.on('stepchange', (current, previous, isSelectionChange) => {
      if (isSelectionChange) return;

      if (current?.body) {
        current.body.#editedStep = current.body.#stack.indexOf(/** @type {AnyStep} */ (current));
      }

      if (previous?.body && previous.body !== current?.body) {
        previous.body.#editedStep = -1;
      }

      engine.emit('scenechange');
    });
  }

  /**
   * @param {AnyStep} step
   */
  #importStep(step) {
    this.#stack.push(step);
    this.#step++;

    this.recalculateBoundingBox();
    this.#engine.emit('scenechange');
    this.#engine.emit('bodyedited', this);
  }

  /**
   * @param {Partial<import("../scene/instance.js").InstanceState>} [state]
   * @returns {Instance}
   */
  instantiate(state) {
    const instance = new Instance(this, this.#engine, state);
    this.instances.push(instance);
    this.#engine.entities.set(instance);

    return instance;
  }

  /**
   * @param {Instance} instance
   */
  uninstantiate(instance) {
    if (instance.body !== this) return;

    const index = this.instances.indexOf(instance);
    this.#engine.entities.delete(instance);

    if (index !== -1) {
      this.instances.splice(index, 1);
    }
  }

  /**
   * @template {StepConstructor} A
   * @param {A} Action
   * @param {ConstructorParameters<A>[0]} data
   * @returns {InstanceType<A>}
   */
  createStep(Action, data) {
    const step = new Action(data, generateName(Action.name, this.#stack, ({ name }) => name), this, this.#engine);
    this.#importStep(step);
    return /** @type {InstanceType<A>} */ (step);
  }

  /**
   * @param {AnyStep} step
   */
  removeStep(step) {
    const index = this.#stack.indexOf(step);
    if (index === -1) return;

    this.#stack.splice(index, 1);
    if (this.#step >= index) {
      --this.#step;
    }

    this.recalculateBoundingBox();
    step.uninit();

    this.#stack[index + 1]?.recompute();

    this.#engine.emit('scenechange');
    this.#engine.emit('bodyedited', this);
  }

  /**
   * @param {AnyStep} step
   */
  stepUpdated(step) {
    const index = this.#stack.indexOf(step);
    if (index === -1) return;

    const { currentStep } = this.#engine.scene;
    const currentStepIndex = currentStep?.body === this ? this.#stack.indexOf(currentStep) : -1;
    if (index < this.#step && (currentStepIndex < 0 || index < currentStepIndex)) {
      this.#stack[index + 1]?.recompute();
    }

    this.#engine.emit('stepedited', step);
    this.#engine.emit('scenechange');
  }

  /**
   * @template {AnyStep} [T=AnyStep]
   * @param {new (...args: any[]) => T} [Action]
   * @returns {T[]}
   */
  listSteps(Action) {
    /** @type {AnyStep[]} */
    const steps = [];

    for (const step of this.#stack) {
      if (!Action || (step instanceof Action)) {
        steps.push(step);
      }
    }

    return /** @type {T[]} */ (steps);
  }

  recalculateBoundingBox() {
    this.BoundingBox.reset();

    const { currentModel } = this;
    if (currentModel) {
      this.BoundingBox.data.set(currentModel.BoundingBox.data);
    }

    this.#engine.emit('boundingboxupdated', this);
  }

  /**
   * @param {boolean} [forceState]
   */
  toggleVisibility(forceState) {
    forceState ??= !this.State.visibility;
    if (this.State.visibility === forceState) return;

    this.State.visibility = forceState;
    this.#engine.emit('bodyedited', this);
    this.#engine.emit('scenechange');
  }
}
