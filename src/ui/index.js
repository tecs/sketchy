import $, { UIContainer } from './element.js';
import UIDialog from './dialog.js';
import UIMenu from './menu.js';
import UIWindows from './window.js';

/**
 * @template {HTMLElement} E
 * @augments UIContainer<E>
 */
export default class UI extends UIContainer {
  /** @type {UIMenu} */
  topMenu;

  /** @type {UIMenu} */
  leftMenu;

  /** @type {UIMenu} */
  bottomMenu;

  /** @type {UIDialog} */
  dialog;

  /** @type {UIWindows} */
  windows;

  canvas = $('canvas');

  /**
   * @param {E} appContainer
   */
  constructor(appContainer) {
    super(appContainer);

    appContainer.appendChild(this.canvas);

    this.dialog = this.addChild('dialog', new UIDialog());
    this.topMenu = this.addChild('topMenu', new UIMenu({ position: 'top' }));
    this.leftMenu = this.addChild('leftMenu', new UIMenu({ position: 'left' }));
    this.bottomMenu = this.addChild('bottomMenu', new UIMenu({ position: 'bottom' }));
    this.windows = this.addChild('window', new UIWindows());
  }
}
