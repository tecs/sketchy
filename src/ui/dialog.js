import $ from './element.js';

export default class Dialog {
  element = $('dialog');

  /**
   * @param {HTMLElement} parent
   */
  constructor(parent) {
    parent.appendChild(this.element);
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
