const { vec2, vec4 } = glMatrix;

// cached structures
const tempVec2 = vec2.create();
const vec4Black = vec4.fromValues(0, 0, 0, 1);

/** @typedef {Readonly<import("../engine/driver").default>} Driver */

export default class Font {
  static NUMERIC = '0123456789';
  static UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  static LOWERCASE = 'abcdefghijklmnopqrstuvwxyz';
  static SYMBOLS = ' !"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~';
  static LETTERS_EXTENDED = 'ŠŒŽÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝŸÞšœžàáâãäåæçèéêëìíîïðñòóôõöøùúûüýÿþß';
  static SYMBOLS_EXTENDED = '€‚ƒ„…†‡ˆ‰‹‘’“”•–—˜™›¡¢£¤¥¦§¨©ª«¬®¯°±²³´µ¶·¸¹º»¼½¾¿×÷';
  static LETTERS = this.UPPERCASE + this.LOWERCASE;
  static ALPHANUMERIC = this.LETTERS + this.NUMERIC;
  static PRINTABLE_ASCII = this.ALPHANUMERIC + this.SYMBOLS;
  static PRINTABLE_ASCII_EXTENDED = this.PRINTABLE_ASCII + this.LETTERS_EXTENDED + this.SYMBOLS_EXTENDED;

  /** @type {Driver} */
  #driver;

  /** @type {OffscreenCanvasRenderingContext2D} */
  #ctx2d;

  /** @type {OffscreenCanvasRenderingContext2D} */
  #ctxChar;

  /** @type {Record<string, number>} */
  #charMap = { 'MISSING': 0 };

  /** @type {number} */
  #blockSize;

  /** @typedef {GLBuffer} */
  #charBuffer;

  /** @typedef {GLBuffer} */
  #charIndex;

  /** @typedef {GLBuffer} */
  #texBuffer;

  #coords = new Float32Array([1, 1]);
  #texCoords = new Float32Array([0, 0]);
  #nChars = 1;

  /** @type {WebGLTexture?} */
  texture;

  /** @typedef {Program} */
  program;

  /** @type {number} */
  charSize;

  /** @type {number} */
  halfChar;

  /** @type {number} */
  thirdChar;

  /** @type {number} */
  twoThirdsChar;

  /** @type {number} */
  quarterChar;

  /** @type {number} */
  threeQuartersChar;

  /**
   * @param {number} charSize
   * @param {Driver} driver
   */
  constructor(charSize, driver) {

    const ctx2d = new OffscreenCanvas(0, 0).getContext('2d', { willReadFrequently: true });
    const ctxChar = new OffscreenCanvas(charSize, charSize).getContext('2d');

    if (!ctx2d || !ctxChar) throw new Error('Cannot initialize a CanvasRenderingContext2d');

    this.#driver = driver;
    this.#ctx2d = ctx2d;
    this.#ctxChar = ctxChar;

    this.#blockSize = charSize + 2;

    this.charSize = charSize;
    this.halfChar = charSize * 0.5;
    this.thirdChar = charSize / 3;
    this.twoThirdsChar = charSize * 2 / 3;
    this.quarterChar = charSize * 0.25;
    this.threeQuartersChar = charSize * 0.75;

    this.texture = driver.ctx.createTexture();

    this.#charBuffer = driver.buffer(new Float32Array([-0.5, 0.5, 0.5, 0.5, -0.5, -0.5, 0.5, -0.5]));
    this.#charIndex = driver.buffer(new Uint16Array([0, 1, 2, 1, 2, 3]));
    this.#texBuffer = driver.buffer(new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]));

    this.program = driver.makeProgram(
      driver.vert`
        attribute vec2 a_position;
        attribute vec2 a_coord;

        uniform vec2 u_scale;
        uniform vec2 u_offset;
        uniform vec2 u_origin;
        uniform vec2 u_textOffset;
        uniform mat4 u_mvp;
        uniform float u_distance;

        varying vec2 v_textCoord;

        void main() {
          vec2 pos = u_scale * (a_position + u_offset);
          // offset the coord a tiny bit away from its sketch attachment
          // so that labels render in front of any underlying geometry
          vec4 coord = vec4(u_origin + pos * u_distance, -0.00002, 1);
          gl_Position = u_mvp * coord;
          gl_Position.xy += pos * gl_Position.z * (1.0 - min(1.0, ceil(u_distance)));

          v_textCoord = a_coord + u_textOffset;
        }
      `,
      driver.frag`
        precision mediump float;

        uniform sampler2D u_texture;
        uniform vec4 u_color;
        uniform float u_alias;

        varying vec2 v_textCoord;

        void main() {
          float alpha = texture2D(u_texture, v_textCoord).a;
          alpha = u_alias * alpha + (1.0 - u_alias) * ceil(alpha);
          gl_FragColor = u_color * alpha;
        }
      `,
    );

    this.#init();
  }

  /**
   * @param {string} chars
   * @param {string} typeface
   */
  setCharsFromTypeface(chars, typeface) {
    this.#ctxChar.font = `${this.charSize}px ${typeface}`;
    const halfBlock = this.#blockSize * 0.5;
    for (const char of chars) {
      this.#ctxChar.fillText(char, halfBlock, halfBlock);
      this.#commitChar(char);
    }

    this.#recompute();
  }

  /**
   * @param {string} char
   * @param {(ctx: Readonly<OffscreenCanvasRenderingContext2D>, font: this) => void} fn
   */
  setChar(char, fn) {
    fn(this.#ctxChar, this);
    this.#commitChar(char);
    this.#recompute();
  }

  /**
   * @param {ReadonlyMat4} mvp
   * @param {ReadonlyVec2} screenScale
   * @param {0 | 1} [alias]
   */
  enable(mvp, screenScale, alias = 1) {
    const { ctx } = this.#driver;
    const { program } = this;

    ctx.useProgram(program.program);

    ctx.bindBuffer(ctx.ELEMENT_ARRAY_BUFFER, this.#charIndex);

    ctx.enableVertexAttribArray(program.aLoc.a_position);
    ctx.bindBuffer(ctx.ARRAY_BUFFER, this.#charBuffer);
    ctx.vertexAttribPointer(program.aLoc.a_position, 2, ctx.FLOAT, false, 0, 0);

    ctx.enableVertexAttribArray(program.aLoc.a_coord);
    ctx.bindBuffer(ctx.ARRAY_BUFFER, this.#texBuffer);
    ctx.vertexAttribPointer(program.aLoc.a_coord, 2, ctx.FLOAT, false, 0, 0);

    ctx.activeTexture(ctx.TEXTURE0);
    ctx.bindTexture(ctx.TEXTURE_2D, this.texture);
    ctx.uniform1i(program.uLoc.u_texture, 0);

    ctx.uniformMatrix4fv(program.uLoc.u_mvp, false, mvp);

    vec2.scale(tempVec2, screenScale, this.charSize);
    ctx.uniform2fv(program.uLoc.u_scale, tempVec2);

    ctx.uniform1f(program.uLoc.u_alias, alias);
  }

  /**
   * @param {string} text
   * @param {ReadonlyVec2} coords
   * @param {ReadonlyVec4} [color]
   * @param {number} [distance]
   */
  renderText(text, coords, color = vec4Black, distance = 0) {
    const { ctx } = this.#driver;
    const { program } = this;
    ctx.uniform1f(program.uLoc.u_distance, distance);
    ctx.uniform2fv(program.uLoc.u_origin, coords);
    ctx.uniform4fv(program.uLoc.u_color, color);
    for (let o = 0; o < text.length; ++o) {
      vec2.set(tempVec2, o - (text.length - 1) * 0.5, 0);
      ctx.uniform2fv(program.uLoc.u_offset, tempVec2);

      const c = this.#charMap[text[o]] ?? 0;
      ctx.uniform2fv(program.uLoc.u_textOffset, this.#texCoords.subarray(c, c + 2));

      ctx.drawElements(ctx.TRIANGLES, 6, ctx.UNSIGNED_SHORT, 0);
    }
  }

  #init() {
    this.#ctx2d.canvas.width = this.#blockSize;
    this.#ctx2d.canvas.height = this.#blockSize;
    this.#ctxChar.textAlign = 'center';
    this.#ctxChar.textBaseline = 'middle';
    this.#ctxChar.fillStyle = 'white';
    this.#ctxChar.strokeStyle = 'white';
    this.#ctxChar.lineWidth = 2;
  }

  /**
   * @param {string} char
   */
  #commitChar(char) {
    if (!(char in this.#charMap)) {
      this.#charMap[char] = 2 * this.#nChars;
      this.#expand();
    }
    const n = this.#charMap[char];
    const [x, y] = this.#coords.subarray(n, n + 2);

    this.#ctx2d.clearRect(x, y, this.charSize, this.charSize);
    this.#ctx2d.drawImage(this.#ctxChar.canvas, x, y);
    this.#ctxChar.resetTransform();
    this.#ctxChar.clearRect(0, 0, this.charSize, this.charSize);
  }

  #expand() {
    if (this.#nChars++ * 2 + 2 <= this.#coords.length) return;
    const nSide = Math.ceil(Math.sqrt(this.#nChars));

    const oldCoords = this.#coords;
    const oldCanvasSide = this.#ctx2d.canvas.width;
    const canvasSide = Math.pow(2, Math.ceil(Math.log2(nSide * this.#blockSize)));
    if (canvasSide > oldCanvasSide) {
      const oldData = this.#ctx2d.getImageData(0, 0, oldCanvasSide, oldCanvasSide);

      this.#ctx2d.canvas.width = canvasSide;
      this.#ctx2d.canvas.height = canvasSide;

      this.#ctx2d.clearRect(0, 0, canvasSide, canvasSide);
      this.#ctx2d.putImageData(oldData, 0, 0);
    }

    const oldElements = (nSide - 1) * (nSide - 1);
    const newElements = nSide * nSide - oldElements;
    this.#coords = new Float32Array(nSide * nSide * 2);
    this.#coords.set(oldCoords);

    for (let n = 0; n < newElements; ++n) {
      const i = oldElements + n;
      if (n < nSide) this.#coords.set([(nSide - 1) * this.#blockSize + 1, n * this.#blockSize + 1], i * 2);
      else this.#coords.set([(n - nSide) * this.#blockSize + 1, (nSide - 1) * this.#blockSize + 1], i * 2);
    }

    const texPixel = 1 / canvasSide;
    this.#texCoords = new Float32Array(nSide * nSide * 2);

    for (let i = 0; i < this.#coords.length; ++i) {
      this.#texCoords[i] = this.#coords[i] * texPixel;
    }

    const fract = this.#blockSize * texPixel;
    const { ctx } = this.#driver;

    ctx.bindBuffer(ctx.ARRAY_BUFFER, this.#texBuffer);
    ctx.bufferData(ctx.ARRAY_BUFFER, new Float32Array([
      texPixel, texPixel,
      fract - texPixel, texPixel,
      texPixel, fract - texPixel,
      fract - texPixel, fract - texPixel,
    ]), ctx.STATIC_DRAW);
  }

  #recompute() {
    const { ctx } = this.#driver;

    ctx.bindTexture(ctx.TEXTURE_2D, this.texture);
    ctx.texImage2D(ctx.TEXTURE_2D, 0, ctx.RGBA, ctx.RGBA, ctx.UNSIGNED_BYTE, this.#ctx2d.canvas);
    ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_MIN_FILTER, ctx.LINEAR);
    ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_WRAP_S, ctx.CLAMP_TO_EDGE);
    ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_WRAP_T, ctx.CLAMP_TO_EDGE);
  }
}
