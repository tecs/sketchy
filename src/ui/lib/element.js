/** @typedef {import(".").AnyUIParent} AnyUIParent */
/** @typedef {Extract<WritableKeys<Filter<CSSStyleDeclaration, string>>, string>} WritableCSSProps */
/** @typedef {Partial<Record<WritableCSSProps, string>>} WritableCSSDeclaration */
/** @typedef {HTMLElement | keyof HTMLElementTagNameMap} HTMLElementRepresentation */

/**
 * @template {HTMLElementRepresentation} E
 * @typedef {Partial<Omit<ConcreteHTMLElement<E>, "style">> & { style?: WritableCSSDeclaration }} HTMLElementProps
 */

/* eslint-disable jsdoc/valid-types */
/**
 * @template {HTMLElementRepresentation} T
 * @typedef {T extends keyof HTMLElementTagNameMap ? HTMLElementTagNameMap[T] : T} ConcreteHTMLElement
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
 * @template {HTMLElement} E
 */
export default class UIElement {
  #previousDisplay = '';

  /** @type {E} */
  element;

  /** @type {AnyUIParent | null} */
  parent = null;

  /**
   * @param {E} element
   */
  constructor(element) {
    this.element = element;
  }

  /**
   * @template {HTMLElementRepresentation} T
   * @param {Opts<E, T>[1]} [attributes]
   * @param {Opts<E, T>[2]} [children]
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
