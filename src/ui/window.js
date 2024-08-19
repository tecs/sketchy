import $, { UIContainer } from './element.js';

/** @augments UIContainer<HTMLDialogElement> */
class UIWindow extends UIContainer {
  /** @type {Function | undefined} */
  onClose;

  /**
   * @param {string} title
   * @param {() => void} [onClose]
   */
  constructor(title, onClose) {
    super($('dialog', {}, [
      ['div', { className: 'windowTitle', innerText: title }, [
        ['button', { className: 'dialogClose button', innerText: '⨯', onclick: onClose }],
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
   * @param {string} id
   * @param {string} title
   * @param {Function} [onClose]
   * @returns {UIWindow}
   */
  addWindow(id, title, onClose) {
    const window = this.addChild(id, new UIWindow(title, () => { this.removeChild(id); onClose?.(); }));
    window.element.showModal();
    return window;
  }

  /**
   * @param {string} id
   * @returns {import('./element.js').UIElement<HTMLElement> | undefined}
   */
  removeChild(id) {
    const child = super.removeChild(id);
    if (child instanceof UIWindow) {
      child.onClose?.();
    }
    return child;
  }
}
