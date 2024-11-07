import UIContainer from './container.js';
import { $ } from './element.js';

/** @typedef {import(".").UIButton} UIButton */

/**
 * @typedef Options
 * @property {"top"|"left"|"right"|"bottom"} position
 */

/** @augments UIContainer<"div"> */
export default class UIMenu extends UIContainer {
  /** @type {UIButton?} */
  selected = null;

  /**
   * @param {Partial<Options>} [options]
   */
  constructor(options = {}) {
    super($('div', { className: `menu ${options.position ?? 'left'}` }));
  }

  /**
   * @param {string} label
   * @param {() => void} onClick
   * @param {string} [title]
   * @returns {UIButton}
   */
  addButton(label, onClick, title = label) {
    const button = super.addButton(label, () => {
      if (this.selected !== button && !button.disabled) {
        onClick();
      }
    });
    button.$element({ title });
    return button;
  }

  /**
   * @param {UIButton} button
   */
  select(button) {
    const previousItem = this.selected;
    if (button !== previousItem && this.children.has(button)) {
      this.selected = button;
      button.element.classList.add('selected');
      previousItem?.element.classList.remove('selected');
    }
  }
}
