import $ from './element.js';

/**
 * @typedef Options
 * @property {"top"|"left"|"right"|"bottom"} position
 */

export default class Menu {
  /** @type {HTMLElement} */
  element;

  /** @type {Map<string, HTMLDivElement>} */
  items = new Map();

  /** @type {string | null} */
  selected = null;

  /**
   * @param {HTMLElement} parent
   * @param {Partial<Options>} options
   */
  constructor(parent, options = {}) {
    this.element = $('div', { className: `menu ${options.position ?? 'left'}` });
    parent.appendChild(this.element);
  }

  /**
   * @param {string} id
   * @param {string} name
   * @param {string} icon
   * @param {Function} onSelect
   */
  addItem(id, name, icon, onSelect) {
    const menuItem = $('div', {
      className: 'menuItem',
      title: name,
      innerText: icon,
      onclick: () => {
        if (this.selected !== id && !menuItem.classList.contains('disabled')) {
          onSelect();
        }
      },
    });

    this.element.appendChild(menuItem);
    this.items.set(id, menuItem);
  }

  /**
   * @param {string} id
   */
  select(id) {
    const previousItem = this.selected ? this.items.get(this.selected) : undefined;
    const item = this.items.get(id);
    if (item && item !== previousItem) {
      this.selected = id;
      item.classList.add('selected');
      previousItem?.classList.remove('selected');
    }
  }

  /**
   * @param {string} id
   * @param {boolean} [disabled]
   */
  toggleDisabled(id, disabled = true) {
    this.items.get(id)?.classList.toggle('disabled', disabled);
  }
}
