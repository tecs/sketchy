/** @typedef {import(".").AnyUIParent} AnyUIParent */
/** @typedef {Extract<WritableKeys<Filter<CSSStyleDeclaration, string>>, string>} WritableCSSProps */

/**
 * @template {HTMLElement} E
 * @typedef {Partial<Omit<E, "style">> & { style?: Partial<Record<WritableCSSProps, string>> }} HTMLElementProps
 */

/**
 * @template {keyof HTMLElementTagNameMap} T
 * @template {keyof HTMLElementEventMap} E
 * @typedef {[T, HTMLElementProps<HTMLElementTagNameMap[T]>?, (HTMLElement | Opts<T, E>)[]?]} Opts
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
export const $ = (tag, attributes = {}, children = []) => {
  const el = /** @type {HTMLElementTagNameMap[T]} */ (tag instanceof HTMLElement ? tag : document.createElement(tag));

  for (const [attr, value] of /** @type {[keyof typeof el, any][]} */ (Object.entries(attributes))) {
    if (attr === 'style') {
      for (const [prop, style] of /** @type {[WritableCSSProps, string][]} */ (Object.entries(value))) {
        el.style[prop] = style;
      }
    } else {
      el[attr] = value;
    }
  }

  for (const child of children) {
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
   * @template {keyof HTMLElementTagNameMap} TM
   * @template {keyof HTMLElementEventMap} EM
   * @param {HTMLElementProps<E>} [attributes]
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
