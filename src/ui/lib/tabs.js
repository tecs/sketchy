import UIContainer from './container.js';
import { $ } from './element.js';

/** @typedef {UITab} _UITab */

/**
 * @typedef AddTabOptions
 * @property {boolean} expandParent
 */

/** @augments UIContainer<"button","div"> */
class UITab extends UIContainer {
  /**
   * @param {string} name
   * @param {() => void} onClick
   * @param {Partial<AddTabOptions>} [options]
   */
  constructor(name, onClick, options = {}) {
    super($('button', { onclick: onClick }));
    this.rename(name);
    this.container = $('div');

    if (options.expandParent) this.$container({ style: { width: 'auto' } });
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
    if (shown && this.parent instanceof UITabs) {
      if (reselect) this.parent.select(this);
      else this.parent.autoselect();
    }
    return shown;
  }
}

/** @augments UIContainer<"div"> */
export default class UITabs extends UIContainer {
  /** @type {UIContainer<"div">} */
  contents;

  /** @type {UITab?} */
  selected = null;

  /**
   * @param {string} [contentsClass]
   */
  constructor(contentsClass = '') {
    super($('div'));
    const { container } = this.addContainer();
    this.contents = this.addContainer({ className: contentsClass });
    this.container = container;
  }

  /**
   * @param {string} name
   * @param {Partial<AddTabOptions>} [options]
   * @returns {UITab}
   */
  addTab(name, options) {
    const tab = this.addChild(new UITab(name, () => this.select(tab), options));
    this.autoselect();
    return tab;
  }

  /**
   * @param {UITab?} [omitTab]
   */
  autoselect(omitTab) {
    if (omitTab === this.selected) this.unselect(this.selected);
    for (const child of this.children) {
      if (this.selected) break;
      if (child instanceof UITab && child !== omitTab && !child.hidden) this.select(child);
    }
    if (!this.selected) this.hide();
  }

  /**
   * @param {UITab?} tab
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

    if (this.selected) this.show();
  }

  /**
   * @param {import(".").AnyUIElement} child
   * @returns {boolean}
   */
  removeChild(child) {
    const hadChild = super.removeChild(child);
    if (child instanceof UITab) this.autoselect(child);
    return hadChild;
  }
}
