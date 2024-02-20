import $ from './element.js';

/**
 * @typedef Options
 * @property {"top"|"left"|"right"|"bottom"} position
 */

export default class Menu {
  /** @type {HTMLElement} */
  element;

  /** @type {Map<string, HTMLElement>} */
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
   * @template {keyof HTMLElementTagNameMap} T
   * @param {string} id
   * @param {T | HTMLElement} tag
   * @param {Partial<HTMLElementTagNameMap[T]>} options
   * @returns {HTMLElementTagNameMap[T]}
   */
  addElement(id, tag, options) {
    const element = $(tag, options);
    this.element.appendChild(element);
    this.items.set(id, element);
    return /** @type {HTMLElementTagNameMap[T]} */ (element);
  }

  /**
   * @param {string} id
   * @param {string} name
   * @param {string} icon
   * @param {Function} onSelect
   */
  addItem(id, name, icon, onSelect) {
    const element = this.addElement(id, 'div', {
      className: 'menuItem',
      title: name,
      innerText: icon,
      onclick: () => {
        if (this.selected !== id && !element.classList.contains('disabled')) {
          onSelect();
        }
      },
    });
  }

  /**
   * @param {string} id
   * @param {string} text
   * @returns {HTMLDivElement}
   */
  addLabel(id, text) {
    return this.addElement(id, 'div', { className: 'menuLabel', innerText: text });
  }

  /**
   * @param {string} id
   * @param {string} value
   * @param {Partial<HTMLElementTagNameMap["input"]>} [options]
   * @returns {HTMLInputElement}
   */
  addInput(id, value, options = {}) {
    return this.addElement(id, 'input', { className: 'menuInput', value, ...options });
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
