import $ from './element.js';

/**
 * @typedef AddWindowParams
 * @property {string} id
 * @property {string} title
 * @property {(id: string) => void} [onClose]
 * @property {HTMLElement[]} contents
 *
 * @typedef WindowData
 * @property {AddWindowParams["onClose"]} onClose
 * @property  {HTMLElement} ref
 */

export default class Window {
  /** @type {HTMLElement} */
  #parent;

  /** @type {Record<string, WindowData>} */
  windows = {};

  /**
   * @param {HTMLElement} parent
   */
  constructor(parent) {
    this.#parent = parent;
  }

  /**
   * @param {AddWindowParams} props
   */
  add({ id, title, onClose, contents }) {
    if (id in this.windows) this.remove(id);

    const ref = $('dialog', {}, [
      ['div', { className: 'windowTitle', innerText: title }, [
        ['button', { className: 'dialogClose button', innerText: '⨯', onclick: () => this.remove(id) }],
      ]],
      ['div', { className: 'windowBody' }, contents],
    ]);

    this.#parent.appendChild(ref);

    this.windows[id] = { onClose, ref };

    ref.showModal();
  }

  /**
   * @param {string} id
   */
  remove(id) {
    if (id in this.windows) {
      this.windows[id].onClose?.(id);
      this.windows[id].ref.remove();
      delete this.windows[id];
    }
  }
}
