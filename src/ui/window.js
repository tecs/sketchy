/**
 * @typedef AddWindowParams
 * @property {string} id
 * @property {string} title
 * @property {(id: string) => void} [onClose]
 * @property {Element[]} contents
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

    const ref = document.createElement('dialog');

    const header = document.createElement('div');
    header.className = 'windowTitle';
    header.innerText = title;

    const close = document.createElement('button');
    close.className = 'dialogClose button';
    close.innerText = '⨯';
    close.addEventListener('click', () => this.remove(id));

    header.appendChild(close);

    const body = document.createElement('div');
    body.className = 'windowBody';

    for (const child of contents) body.appendChild(child);

    ref.appendChild(header);
    ref.appendChild(body);

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
