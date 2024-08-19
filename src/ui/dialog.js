import $, { UIElement } from './element.js';

/** @augments UIElement<HTMLDialogElement> */
export default class UIDialog extends UIElement {
  element = $('dialog');

  /**
   * @param {import('./element.js').AnyParent} [parent]
   */
  constructor(parent = null) {
    super($('dialog'), parent);
  }

  /**
   * @param {string} message
   */
  error(message) {
    const onclick = () => this.hide();

    $(this.element, { className: 'error', innerHTML: '' }, [
      ['p', { className: 'dialogBody', innerText: message }],
      ['button', { className: 'dialogClose button', innerText: '⨯', onclick }],
      ['div', { className: 'dialogButtonWrapper' }, [
        ['button', { className: 'dialogConfirm button', innerText: 'OK', onclick }],
        ['button', { className: 'dialogCancel button', onclick }],
      ]],
    ]);

    this.element.showModal();
  }

  hide() {
    this.element.close();
    this.element.childNodes.forEach(child => this.element.removeChild(child));
  }
}
