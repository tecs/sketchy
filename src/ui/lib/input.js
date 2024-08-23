import UIElement, { $ } from './element.js';

/** @augments UIElement<HTMLInputElement> */
export default class UIInput extends UIElement {
  /** @type {string} */
  get value() {
    return this.element.value;
  }

  /**
   * @param {string} value
   * @param {import('./element.js').HTMLElementProps<HTMLInputElement>} [options]
   */
  constructor(value, options = {}) {
    super($('input', { value, ...options }));
  }
}
