import Base from './general/base.js';
import Instance from './scene/instance.js';
import SubInstance from './cad/subinstance.js';
import Input from './input.js';

/**
 * @typedef Element
 * @property {string} type
 * @property {number} id
 * @property {Instance} instance
 */

/**
 * @typedef CopyActionData
 * @property {Readonly<Element[]>} elements
 * @property {Function[]} onSuccess
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
      if (el.type === element.type && el.id === element.id && el.instance === element.instance) {
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
      a.findIndex(v2 => v.id === v2.id && v.type === v2.type && v.instance === v2.instance) === i,
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
  /** @type {Tuple<Collection, 4>} */
  #collections = [new Collection(), new Collection(), new Collection(), new Collection()];

  selection = this.#collections[0];
  clipboard = this.#collections[1];
  edited = this.#collections[2];
  temp = this.#collections[3];

  /**
   * @param {Engine} engine
   */
  constructor(engine) {
    this.selection.on('change', (cur, prev) => engine.emit('selectionchange', cur, prev));

    const copyShortcut = engine.config.createString('shortcuts.copy', 'Copy', 'key', Input.stringify(['ctrl', 'c']));
    const pasteShortcut = engine.config.createString('shortcuts.paste', 'Paste', 'key', Input.stringify(['ctrl', 'v']));
    engine.input.registerShortcuts(copyShortcut, pasteShortcut);

    engine.on('currentchange', () => this.reset(this.clipboard));
    engine.on('entityremoved', (entity) => {
      if (!(entity instanceof Instance)) return;

      for (const collection of this.#collections) {
        const deleted = collection.getByType('instance')
          .filter(({ instance }) => SubInstance.belongsTo(instance, entity));
        collection.remove(deleted);
      }
    });

    engine.on('shortcut', (shortcut) => {
      switch (shortcut) {
        case copyShortcut:
          this.clipboard.set(this.selection.elements);
          engine.emit('copy', this.clipboard);
          break;
        case pasteShortcut:
          if (!this.clipboard.elements.length) break;

          const onSuccess = /** @type {CopyActionData["onSuccess"]} */ ([]);

          const copyAction = engine.history.createAction('Paste elements', /** @type {CopyActionData} */ ({
            elements: this.clipboard.elements.slice(),
            onSuccess,
          }), () => onSuccess.forEach(fn => fn()));
          if (!copyAction) break;

          engine.emit('paste', copyAction);
          copyAction.commit();
          break;
      }
    });
  }

  /**
   * @param {Collection} [skipCollection]
   */
  reset(skipCollection) {
    for (const collection of this.#collections) {
      if (collection !== skipCollection) collection.clear();
    }
  }
}
