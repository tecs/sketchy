/** @typedef {import(".").AnyUIParent} AnyUIParent */
/** @typedef {import(".").HTMLTag} HTMLTag */
/** @typedef {import(".").HTMLElementRepresentation} HTMLElementRepresentation */
/** @typedef {Extract<WritableKeys<Filter<CSSStyleDeclaration, string>>, string>} WritableCSSProps */
/** @typedef {Partial<Record<WritableCSSProps, string>>} WritableCSSDeclaration */

/**
 * @template {HTMLElementRepresentation} E
 * @typedef {Partial<Omit<ConcreteHTMLElement<E>, "style">> & { style?: WritableCSSDeclaration }} HTMLElementProps
 */

/* eslint-disable jsdoc/valid-types */
/**
 * @template {HTMLElementRepresentation} T
 * @typedef {T extends HTMLTag ? HTMLElementTagNameMap[T] : T} ConcreteHTMLElement
 */

/**
 * @template {HTMLElementRepresentation} [T=HTMLElementRepresentation]
 * @template {HTMLElementRepresentation} [T2=HTMLElementRepresentation]
 * @typedef {[T, HTMLElementProps<T>?, (T2 extends HTMLElement ? T2 : Opts<T2>)[]?]} Opts
 */
/* eslint-enable jsdoc/valid-types */

/**
 * @template {HTMLElementRepresentation} T
 * @template {HTMLElementRepresentation} T2
 * @param {T} tag
 * @param {Opts<T, T2>[1]} [attributes]
 * @param {Opts<T, T2>[2]} [children]
 * @returns {ConcreteHTMLElement<T>}
 */
export const $ = (tag, attributes = {}, children = []) => {
  const el = /** @type {ConcreteHTMLElement<T>} */ (tag instanceof HTMLElement ? tag : document.createElement(tag));

  for (const [attr, value] of /** @type {[keyof typeof el, any][]} */ (Object.entries(attributes))) {
    if (attr === 'style') {
      for (const [prop, style] of /** @type {[WritableCSSProps, string][]} */ (Object.entries(value))) {
        el.style[prop] = style;
      }
    } else {
      el[attr] = value;
    }
  }

  for (const child of /** @type {(HTMLElement|Opts<T2>)[]} */ (children)) {
    el.appendChild(child instanceof HTMLElement ? child : $(...child));
  }

  return el;
};

/**
 * @template {HTMLTag} E
 */
export default class UIElement {
  #previousDisplay = '';

  /** @type {ConcreteHTMLElement<E>} */
  element;

  /** @type {AnyUIParent} */
  #parent = null;

  /** @type {AnyUIParent} */
  get parent() {
    return this.#parent;
  }

  /**
   * @param {ConcreteHTMLElement<E>} element
   */
  constructor(element) {
    this.element = element;
  }

  /**
   * @template {HTMLElementRepresentation} T
   * @param {Opts<ConcreteHTMLElement<E>, T>[1]} [attributes]
   * @param {Opts<E, T>[2]} [children]
   * @returns {ConcreteHTMLElement<E>}
   */
  $element(attributes = {}, children = []) {
    return /** @type {ConcreteHTMLElement<E>} */ ($(this.element, attributes, children));
  }

  /** @param {AnyUIParent} parent */
  setParent(parent) {
    const oldParent = this.#parent;
    this.#parent = parent;

    if (parent === oldParent) return;

    if (oldParent) {
      this.element.remove();
      oldParent.removeChild(this);
    }

    if (parent) {
      parent.container.appendChild(this.element);
      parent.addChild(this);
    }
  }

  remove() {
    this.setParent(null);
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
