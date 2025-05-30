import { generateName, implement } from '../general/base.js';
import { Properties } from '../general/properties.js';
import Id from '../general/id.js';
import State from '../general/state.js';
import Placement, { defaultTrs } from '../3d/placement.js';

const { mat4 } = glMatrix;

/** @typedef {import("../cad/body").default} Body */

/**
 * @typedef InstanceState
 * @property {string} id
 * @property {string} name
 * @property {import("../entities.js").Key} bodyId
 * @property {boolean} visibility
 * @property {PlainMat4} trs
 */

export default class Instance extends implement({
  Id,
  Placement,
  State: State.withDefaults(/** @type {InstanceState} */ ({
    id: '',
    name: '',
    bodyId: '',
    trs: defaultTrs,
    visibility: true,
  })),
  Properties,
}) {
  /** @type {Body} */
  body;

  /** @type {Engine} */
  engine;

  get name() {
    return this.State.name;
  }

  /**
   * @param {Instance["body"]} body
   * @param {Instance["engine"]} engine
   * @param {Partial<InstanceState>} [state]
   */
  constructor(body, engine, state) {
    super({
      Id: [state?.id],
      State: [
        undefined,
        {
          onExport: () => ({
            ...this.State,
            ...this.Placement.State.export(),
          }),
          onImport: ({ trs }) => {
            this.Placement.set(trs);
            engine.emit('instancetransformed', this, this.Placement.trs);
          },
        },
      ],
      Properties: [
        () => ({
          General: {
            Id: { value: this.Id.str, type: 'plain' },
            Name: {
              value: this.name,
              type: 'plain',
              onEdit: (name) => {
                if (name && name !== this.State.name) {
                  this.State.name = generateName(name, engine.entities.values(Instance), instance => instance.name);
                  this.engine.emit('instanceedited', this);
                }
              },
            },
            Body: { value: body.name, type: 'plain' },
          },
          ...this.Placement.Properties.map(prop => {
            const newProp = { ...prop };
            const { onEdit } = prop;

            if (onEdit) newProp.onEdit = /** @param {unknown[]} args */ (...args) => {
              const transform = mat4.clone(this.Placement.inverseTrs);
              /** @type {Function} */ (onEdit)(...args);
              this.Placement.toGlobalTransformation(transform, transform);
              this.engine.emit('instancetransformed', this, transform);
              this.engine.emit('instanceedited', this);
              this.engine.emit('scenechange');
            };

            return newProp;
          }),
          Appearance: {
            Visibility: {
              value: this.State.visibility,
              type: 'boolean',
              onEdit: (visibility) => this.toggleVisibility(visibility),
            },
          },
        }),
      ],
    });

    this.State.import({
      id: this.Id.str,
      name: state?.name ?? '',
      bodyId: body.Id.str,
      trs: state?.trs ?? this.Placement.State.export().trs,
      visibility: state?.visibility ?? true,
    }, !!state?.trs);

    this.body = body;
    this.engine = engine;
    if (this.State.name === '') {
      this.State.name = generateName(this.body.name, engine.entities.values(Instance), instance => instance.name);
    }
  }

  /**
   * @param {ReadonlyMat4} transformation
   */
  transformGlobal(transformation) {
    this.Placement.transformGlobal(transformation);
    this.engine.emit('instancetransformed', this, transformation);
    this.engine.emit('instanceedited', this);
    this.engine.emit('scenechange');
  }

  /**
   * @param {ReadonlyVec3} translation
   */
  translate(translation) {
    this.Placement.translate(translation);
    this.engine.emit('instancetranslated', this, translation);
    this.engine.emit('instanceedited', this);
    this.engine.emit('scenechange');
  }

  /**
   * @param {ReadonlyVec3} factor
   */
  scale(factor) {
    this.Placement.scale(factor);
    this.engine.emit('instancescaled', this, factor);
    this.engine.emit('instanceedited', this);
    this.engine.emit('scenechange');
  }

  /**
   * @param {number} angle
   * @param {ReadonlyVec3} axis
   */
  rotate(angle, axis) {
    this.Placement.rotate(angle, axis);
    this.engine.emit('instancerotated', this, angle, axis);
    this.engine.emit('instanceedited', this);
    this.engine.emit('scenechange');
  }

  /**
   * @param {boolean} [forceState]
   */
  toggleVisibility(forceState) {
    forceState ??= !this.State.visibility;
    if (this.State.visibility === forceState) return;

    this.State.visibility = forceState;
    this.engine.emit('instancevisibility', this, this.State.visibility);
    this.engine.emit('instanceedited', this);
    this.engine.emit('scenechange');
  }
}
