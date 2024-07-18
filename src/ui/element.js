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
const element = (tag, attributes = {}, children = []) => {
  const el = /** @type {HTMLElementTagNameMap[T]} */ (tag instanceof HTMLElement ? tag : document.createElement(tag));
  for (const [attr, value] of /** @type {[keyof el, any][]} */ (Object.entries(attributes))) {
    el[attr] = value;
  }

  for (const child of children) {
    el.appendChild(child instanceof HTMLElement ? child : element(...child));
  }

  return el;
};

export default element;
