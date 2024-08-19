import $, { UIContainer } from './element.js';

/**
 * @typedef Options
 * @property {"top"|"left"|"right"|"bottom"} position
 */

/** @augments UIContainer<HTMLDivElement> */
export default class UIMenu extends UIContainer {
  /** @type {string | null} */
  selected = null;

  /**
   * @param {Partial<Options>} [options]
   * @param {import('./element.js').AnyParent} [parent]
   */
  constructor(options = {}, parent = null) {
    super($('div', { className: `menu ${options.position ?? 'left'}` }), parent);
  }

  /**
   * @param {string} id
   * @param {string} label
   * @param {() => void} onClick
   * @param {string} [title]
   * @returns {import('./element.js').UIButton}
   */
  addButton(id, label, onClick, title = label) {
    const button = super.addButton(id, label, () => {
      if (this.selected !== id && !button.disabled) {
        onClick();
      }
    });
    button.$element({ title });
    return button;
  }

  /**
   * @param {string} id
   */
  select(id) {
    const previousItem = this.selected ? this.children.get(this.selected) : undefined;
    const item = this.children.get(id);
    if (item && item !== previousItem) {
      this.selected = id;
      item.element.classList.add('selected');
      previousItem?.element.classList.remove('selected');
    }
  }
}
