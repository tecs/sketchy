import { $, UIContainer } from './lib/index.js';

/**
 * @template {import("./lib").HTMLTag} E
 * @augments UIContainer<E>
 */
export default class UI extends UIContainer {
  /** @type {import("./lib").UIMenu} */
  topMenu;

  /** @type {import("./lib").UIMenu} */
  leftMenu;

  /** @type {import("./lib").UIMenu} */
  rightMenu;

  /** @type {import("./lib").UIMenu} */
  bottomMenu;

  /** @type {import("./lib").UIDialog} */
  dialog;

  /** @type {import("./lib").UIWindows} */
  windows;

  canvas = $('canvas');

  /**
   * @param {import("./lib/element.js").ConcreteHTMLElement<E>} appContainer
   */
  constructor(appContainer) {
    super(appContainer);

    appContainer.appendChild(this.canvas);

    this.dialog = this.addDialog();
    this.topMenu = this.addMenu({ position: 'top' });
    this.leftMenu = this.addMenu({ position: 'left' });
    this.rightMenu = this.addMenu({ position: 'right' });
    this.bottomMenu = this.addMenu({ position: 'bottom' });
    this.windows = this.addWindows();
  }
}
