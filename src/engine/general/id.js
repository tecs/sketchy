const { vec4 } = glMatrix;

// not defined if the application is not served with https
const randomUUID = crypto.randomUUID?.bind(crypto) ?? (() => {
  const uuidBits = new Uint8Array(32);
  uuidBits[0] = 1;
  uuidBits[8] = 1;
  uuidBits[12] = 4;
  uuidBits[16] = 8;
  uuidBits[20] = 1;

  return () => Array.from(crypto.getRandomValues(new Uint8Array(32)), (v, i, c = uuidBits[i]) => (
    `${i && c ? '-' : ''}${c === 4 ? c : ((c ^ v & 15) >> (c / 4)).toString(16)}`
  )).join('');
})();

export default class Id {
  static #counter = new Uint32Array(1);

  /** @type {number} */
  int;

  /** @type {string} */
  str;

  /** @type {vec4} */
  vec4;

  /**
   * @param {string} [id]
   */
  constructor(id) {
    this.str = id ?? randomUUID();
    this.int = ++Id.#counter[0];
    this.vec4 = Id.intToVec4(this.int);
  }

  /**
   * @param {Readonly<Uint8Array | Uint8ClampedArray>} uuuu
   * @returns {number}
   */
  static uuuuToInt(uuuu) {
    return uuuu[0] + (uuuu[1] << 8) + (uuuu[2] << 16) + (uuuu[3] << 24);
  }

  /**
   * @param {number} id
   * @returns {vec4}
   */
  static intToVec4(id) {
    return vec4.fromValues(
      /* eslint-disable no-multi-spaces,space-in-parens */
      ( id        & 255) / 255,
      ((id >>  8) & 255) / 255,
      ((id >> 16) & 255) / 255,
      ((id >> 24) & 255) / 255,
      /* eslint-enable no-multi-spaces,space-in-parens */
    );
  }
}
