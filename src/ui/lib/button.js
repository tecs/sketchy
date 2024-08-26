import UIElement, { $ } from './element.js';

/** @augments UIElement<"button"> */
export default class UIButton extends UIElement {
  /** @type {boolean} */
  get disabled() {
    return this.element.disabled;
  }

  /**
   * @param {string} label
   * @param {() => void} onClick
   * @param {import("./element.js").Opts<"button">[1]} [options]
   */
  constructor(label, onClick, options = {}) {
    super($('button', { ...options, innerText: label, onclick: onClick }));
  }

  /**
   * @param {boolean} [disabled]
   */
  toggleDisabled(disabled = true) {
    this.element.disabled = disabled;
    this.element.classList.toggle('disabled', disabled);
  }
}
