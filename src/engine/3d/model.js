import Base from '../general/base.js';
import BoundingBox from './boundingBox.js';

/**
 * @typedef ModelData
 * @property {Uint16Array|Uint32Array} index
 * @property {Float32Array} vertex
 * @property {Float32Array} normal
 * @property {Uint8Array} color
 * @property {Float32Array} lineVertex
 * @property {Uint16Array|Uint32Array} lineIndex
 */

/** @typedef {Record<keyof ModelData, number[]>} PlainModelData */
/** @typedef {Record<keyof ModelData, GLBuffer>} ModelBuffers */
/** @typedef {import("../scene/submodel.js").default} SubInstance */

export default class Model extends Base {
  /** @type {Engine["driver"]} */
  #driver;

  /** @type {WebGLRenderingContext} */
  #ctx;

  /** @type {SubModel[]} */
  subModels = [];

  /** @type {Instance[]} */
  instances = [];

  /** @type {string} */
  name;

  /** @type {ModelBuffers} */
  buffer;

  /** @type {ModelData} */
  data;

  boundingBox = new BoundingBox();

  /**
   * @param {string} name
   * @param {Readonly<Partial<PlainModelData>> | undefined} data
   * @param {Engine} engine
   */
  constructor(name, data, engine) {
    super();

    this.#driver = engine.driver;
    this.#ctx = engine.driver.ctx;

    this.name = name;
    this.buffer = {
      index: this.#ctx.createBuffer(),
      vertex: this.#ctx.createBuffer(),
      normal: this.#ctx.createBuffer(),
      color: this.#ctx.createBuffer(),
      lineIndex: this.#ctx.createBuffer(),
      lineVertex: this.#ctx.createBuffer(),
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
      lineVertex: new Float32Array(data?.lineVertex ?? []),
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

    this.#ctx.bindBuffer(this.#ctx.ARRAY_BUFFER, this.buffer.lineVertex);
    this.#ctx.bufferData(this.#ctx.ARRAY_BUFFER, this.data.lineVertex, this.#ctx.STATIC_DRAW);

    if (data) this.recalculateBoundingBox();
  }

  recalculateBoundingBox() {
    this.boundingBox.reset();
    this.boundingBox.expand(this.data.lineVertex);
    this.boundingBox.expand(this.data.vertex);

    const parentModels = /** @type {Model[]} */ ([]);
    for (const instance of this.instances) {
      const parentModel = instance.parent?.model;
      if (!parentModel || parentModels.includes(parentModel)) continue;
      parentModels.push(parentModel);
      parentModel.recalculateBoundingBox();
    }
  }

  /**
   * @param {Readonly<Float32Array|Uint16Array|Uint32Array|Uint8Array>} newData
   * @param {keyof ModelData} part
   * @param {boolean} [normalizeIndices]
   */
  appendBufferData(newData, part, normalizeIndices = true) {
    const oldData = this.data[part];
    const oldLength = oldData.length;

    const ArrayType = /** @type {new(param: number) => typeof oldData} */ (oldData.constructor);

    const isIndex = oldData instanceof Uint16Array || oldData instanceof Uint32Array;

    if (normalizeIndices && isIndex) {
      let lastIndex = -1;
      for (const i of oldData) {
        if (i > lastIndex) lastIndex = i;
      }
      newData = newData.map(i => i + lastIndex + 1);
    }

    const data = new ArrayType(oldLength + newData.length);
    Object.assign(this.data, { [part]: data });

    data.set(oldData);
    data.set(newData, oldLength);

    const BUFFER_TYPE = isIndex ? this.#ctx.ELEMENT_ARRAY_BUFFER : this.#ctx.ARRAY_BUFFER;
    this.#ctx.bindBuffer(BUFFER_TYPE, this.buffer[part]);
    this.#ctx.bufferData(BUFFER_TYPE, data, this.#ctx.STATIC_DRAW);

    if (part === 'lineVertex' || part === 'vertex') this.boundingBox.expand(/** @type {Float32Array} */ (newData));
  }

  /**
   * @param {keyof ModelData} part
   * @param {number} length
   */
  truncateBuffer(part, length) {
    const data = this.data[part].slice(0, -length);
    Object.assign(this.data, { [part]: data });

    const isIndex = data instanceof Uint16Array || data instanceof Uint32Array;
    const BUFFER_TYPE = isIndex ? this.#ctx.ELEMENT_ARRAY_BUFFER : this.#ctx.ARRAY_BUFFER;
    this.#ctx.bindBuffer(BUFFER_TYPE, this.buffer[part]);
    this.#ctx.bufferData(BUFFER_TYPE, data, this.#ctx.STATIC_DRAW);

    if (part === 'lineVertex' || part === 'vertex') this.recalculateBoundingBox();
  }

  /**
   *
   * @param {Readonly<Float32Array|Uint8Array>} newData
   * @param {keyof Omit<ModelData, "index" | "lineIndex">} part
   */
  updateBufferEnd(newData, part) {
    const oldLength = this.data[part].length - newData.length;
    this.data[part].set(newData, oldLength);
    this.#ctx.bindBuffer(this.#ctx.ARRAY_BUFFER, this.buffer[part]);
    this.#ctx.bufferSubData(this.#ctx.ARRAY_BUFFER, newData.BYTES_PER_ELEMENT * oldLength, newData.buffer);

    if (part === 'lineVertex' || part === 'vertex') this.recalculateBoundingBox();
  }

  /**
   * @param {Readonly<SubModel>} subModel
   * @param {Instance[]} [seedInstances]
   * @returns {Readonly<Instance>[]}
   */
  adopt(subModel, seedInstances) {
    this.subModels.push(subModel);
    this.recalculateBoundingBox();

    const instances = [];
    for (const instance of this.instances) {
      instances.push(...subModel.instantiate(instance, seedInstances));
    }
    return instances;
  }

  /**
   * @param {Readonly<SubModel>} subModel
   * @returns {Readonly<Instance>[]}
   */
  disown(subModel) {
    const index = this.subModels.indexOf(subModel);
    if (index === -1) return [];

    this.subModels.splice(index, 1);
    this.recalculateBoundingBox();

    const instances = [];
    for (const instance of this.instances) {
      instances.push(...subModel.cleanup(instance));
    }
    return instances;
  }

  /**
   * @returns {Model[]}
   */
  getAllModels() {
    return this.subModels.flatMap(({ model }) => model.getAllModels()).concat(this);
  }
}
