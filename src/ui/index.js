import Dialog from './dialog.js';
import Menu from './menu.js';

export default class Ui {
  /** @type {HTMLElement} */
  appContainer;

  /** @type {Menu} */
  menu;

  /** @type {Dialog} */
  dialog;

  /**
   * @param {HTMLElement} appContainer
   */
  constructor(appContainer) {
    this.appContainer = appContainer;
    this.dialog = new Dialog(appContainer);
    this.menu = new Menu(appContainer);
  }
}
