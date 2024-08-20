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
  rightMenu;

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

    this.dialog = this.addChild(new UIDialog());
    this.topMenu = this.addChild(new UIMenu({ position: 'top' }));
    this.leftMenu = this.addChild(new UIMenu({ position: 'left' }));
    this.rightMenu = this.addChild(new UIMenu({ position: 'right' }));
    this.bottomMenu = this.addChild(new UIMenu({ position: 'bottom' }));
    this.windows = this.addChild(new UIWindows());
  }
}
