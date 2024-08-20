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
  #previousDisplay = '';

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
   * @template {keyof HTMLElementTagNameMap} TM
   * @template {keyof HTMLElementEventMap} EM
   * @param {Partial<E>} [attributes]
   * @param {(HTMLElement | Opts<TM, EM>)[]} [children]
   * @returns {E}
   */
  $element(attributes = {}, children = []) {
    return /** @type {E} */ ($(this.element, attributes, children));
  }

  remove() {
    this.parent?.removeChild(this);
  }

  /**
   * @returns {boolean}
   */
  hide() {
    if (this.element.style.display !== 'none') {
      this.#previousDisplay = this.element.style.display;
      this.element.style.display = 'none';
      return true;
    }
    return false;
  }

  /**
   * @returns {boolean}
   */
  show() {
    if (this.element.style.display === 'none') {
      this.element.style.display = this.#previousDisplay;
      return true;
    }
    return false;
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
 * @template {HTMLElement} [C=E]
 * @augments UIElement<E>
 */
export class UIContainer extends UIElement {
  /** @type {Set<UIElement<HTMLElement>>} */
  children = new Set();

  /** @type {C} */
  container;

  /**
   * @param {E} element
   * @param {AnyParent} [parent]
   */
  constructor(element, parent) {
    super(element, parent);
    this.container = /** @type {C} */ ( /** @type {HTMLElement} */ (element));
  }

  /**
   * @template {keyof HTMLElementTagNameMap} TM
   * @template {keyof HTMLElementEventMap} EM
   * @param {Partial<C>} [attributes]
   * @param {(HTMLElement | Opts<TM, EM>)[]} [children]
   * @returns {C}
   */
  $container(attributes = {}, children = []) {
    return /** @type {C} */ ($(this.container, attributes, children));
  }

  /**
   * @template {UIElement<HTMLElement>} E
   * @param {E} child
   * @returns {E}
   */
  addChild(child) {
    child.remove();
    child.parent = this;
    this.container.appendChild(child.element);
    this.children.add(child);
    return child;
  }

  /**
   * @param {UIElement<HTMLElement>} child
   * @returns {boolean}
   */
  removeChild(child) {
    if (this.children.delete(child)) {
      child.parent = null;
      child.element.remove();
      return true;
    }
    return false;
  }

  /**
   * @param {string} label
   * @param {() => void} onClick
   * @param {Partial<HTMLElementTagNameMap["button"]>} [options]
   * @returns {UIButton}
   */
  addButton(label, onClick, options) {
    return this.addChild(new UIButton(label, onClick, options));
  }

  /**
   * @param {string} label
   * @returns {UILabel}
   */
  addLabel(label) {
    return this.addChild(new UILabel(label));
  }

  /**
   * @param {string} value
   * @param {Partial<HTMLElementTagNameMap["input"]>} [options]
   * @returns {UIInput}
   */
  addInput(value, options) {
    return this.addChild(new UIInput(value, options));
  }

  /**
   * @returns {UIContainer<HTMLDivElement>}
   * @param {Partial<HTMLElementTagNameMap["div"]>} [options]
   */
  addContainer(options) {
    const container = this.addChild(new UIContainer($('div')));
    if (options) {
      $(container.element, options);
    }
    return container;
  }
}
