/**
 * @template {keyof HTMLElementTagNameMap} T
 * @template {keyof HTMLElementEventMap} E
 * @typedef {[T, Partial<HTMLElementTagNameMap[T]>?, (HTMLElement | Opts<T, E>)[]?]} Opts
 */

/**
 * @template {keyof HTMLElementTagNameMap} T
 * @template {keyof HTMLElementTagNameMap} T2
 * @template {keyof HTMLElementEventMap} E
 * @param {T | HTMLElement} tag
 * @param {Opts<T, E>[1]} [attributes]
 * @param {Opts<T2, E>[2]} [children]
 * @returns {HTMLElementTagNameMap[T]}
 */
const $ = (tag, attributes = {}, children = []) => {
  const el = /** @type {HTMLElementTagNameMap[T]} */ (tag instanceof HTMLElement ? tag : document.createElement(tag));
  for (const [attr, value] of /** @type {[keyof el, any][]} */ (Object.entries(attributes))) {
    el[attr] = value;
  }

  for (const child of children) {
    el.appendChild(child instanceof HTMLElement ? child : $(...child));
  }

  return el;
};

export default $;

/** @typedef {UIContainer<HTMLElement> | null | undefined} AnyParent */

/**
 * @template {HTMLElement} E
 */
export class UIElement {
  /** @type {E} */
  element;

  /** @type {AnyParent | null} */
  parent = null;

  /**
   * @param {E} element
   * @param {AnyParent} [parent]
   */
  constructor(element, parent = null) {
    this.element = element;
    this.parent = parent;
  }

  /**
   * @template {keyof HTMLElementTagNameMap} T
   * @template {keyof HTMLElementEventMap} E
   * @param {Partial<this["element"]>} [attributes]
   * @param {(HTMLElement | Opts<T, E>)[]} [children]
   * @returns {this["element"]}
   */
  $element(attributes = {}, children = []) {
    return /** @type {this["element"]} */ ($(this.element, attributes, children));
  }

  remove() {
    this.parent?.children.forEach((child, id) => {
      if (child === this) {
        this.parent?.removeChild(id);
      }
    });
  }
}

/** @augments UIElement<HTMLButtonElement> */
export class UIButton extends UIElement {
  /** @type {boolean} */
  get disabled() {
    return this.element.disabled;
  }

  /**
   * @param {string} label
   * @param {() => void} onClick
   * @param {Partial<HTMLElementTagNameMap["button"]>} [options]
   */
  constructor(label, onClick, options = {}) {
    super($('button', { ...options, innerText: label, onclick: onClick }));
  }

  /**
   * @param {boolean} [disabled]
   */
  toggleDisabled(disabled = true) {
    this.element.disabled = disabled;
    this.element.classList.toggle('disabled', disabled);
  }
}

/** @augments UIElement<HTMLLabelElement> */
export class UILabel extends UIElement {
  /**
   * @param {string} label
   */
  constructor(label) {
    super($('label', { innerText: label }));
  }
}

/** @augments UIElement<HTMLInputElement> */
export class UIInput extends UIElement {
  /**
   * @param {string} value
   * @param {Partial<HTMLElementTagNameMap["input"]>} [options]
   */
  constructor(value, options = {}) {
    super($('input', { value, ...options }));
  }
}

/**
 * @template {HTMLElement} E
 * @augments UIElement<E>
 */
export class UIContainer extends UIElement {
  /** @type {Map<string, UIElement<HTMLElement>>} */
  children = new Map();

  /** @type {HTMLElement} */
  container;

  /**
   * @param {E} element
   * @param {AnyParent} [parent]
   */
  constructor(element, parent) {
    super(element, parent);
    this.container = element;
  }

  /**
   * @template {keyof HTMLElementTagNameMap} T
   * @template {keyof HTMLElementEventMap} E
   * @param {Partial<this["container"]>} [attributes]
   * @param {(HTMLElement | Opts<T, E>)[]} [children]
   * @returns {this["container"]}
   */
  $container(attributes = {}, children = []) {
    return /** @type {this["container"]} */ ($(this.container, attributes, children));
  }

  /**
   * @template {UIElement<HTMLElement>} E
   * @param {string} id
   * @param {E} child
   * @returns {E}
   */
  addChild(id, child) {
    if (child.parent) {
      child.parent.removeChild(id);
    }
    child.parent = this;
    this.container.appendChild(child.element);
    this.children.set(id, child);
    return child;
  }

  /**
   * @param {string} id
   * @returns {UIElement<HTMLElement> | undefined}
   */
  removeChild(id) {
    const child = this.children.get(id);
    if (child) {
      child.parent = null;
      child.element.remove();
      this.children.delete(id);
    }
    return child;
  }

  /**
   * @param {string} id
   * @param {string} label
   * @param {() => void} onClick
   * @param {Partial<HTMLElementTagNameMap["button"]>} [options]
   * @returns {UIButton}
   */
  addButton(id, label, onClick, options) {
    return this.addChild(id, new UIButton(label, onClick, options));
  }

  /**
   * @param {string} id
   * @param {string} label
   * @returns {UILabel}
   */
  addLabel(id, label) {
    return this.addChild(id, new UILabel(label));
  }

  /**
   * @param {string} id
   * @param {string} value
   * @param {Partial<HTMLElementTagNameMap["input"]>} [options]
   * @returns {UIInput}
   */
  addInput(id, value, options) {
    return this.addChild(id, new UIInput(value, options));
  }

  /**
   * @param {string} id
   * @returns {UIContainer<HTMLDivElement>}
   * @param {Partial<HTMLElementTagNameMap["div"]>} [options]
   */
  addContainer(id, options) {
    const container = this.addChild(id, new UIContainer($('div')));
    if (options) {
      $(container.element, options);
    }
    return container;
  }
}
