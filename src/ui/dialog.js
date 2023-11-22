export default class Dialog {
  element = document.createElement('dialog');
  elementBody = document.createElement('p');
  elementClose = document.createElement('button');
  elementCancel = document.createElement('button');
  elementConfirm = document.createElement('button');

  /**
   * @param {HTMLElement} parent
   */
  constructor(parent) {
    this.elementBody.className = 'dialogBody';
    this.elementClose.className = 'dialogClose button';
    this.elementCancel.className = 'dialogCancel button';
    this.elementConfirm.className = 'dialogConfirm button';

    this.elementClose.innerText = '⨯';

    this.elementClose.addEventListener('click', () => this.hide());
    this.elementCancel.addEventListener('click', () => this.hide());
    this.elementConfirm.addEventListener('click', () => this.hide());

    const buttonWrapper = document.createElement('div');
    buttonWrapper.className = 'dialogButtonWrapper';
    buttonWrapper.appendChild(this.elementConfirm);
    buttonWrapper.appendChild(this.elementCancel);

    this.element.appendChild(this.elementBody);
    this.element.appendChild(this.elementClose);
    this.element.appendChild(buttonWrapper);
    parent.appendChild(this.element);
  }

  /**
   * @param {string} message
   */
  error(message) {
    this.elementBody.innerText = message;
    this.elementConfirm.innerText = 'OK';
    this.element.className = 'error';
    this.element.showModal();
  }

  hide() {
    this.element.close();
  }
}
