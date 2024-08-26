import UIContainer from './container.js';
import { $ } from './element.js';

/** @augments UIContainer<"dialog","div"> */
class UIWindow extends UIContainer {
  /** @type {Function | undefined} */
  onClose;

  /**
   * @param {string} title
   * @param {Function} [onClose]
   */
  constructor(title, onClose) {
    super($('dialog', {}, [
      ['div', { className: 'windowTitle', innerText: title }, [
        ['button', { className: 'dialogClose button', innerText: '⨯', onclick: () => this.remove() }],
      ]],
    ]));

    this.container = $('div', { className: 'windowBody' });
    $(this.element, {}, [this.container]);

    this.onClose = onClose;
  }
}

/** @augments UIContainer<"div"> */
export default class UIWindows extends UIContainer {
  constructor() {
    super($('div'));
  }

  /**
   * @param {string} title
   * @param {Function} [onClose]
   * @returns {UIWindow}
   */
  addWindow(title, onClose) {
    const window = this.addChild(new UIWindow(title, onClose));
    window.element.showModal();
    return window;
  }

  /**
   * @param {import(".").AnyUIElement} child
   * @returns {boolean}
   */
  removeChild(child) {
    const hadChild = super.removeChild(child);
    if (hadChild && child instanceof UIWindow) {
      child.onClose?.();
    }
    return hadChild;
  }
}
