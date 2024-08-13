import Base from '../general/base.js';
import BoundingBox from './bounding-box.js';

/**
 * @typedef ModelData
 * @property {Uint16Array|Uint32Array} index
 * @property {Float32Array} vertex
 * @property {Float32Array} normal
 * @property {Uint8Array} color
 * @property {Uint16Array|Uint32Array} lineIndex
 */

/** @typedef {Record<keyof ModelData, number[]>} PlainModelData */
/** @typedef {Record<keyof ModelData, GLBuffer>} ModelBuffers */
/** @typedef {import("../cad/subinstance.js").default} SubInstance */

export default class Model extends Base.implement({ BoundingBox }) {
  /** @type {Engine["driver"]} */
  #driver;

  /** @type {WebGLRenderingContext} */
  #ctx;

  /** @type {import("../cad/body.js").default} */
  body;

  /** @type {ModelBuffers} */
  buffer;

  /** @type {ModelData} */
  data;

  /**
   * @param {Readonly<Partial<PlainModelData>> | undefined} data
   * @param {Model["body"]} body
   * @param {Engine["driver"]} driver
   */
  constructor(data, body, driver) {
    super({});

    this.#driver = driver;
    this.#ctx = driver.ctx;
    this.body = body;

    this.buffer = {
      index: this.#ctx.createBuffer(),
      vertex: this.#ctx.createBuffer(),
      normal: this.#ctx.createBuffer(),
      color: this.#ctx.createBuffer(),
      lineIndex: this.#ctx.createBuffer(),
    };

    this.import(data);

    this.data = this.assertProperty('data');
  }

  /**
   * @param {Readonly<Partial<PlainModelData>> | undefined} data
   */
  import(data) {
    this.data = {
      vertex: new Float32Array(data?.vertex ?? []),
      normal: new Float32Array(data?.normal ?? []),
      color: new Uint8Array(data?.color ?? []),
      index: new this.#driver.UintIndexArray(data?.index ?? []),
      lineIndex: new this.#driver.UintIndexArray(data?.lineIndex ?? []),
    };

    this.#ctx.bindBuffer(this.#ctx.ELEMENT_ARRAY_BUFFER, this.buffer.index);
    this.#ctx.bufferData(this.#ctx.ELEMENT_ARRAY_BUFFER, this.data.index, this.#ctx.STATIC_DRAW);

    this.#ctx.bindBuffer(this.#ctx.ARRAY_BUFFER, this.buffer.vertex);
    this.#ctx.bufferData(this.#ctx.ARRAY_BUFFER, this.data.vertex, this.#ctx.STATIC_DRAW);

    this.#ctx.bindBuffer(this.#ctx.ARRAY_BUFFER, this.buffer.normal);
    this.#ctx.bufferData(this.#ctx.ARRAY_BUFFER, this.data.normal, this.#ctx.STATIC_DRAW);

    this.#ctx.bindBuffer(this.#ctx.ARRAY_BUFFER, this.buffer.color);
    this.#ctx.bufferData(this.#ctx.ARRAY_BUFFER, this.data.color, this.#ctx.STATIC_DRAW);

    this.#ctx.bindBuffer(this.#ctx.ELEMENT_ARRAY_BUFFER, this.buffer.lineIndex);
    this.#ctx.bufferData(this.#ctx.ELEMENT_ARRAY_BUFFER, this.data.lineIndex, this.#ctx.STATIC_DRAW);

    if (data) this.recalculateBoundingBox();
  }

  /**
   * @returns {Model}
   */
  clone() {
    return new Model({
      vertex: [...this.data.vertex],
      normal: [...this.data.normal],
      color: [...this.data.color],
      index: [...this.data.index],
      lineIndex: [...this.data.lineIndex],
    }, this.body, this.#driver);
  }

  recalculateBoundingBox() {
    this.BoundingBox.reset();
    this.BoundingBox.expand(this.data.vertex);

    this.body.recalculateBoundingBox();
  }

  /**
   * @param  {...keyof ModelData} parts
   */
  update(...parts) {
    for (const part of parts) {
      const isIndex = this.data[part] instanceof Uint16Array || this.data[part] instanceof Uint32Array;
      const BUFFER_TYPE = isIndex ? this.#ctx.ELEMENT_ARRAY_BUFFER : this.#ctx.ARRAY_BUFFER;
      this.#ctx.bindBuffer(BUFFER_TYPE, this.buffer[part]);
      this.#ctx.bufferData(BUFFER_TYPE, this.data[part], this.#ctx.STATIC_DRAW);
    }

    if (parts.includes('vertex')) this.recalculateBoundingBox();
  }
}
