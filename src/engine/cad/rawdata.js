import Step from './step.js';

/** @typedef {import("../3d/model.js").PlainModelData} Data */
/** @typedef {import("./step.js").BaseParams<Data>} BaseParams */

export default class RawData extends /** @type {typeof Step<Data>} */ (Step) {
  /** @param {BaseParams} args */
  constructor(...args) {
    super(...args);
    this.#recompute();
  }

  static getType() {
    return 'RawData';
  }

  #recompute() {
    if (this.previousStep) {
      const message = 'Cannot add raw data to a non-empty body';
      this.body.emit('usererror', message);
      throw new Error(message);
    }

    this.model.import(this.data);
  }

  recompute() {
    super.recompute();
    this.#recompute();
  }
}
