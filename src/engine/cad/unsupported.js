import Step from './step.js';

/** @typedef {import("../general/state.js").Value} Value */

/**
 * @param {string} type
 * @param {import("./step.js").BaseParams<Value>} args
 * @returns {Step<Value>}
 */
export default (type, ...args) => new (class extends /** @type {typeof Step<Value>} */ (Step) {
  static getType() {
    return type;
  }
})(...args);
