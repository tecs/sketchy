import UIContainer from './container.js';
import { $ } from './element.js';

/** @augments UIContainer<"fieldset"> */
export default class UIGroup extends UIContainer {
  #legend = $('legend');

  /**
   * @param {string} name
   */
  constructor(name) {
    super($('fieldset'));
    this.$element({ }, [this.#legend]);
    this.rename(name);
  }

  /**
   * @param {string} name
   */
  rename(name) {
    this.#legend.innerText = name;
  }
}
