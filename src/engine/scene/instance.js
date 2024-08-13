import { implement } from '../general/base.js';
import Id from '../general/id.js';
import State from '../general/state.js';
import Placement, { defaultTrs } from '../3d/placement.js';

/** @typedef {import("../cad/body").default} Body */

/**
 * @typedef InstanceState
 * @property {string} id
 * @property {import('../entities.js').Key} bodyId
 * @property {PlainMat4} trs
 */

export default class Instance extends implement({
  Id,
  Placement,
  State: State.withDefaults(/** @type {InstanceState} */ ({
    id: '',
    bodyId: '',
    trs: defaultTrs,
  })),
}) {
  /** @type {Body} */
  body;

  /** @type {Engine} */
  engine;

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
    });

    this.State.import({
      id: this.Id.str,
      bodyId: body.Id.str,
      trs: state?.trs ?? this.Placement.State.export().trs,
    }, !!state?.trs);

    this.body = body;
    this.engine = engine;
  }

  /**
   * @param {ReadonlyMat4} transformation
   */
  transformGlobal(transformation) {
    this.Placement.transformGlobal(transformation);
    this.engine.emit('instancetransformed', this, transformation);
  }

  /**
   * @param {ReadonlyVec3} translation
   */
  translateGlobal(translation) {
    this.Placement.translateGlobal(translation);
    this.engine.emit('instancetranslated', this, translation);
  }
}
