import $, { UIContainer } from './element.js';

/** @augments UIContainer<HTMLDialogElement,HTMLDivElement> */
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

/** @augments UIContainer<HTMLDivElement> */
export default class UIWindows extends UIContainer {
  /**
   * @param {import('./element.js').AnyParent} [parent]
   */
  constructor(parent) {
    super($('div'), parent);
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
   * @param {import('./element.js').UIElement<HTMLElement>} child
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
