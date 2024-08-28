import UIContainer from './container.js';
import { $ } from './element.js';

/** @augments UIContainer<"dialog","div"> */
export default class UIWindow extends UIContainer {
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
    $(this.element, { onload: () => this.element.showModal() }, [this.container]);

    this.onClose = onClose;
  }

  /**
   * @param {import(".").AnyUIParent} parent
   */
  setParent(parent) {
    super.setParent(parent);
    if (!parent) this.onClose?.();
    else this.element.showModal();
  }
}
