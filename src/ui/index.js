import $ from './element.js';
import Dialog from './dialog.js';
import Menu from './menu.js';
import Window from './window.js';

export default class Ui {
  /** @type {HTMLElement} */
  appContainer;

  /** @type {Menu} */
  topMenu;

  /** @type {Menu} */
  sideMenu;

  /** @type {Dialog} */
  dialog;

  /** @type {Window} */
  window;

  canvas = $('canvas');
  /**
   * @param {HTMLElement} appContainer
   */
  constructor(appContainer) {
    appContainer.appendChild(this.canvas);

    this.appContainer = appContainer;
    this.dialog = new Dialog(appContainer);
    this.topMenu = new Menu(appContainer, { position: 'top' });
    this.sideMenu = new Menu(appContainer, { position: 'left' });
    this.window = new Window(appContainer);
  }
}
