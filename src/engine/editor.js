import Base from './general/base.js';
import Instance from './scene/instance.js';
import SubInstance from './cad/subinstance.js';

/**
 * @template {string} T
 * @typedef Element
 * @property {T} type
 * @property {number} index
 * @property {Instance} instance
 */

/** @typedef {Element<"point">} PointElement */
/** @typedef {Element<"line">} LineElement */
/** @typedef {Element<"instance">} InstanceElement */

/** @typedef {InstanceElement | LineElement | PointElement} Elements */

/** @typedef {import("./general/events-types").Event<"change", [current: Elements[], previous: Elements[]]>} Changed */

/**
 * @augments Base<Changed>
 */
export class Collection extends Base {
  /** @type {Elements[]} */
  elements = [];

  /**
   * @template {Elements} T
   * @param {T} el
   * @returns {T | null}
   */
  getElement(el) {
    for (const element of this.elements) {
      if (el.type === element.type && el.index === element.index && el.instance === element.instance) {
        return /** @type {T} */ (element);
      }
    }
    return null;
  }

  /**
   * @template {Elements["type"]} T
   * @param {T} type
   * @returns {Extract<Elements, { type: T }>[]}
   */
  getByType(type) {
    return /** @type {Extract<Elements, { type: T }>[]} */ (this.elements.filter(el => el.type === type));
  }

  clear() {
    if (!this.elements.length) return;

    const oldElements = this.elements;
    this.elements = [];
    this.emit('change', this.elements, oldElements);
  }

  /**
   * @param {Elements | Elements[]} elements
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
   * @param {Elements | Elements[]} elements
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
   * @param {Elements | Elements[]} elements
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
   * @param {Elements | Elements[]} elements
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
  selection = new Collection();
  edited = new Collection();

  /**
   * @param {Engine} engine
   */
  constructor(engine) {
    this.selection.on('change', (cur, prev) => engine.emit('selectionchange', cur, prev));

    engine.on('currentchange', () => this.reset());
    engine.on('entityremoved', (entity) => {
      if (!(entity instanceof Instance)) return;

      const deletedSelection = this.selection.getByType('instance')
        .filter(({ instance }) => SubInstance.belongsTo(instance, entity));
      this.selection.remove(deletedSelection);

      const deletedActives = this.edited.getByType('instance')
        .filter(({ instance }) => SubInstance.belongsTo(instance, entity));
      this.edited.remove(deletedActives);
    });
  }

  reset() {
    this.selection.clear();
    this.edited.clear();
  }
}
