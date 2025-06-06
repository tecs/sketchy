import UIElement, { $ } from './element.js';

/** @augments UIElement<"label"> */
export default class UILabel extends UIElement {
  /**
   * @param {string} label
   */
  constructor(label) {
    super($('label', { innerText: label }));
  }

  /**
   * @param {string} label
   */
  text(label) {
    this.$element({ innerText: label });
  }
}
