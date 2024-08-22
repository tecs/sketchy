import UIContainer from './container.js';
import { $ } from './element.js';

/** @augments UIContainer<HTMLButtonElement,HTMLDivElement> */
class UITab extends UIContainer {
  /**
   * @param {string} name
   * @param {() => void} onClick
   */
  constructor(name, onClick) {
    super($('button', { onclick: onClick }));
    this.rename(name);
    this.container = $('div');
  }

  /**
   * @param {string} name
   */
  rename(name) {
    this.element.innerText = name;
  }

  hide() {
    const hidden = super.hide();
    if (hidden && this.parent instanceof UITabs) {
      this.parent.autoselect(this);
    }
    return hidden;
  }

  /**
   * @param {boolean} [reselect]
   * @returns {boolean}
   */
  show(reselect = false) {
    const shown = super.show();
    if (shown && reselect && this.parent instanceof UITabs) {
      this.parent.select(this);
    }
    return shown;
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
  constructor(contentsClass = '') {
    super($('div'));
    this.container = $('div');
    this.contents = new UIContainer($('div'));
    this.contents.$container({ className: contentsClass });
    this.element.appendChild(this.container);
    this.element.appendChild(this.contents.container);
  }

  /**
   * @param {string} name
   * @returns {UITab}
   */
  addTab(name) {
    const tab = this.addChild(new UITab(name, () => this.select(tab)));
    this.autoselect();
    return tab;
  }

  /**
   * @param {UITab | null} [omitTab]
   */
  autoselect(omitTab) {
    if (omitTab === this.selected) this.unselect(this.selected);
    for (const child of this.children) {
      if (this.selected) break;
      if (child instanceof UITab && child !== omitTab) this.select(child);
    }
  }

  /**
   * @param {UITab | null} tab
   */
  unselect(tab) {
    if (!tab || tab !== this.selected) return;

    this.selected = null;
    tab.container.remove();
    tab.element.classList.toggle('selected', false);
  }

  /**
   * @param {UITab} tab
   */
  select(tab) {
    if (tab === this.selected) return;

    if (this.children.has(tab)) {
      this.unselect(this.selected);
      this.selected = tab;
      tab.element.classList.toggle('selected', true);
      this.contents.container.appendChild(tab.container);
    }
  }

  /**
   * @param {import('.').UIElement<HTMLElement>} child
   * @returns {boolean}
   */
  removeChild(child) {
    const hadChild = super.removeChild(child);
    if (child instanceof UITab) this.autoselect(child);
    return hadChild;
  }
}
