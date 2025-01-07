import UIContainer from './container.js';
import { $ } from './element.js';

/** @typedef {import(".").UIButton} UIButton */

/**
 * @typedef Options
 * @property {"top"|"left"|"right"|"bottom"} position
 * @property {boolean} subMenu
 */

const defaultOptions = /** @type {Readonly<Options>} */ ({ position: 'left', subMenu: false });

/** @augments UIContainer<"div"> */
export default class UIMenu extends UIContainer {
  /** @type {Options} */
  #options;

  /** @type {UIButton?} */
  selected = null;

  /**
   * @param {Partial<Options>} [options]
   */
  constructor(options = {}) {
    const fullOptions = Object.assign({}, defaultOptions, options);
    super($('div', { className: `menu ${fullOptions.position} ${fullOptions.subMenu ? 'submenu' : ''}` }));
    this.#options = fullOptions;
  }

  /**
   * @param {string} label
   * @param {() => void} onClick
   * @param {string} [title]
   * @param {import('./element.js').WritableCSSDeclaration} [style]
   * @returns {UIButton}
   */
  addButton(label, onClick, title = label, style = {}) {
    const button = super.addButton(label, () => {
      if (this.selected !== button && !button.disabled) {
        onClick();
      }
    }, { style });
    button.$element({ title });
    return button;
  }

  /**
   * @returns {UIMenu}
   */
  addMenu() {
    const options = { ...this.#options, subMenu: true };

    switch (options.position) {
      case 'top': options.position = 'bottom'; break;
      case 'left': options.position = 'right'; break;
      case 'right': options.position = 'left'; break;
      case 'bottom': options.position = 'top'; break;
    }

    return super.addMenu(options);
  }

  /**
   * @param {UIButton?} button
   */
  select(button) {
    const previousItem = this.selected;
    if (button !== previousItem && (!button || this.children.has(button))) {
      this.selected = button;
      button?.element.classList.add('selected');
      previousItem?.element.classList.remove('selected');
    }
  }
}
