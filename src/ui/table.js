import $, { UIContainer } from './element.js';

/** @augments UIContainer<HTMLTableCellElement> */
class UICell extends UIContainer {
  constructor() {
    super($('td'));
  }
}

/**
 * @template {number} S
 * @augments UIContainer<HTMLTableRowElement>
 */
class UIRow extends UIContainer {
  /** @type {Tuple<UICell, S>} */
  cells;

  /**
   * @param {S} size
   */
  constructor(size) {
    super($('tr'));
    this.cells = /** @type {Tuple<UICell, S>} */ ([...Array(size)].map(() => this.addChild(new UICell())));
  }
}

/**
 * @template {number} S
 * @augments UIContainer<HTMLTableElement>
 */
export default class UITable extends UIContainer {
  /** @type {S} */
  #size;

  /**
   * @param {S} size
   */
  constructor(size) {
    super($('table'));
    this.#size = size;
  }

  /**
   * @param {OptionalTuple<string, S>} labels
   * @returns {UIRow<S>}
   */
  addRow(...labels) {
    const row = this.addChild(new UIRow(this.#size));
    for (const cell of /** @type {UICell[]} */ (row.cells)) {
      const label = /** @type {string[]} */ (labels).shift();
      if (label === undefined) break;
      cell.addLabel(label);
    }
    return row;
  }
}
