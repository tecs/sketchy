import UIContainer from './container.js';
import { $ } from './element.js';

/** @augments UIContainer<HTMLDialogElement,HTMLParagraphElement> */
export default class UIDialog extends UIContainer {
  constructor() {
    const p = $('p', { className: 'dialogBody' });

    super($('dialog', { className: 'error', innerHTML: '' }, [
      p,
      ['button', { className: 'dialogClose button', innerText: '⨯', onclick: () => this.hide() }],
      ['div', { className: 'dialogButtonWrapper' }, [
        ['button', { className: 'dialogConfirm button', innerText: 'OK', onclick: () => this.hide() }],
        ['button', { className: 'dialogCancel button', onclick: () => this.hide() }],
      ]],
    ]));

    this.container = p;
  }

  /**
   * @param {string} message
   */
  error(message) {
    this.$container({ innerText: message });
    this.element.showModal();
  }

  hide() {
    this.element.close();
    return true;
  }
}
