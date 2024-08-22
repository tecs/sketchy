import UIElement, { $ } from './element.js';

/** @augments UIElement<HTMLInputElement> */
export default class UIInput extends UIElement {
  /** @type {string} */
  get value() {
    return this.element.value;
  }

  /**
   * @param {string} value
   * @param {Partial<HTMLElementTagNameMap["input"]>} [options]
   */
  constructor(value, options = {}) {
    super($('input', { value, ...options }));
  }
}
