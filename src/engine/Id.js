const { vec4 } = glMatrix;

export default class Id {
  static #counter = new Uint32Array(1);

  /** @type {number} */
  int;

  /** @type {vec4} */
  vec4;

  constructor() {
    this.int = ++Id.#counter[0];
    this.vec4 = Id.intToVec4(this.int);
  }

  /**
   * @param {Readonly<Uint8Array>} uuuu
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
