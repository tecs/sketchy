import { $, UIContainer } from './lib/index.js';

/**
 * @template {import("./lib").HTMLTag} E
 * @augments UIContainer<E>
 */
export default class UI extends UIContainer {
  canvas = $('canvas');

  /**
   * @param {import("./lib/element.js").ConcreteHTMLElement<E>} appContainer
   */
  constructor(appContainer) {
    super(appContainer);

    appContainer.appendChild(this.canvas);
  }
}
