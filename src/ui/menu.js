export default class Menu {
  element = document.createElement('div');

  /** @type {Map<string, HTMLDivElement>} */
  items = new Map();

  /** @type {string | null} */
  selected = null;

  /**
   * @param {HTMLElement} parent
   */
  constructor(parent) {
    this.element.className = 'menu';

    parent.appendChild(this.element);
  }

  /**
   * @param {string} id
   * @param {string} name
   * @param {string} icon
   * @param {Function} onSelect
   */
  addItem(id, name, icon, onSelect) {
    const menuItem = document.createElement('div');
    menuItem.className = 'menuItem';
    menuItem.title = name;
    menuItem.innerText = icon;

    menuItem.addEventListener('click', () => {
      if (this.selected !== id) onSelect();
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
}
