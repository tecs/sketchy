import $, { UIContainer } from './element.js';

/** @augments UIContainer<HTMLButtonElement> */
class UITab extends UIContainer {
  /**
   * @param {HTMLButtonElement} button
   */
  constructor(button) {
    super(button);
    this.container = $('div');
  }
}

/** @augments UIContainer<HTMLDivElement> */
export default class UITabs extends UIContainer {
  /** @type {UIContainer<HTMLDivElement>} */
  contents;

  /** @type {string | null} */
  selected = null;

  /**
   * @param {string} [contentsClass]
   */
  constructor(contentsClass) {
    super($('div'));
    this.container = $('div');
    this.contents = new UIContainer($('div'));
    this.contents.$container({ className: contentsClass });
    this.element.appendChild(this.container);
    this.element.appendChild(this.contents.container);
  }

  /**
   * @param {string | null} id
   */
  #unselect(id) {
    if (id === null || id !== this.selected) return;

    const tab = this.children.get(id);
    if (tab instanceof UITab) {
      this.selected = null;
      tab.container.remove();
      tab.element.classList.toggle('selected', false);
    }
  }

  /**
   * @param {string} id
   * @param {string} name
   * @returns {UITab}
   */
  addTab(id, name) {
    const tab = this.addChild(id, new UITab($('button', { innerText: name, onclick: () => this.select(id) })));

    if (this.selected === null) {
      this.select(id);
    }

    return tab;
  }

  /**
   * @param {string} id
   */
  select(id) {
    if (id === this.selected) return;

    const tab = this.children.get(id);
    if (tab instanceof UITab) {
      this.#unselect(this.selected);
      this.selected = id;
      tab.element.classList.toggle('selected', true);
      this.contents.container.appendChild(tab.container);
    }
  }

  /**
   * @param {string} id
   * @returns {import('./element.js').UIElement<any> | undefined}
   */
  removeChild(id) {
    const child = super.removeChild(id);
    if (child instanceof UITab) {
      this.#unselect(id);

      this.children.forEach((newChild, newId) => {
        if (this.selected === null && newChild instanceof UITab) {
          this.select(newId);
        }
      });
    }
    return child;
  }
}
