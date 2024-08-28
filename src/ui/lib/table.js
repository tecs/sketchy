import UIContainer from './container.js';
import { $ } from './element.js';

/** @augments UIContainer<"td"|"th"> */
class UICell extends UIContainer {
  /**
   * @param {boolean} [header]
   */
  constructor(header = false) {
    super($(header ? 'th' : 'td'));
  }
}

/**
 * @template {number} S
 * @augments UIContainer<"tr">
 */
class UIRow extends UIContainer {
  /** @type {Tuple<UICell, S>} */
  cells;

  /**
   * @param {S} cols
   * @param {number} [headers]
   */
  constructor(cols, headers = 0) {
    super($('tr'));
    this.cells = /** @type {Tuple<UICell, S>} */ ([...Array(cols)]
      .map((_, i) => this.addChild(new UICell(i < headers))));
  }

  /**
   * @param {OptionalTuple<string, S>} labels
   */
  setLabels(...labels) {
    for (const cell of /** @type {UICell[]} */ (this.cells)) {
      const label = /** @type {string[]} */ (labels).shift();
      if (label === undefined) break;
      cell.addLabel(label);
    }
  }
}

/**
 * @template {number} S
 * @augments UIContainer<"table">
 */
export default class UITable extends UIContainer {
  /** @type {S} */
  #cols;

  /**
   * @param {S} cols
   */
  constructor(cols) {
    super($('table'));
    this.#cols = cols;
  }

  /**
   * @param {OptionalTuple<string, S>} labels
   * @returns {UIRow<S>}
   */
  addRow(...labels) {
    const row = this.addChild(new UIRow(this.#cols));
    row.setLabels(...labels);
    return row;
  }

  /**
   * @param {OptionalTuple<string, S>} labels
   * @returns {UIRow<S>}
   */
  addHeader(...labels) {
    const row = this.addChild(new UIRow(this.#cols, this.#cols));
    row.setLabels(...labels);
    return row;
  }

  /**
   * @param {number} headers
   * @param {OptionalTuple<string, S>} labels
   * @returns {UIRow<S>}
   */
  addMixedRow(headers, ...labels) {
    const row = this.addChild(new UIRow(this.#cols, headers));
    row.setLabels(...labels);
    return row;
  }
}
