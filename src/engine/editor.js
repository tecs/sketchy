import Base from './general/base.js';
import Instance from './scene/instance.js';
import SubInstance from './cad/subinstance.js';

/**
 * @typedef Element
 * @property {string} type
 * @property {number} index
 * @property {Instance} instance
 */

/** @typedef {import("./general/events-types").Event<"change", [current: Element[], previous: Element[]]>} Changed */

/**
 * @augments Base<Changed>
 */
export class Collection extends Base {
  /** @type {Element[]} */
  elements = [];

  /**
   * @param {Element} el
   * @returns {Element?}
   */
  getElement(el) {
    for (const element of this.elements) {
      if (el.type === element.type && el.index === element.index && el.instance === element.instance) {
        return element;
      }
    }
    return null;
  }

  /**
   * @template {string} T
   * @param {T} type
   * @returns {(Element & { type: T })[]}
   */
  getByType(type) {
    return /** @type {(Element & { type: T })[]} */ (this.elements.filter(el => el.type === type));
  }

  clear() {
    if (!this.elements.length) return;

    const oldElements = this.elements;
    this.elements = [];
    this.emit('change', this.elements, oldElements);
  }

  /**
   * @param {Element | Element[]} elements
   */
  set(elements) {
    if (!Array.isArray(elements)) elements = [elements];

    const oldElements = this.elements;
    this.elements = [];
    for (const element of elements) {
      if (!this.getElement(element)) this.elements.push(element);
    }

    const changed = oldElements.length !== this.elements.length
      || oldElements.some(el => !this.getElement(el));
    if (changed) {
      this.emit('change', this.elements, oldElements);
    }
  }

  /**
   * @param {Element | Element[]} elements
   */
  add(elements) {
    if (!Array.isArray(elements)) elements = [elements];
    else if (!elements.length) return;

    let changed = false;
    const oldElements = this.elements.slice();
    for (const element of elements) {
      if (!this.getElement(element)) {
        this.elements.push(element);
        changed = true;
      }
    }
    if (changed) {
      this.emit('change', this.elements, oldElements);
    }
  }

  /**
   * @param {Element | Element[]} elements
   */
  remove(elements) {
    if (!Array.isArray(elements)) elements = [elements];
    else if (!elements.length) return;

    let changed = false;
    const oldElements = this.elements.slice();
    for (const element of elements) {
      const concreteElement = this.getElement(element);
      if (!concreteElement) continue;
      const index = this.elements.indexOf(concreteElement);
      this.elements.splice(index, 1);
      changed = true;
    }
    if (changed) {
      this.emit('change', this.elements, oldElements);
    }
  }

  /**
   * @param {Element | Element[]} elements
   * @param {boolean} [forceState]
   */
  toggle(elements, forceState) {
    if (!Array.isArray(elements)) elements = [elements];

    elements = elements.filter((v, i, a) =>
      a.findIndex(v2 => v.index === v2.index && v.type === v2.type && v.instance === v2.instance) === i,
    );
    if (!elements.length) return;

    const oldElements = this.elements.slice();

    for (const element of elements) {
      const concreteElement = this.getElement(element);
      if (!concreteElement && forceState !== false) this.elements.push(element);
      else if (concreteElement && forceState !== true) {
        const index = this.elements.indexOf(concreteElement);
        this.elements.splice(index, 1);
      }
    }

    this.emit('change', this.elements, oldElements);
  }
}

export default class Editor {
  /** @type {Tuple<Collection, 3>} */
  #collections = [new Collection(), new Collection(), new Collection()];

  selection = this.#collections[0];
  edited = this.#collections[1];
  temp = this.#collections[2];

  /**
   * @param {Engine} engine
   */
  constructor(engine) {
    this.selection.on('change', (cur, prev) => engine.emit('selectionchange', cur, prev));

    engine.on('currentchange', () => this.reset());
    engine.on('entityremoved', (entity) => {
      if (!(entity instanceof Instance)) return;

      for (const collection of this.#collections) {
        const deleted = collection.getByType('instance')
          .filter(({ instance }) => SubInstance.belongsTo(instance, entity));
        collection.remove(deleted);
      }
    });
  }

  reset() {
    for (const collection of this.#collections) {
      collection.clear();
    }
  }
}
