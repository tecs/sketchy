import UIContainer from './container.js';
import { $ } from './element.js';

/** @augments UIContainer<"dialog","p"> */
export default class UIDialog extends UIContainer {
  /**
   * @param {string} message
   */
  constructor(message) {
    const p = $('p', { className: 'dialogBody', innerText: message });

    super($('dialog', { className: 'error', innerHTML: '' }, [
      p,
      ['button', { className: 'dialogClose button', innerText: '⨯', onclick: () => this.element.close() }],
      ['div', { className: 'dialogButtonWrapper' }, [
        ['button', { className: 'dialogConfirm button', innerText: 'OK', onclick: () => this.element.close() }],
        ['button', { className: 'dialogCancel button', onclick: () => this.element.close() }],
      ]],
    ]));

    this.container = p;
  }

  /**
   * @param {import(".").AnyUIParent} parent
   */
  setParent(parent) {
    super.setParent(parent);
    if (parent) this.element.showModal();
  }
}
