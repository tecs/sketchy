import $, { UIContainer } from './element.js';

/** @augments UIContainer<HTMLButtonElement,HTMLDivElement> */
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

  /** @type {UITab | null} */
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
   * @param {UITab | null} tab
   */
  #unselect(tab) {
    if (!tab || tab !== this.selected) return;

    this.selected = null;
    tab.container.remove();
    tab.element.classList.toggle('selected', false);
  }

  /**
   * @param {string} name
   * @returns {UITab}
   */
  addTab(name) {
    const tab = this.addChild(new UITab($('button', { innerText: name, onclick: () => this.select(tab) })));

    if (!this.selected) {
      this.select(tab);
    }

    return tab;
  }

  /**
   * @param {UITab} tab
   */
  select(tab) {
    if (tab === this.selected) return;

    if (this.children.has(tab)) {
      this.#unselect(this.selected);
      this.selected = tab;
      tab.element.classList.toggle('selected', true);
      this.contents.container.appendChild(tab.container);
    }
  }

  /**
   * @param {import('./element.js').UIElement<HTMLElement>} child
   * @returns {boolean}
   */
  removeChild(child) {
    const hadChild = super.removeChild(child);
    if (child instanceof UITab) {
      this.#unselect(child);

      for (const newChild of this.children) {
        if (this.selected) break;
        if (newChild instanceof UITab) this.select(newChild);
      }
    }
    return hadChild;
  }
}
