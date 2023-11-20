/**
 * @typedef ModelData
 * @property {Uint16Array|Uint32Array} index
 * @property {Float32Array} vertex
 * @property {Float32Array} normal
 * @property {Uint8Array} color
 * @property {Float32Array} lineVertex
 * @property {Uint16Array|Uint32Array} lineIndex
 * @property {Float32Array} boundingBoxVertex
 *
 * @typedef ModelBuffers
 * @property {GLBuffer} index
 * @property {GLBuffer} vertex
 * @property {GLBuffer} normal
 * @property {GLBuffer} color
 * @property {GLBuffer} lineIndex
 * @property {GLBuffer} lineVertex
 * @property {GLBuffer} boundingBoxIndex
 * @property {GLBuffer} boundingBoxVertex
 *
 * @typedef SubModel
 * @property {Model} model
 * @property {mat4} trs
 * @property {Instance[]} children
 */

import Instance from './instance.js';

export default class Model {
  /** @type {Engine} */
  #engine;

  /** @type {WebGLRenderingContext} */
  #ctx;

  /** @type {GLMatrix} */
  #math;

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

  /**
   * @param {string} name
   * @param {Readonly<Partial<ModelData>> | undefined} data
   * @param {Engine} engine
   */
  constructor(name, data, engine) {
    this.#engine = engine;
    this.#ctx = engine.driver.ctx;
    this.#math = engine.math;

    this.name = name;
    this.buffer = {
      index: this.#ctx.createBuffer(),
      vertex: this.#ctx.createBuffer(),
      normal: this.#ctx.createBuffer(),
      color: this.#ctx.createBuffer(),
      lineIndex: this.#ctx.createBuffer(),
      lineVertex: this.#ctx.createBuffer(),
      boundingBoxIndex: this.#ctx.createBuffer(),
      boundingBoxVertex: this.#ctx.createBuffer(),
    };

    this.data = {
      vertex: data?.vertex ?? new Float32Array(0),
      normal: data?.normal ?? new Float32Array(0),
      color: data?.color ?? new Uint8Array(0),
      index: data?.index ?? new engine.driver.UintIndexArray(0),
      lineVertex: data?.lineVertex ?? new Float32Array(0),
      lineIndex: data?.lineIndex ?? new engine.driver.UintIndexArray(0),
      boundingBoxVertex: data?.boundingBoxVertex ?? new Float32Array(24),
    };

    const boundingBoxIndex = new engine.driver.UintIndexArray([
      // Bottom
      0, 1, // BFL - BRL
      1, 2, // BRL - BRR
      2, 3, // BRR - BBL
      3, 0, // BFR - BFL
      // Top
      4, 5, // TFL - TRL
      5, 6, // TRL - TRR
      6, 7, // TRR - TFR
      7, 4, // TFR - TFL
      // Side
      0, 4, // BFL - TFL
      1, 5, // BRL - TRL
      2, 6, // BRR - TRR
      3, 7, // BFR - TFR
    ]);
    this.#ctx.bindBuffer(this.#ctx.ELEMENT_ARRAY_BUFFER, this.buffer.boundingBoxIndex);
    this.#ctx.bufferData(this.#ctx.ELEMENT_ARRAY_BUFFER, boundingBoxIndex, this.#ctx.STATIC_DRAW);

    this.#bindModelBuffers();
  }

  #bindModelBuffers() {
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
    this.#regenerateBoundingBox();
  }

  /**
   * Based on the diagonal bounding box vertices (p0 BFL, p6 TRR),
   * recalculates all remaining vertices (p1-p5, p7) and reuploads their buffer to the GPU
   */
  #regenerateBoundingBox() {
    // p1 BRL
    this.data.boundingBoxVertex[3] = this.data.boundingBoxVertex[0];
    this.data.boundingBoxVertex[4] = this.data.boundingBoxVertex[1];
    this.data.boundingBoxVertex[5] = this.data.boundingBoxVertex[20];
    // p2 BRR
    this.data.boundingBoxVertex[6] = this.data.boundingBoxVertex[18];
    this.data.boundingBoxVertex[7] = this.data.boundingBoxVertex[1];
    this.data.boundingBoxVertex[8] = this.data.boundingBoxVertex[20];
    // p3 BFR
    this.data.boundingBoxVertex[9] = this.data.boundingBoxVertex[18];
    this.data.boundingBoxVertex[10] = this.data.boundingBoxVertex[1];
    this.data.boundingBoxVertex[11] = this.data.boundingBoxVertex[2];
    // p4 TFL
    this.data.boundingBoxVertex[12] = this.data.boundingBoxVertex[0];
    this.data.boundingBoxVertex[13] = this.data.boundingBoxVertex[19];
    this.data.boundingBoxVertex[14] = this.data.boundingBoxVertex[2];
    // p5 TRL
    this.data.boundingBoxVertex[15] = this.data.boundingBoxVertex[0];
    this.data.boundingBoxVertex[16] = this.data.boundingBoxVertex[19];
    this.data.boundingBoxVertex[17] = this.data.boundingBoxVertex[20];
    // p7 TFR
    this.data.boundingBoxVertex[21] = this.data.boundingBoxVertex[18];
    this.data.boundingBoxVertex[22] = this.data.boundingBoxVertex[19];
    this.data.boundingBoxVertex[23] = this.data.boundingBoxVertex[2];

    this.#ctx.bindBuffer(this.#ctx.ARRAY_BUFFER, this.buffer.boundingBoxVertex);
    this.#ctx.bufferData(this.#ctx.ARRAY_BUFFER, this.data.boundingBoxVertex, this.#ctx.STATIC_DRAW);
  }

  /**
   * @param {Float32Array} newData
   */
  #expandBoundingBox(newData) {
    const { vec3 } = this.#math;

    const min = this.data.boundingBoxVertex.slice(0, 3);
    const max = this.data.boundingBoxVertex.slice(18, 21);

    const boundingCoord = vec3.create();
    for (let i = 0; i < newData.length; i += 3) {
      boundingCoord[0] = newData[i];
      boundingCoord[1] = newData[i + 1];
      boundingCoord[2] = newData[i + 2];

      vec3.min(min, min, boundingCoord);
      vec3.max(max, max, boundingCoord);
    }

    this.data.boundingBoxVertex.set(min);
    this.data.boundingBoxVertex.set(max, 18);
  }

  recalculateBoundingBox() {
    const { vec3 } = this.#math;

    this.data.boundingBoxVertex.set([Infinity, Infinity, Infinity]);
    this.data.boundingBoxVertex.set([-Infinity, -Infinity, -Infinity], 18);

    for (const { model, trs } of this.subModels) {
      const newData = new Float32Array(model.data.boundingBoxVertex);
      for (let i = 0; i < newData.length; i += 3) {
        const boundingCoord = newData.slice(i, i + 3);
        vec3.transformMat4(boundingCoord, boundingCoord, trs);
        newData.set(boundingCoord, i);
      }
      this.#expandBoundingBox(newData);
    }

    this.#expandBoundingBox(this.data.lineVertex);
    this.#expandBoundingBox(this.data.vertex);

    this.#regenerateBoundingBox();
  }

  /**
   * @param {Readonly<Float32Array|Uint16Array|Uint32Array|Uint8Array>} newData
   * @param {keyof Omit<ModelData, "boundingBoxIndex" | "boundingBoxVertex">} part
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

    if (part === 'lineVertex' || part === 'vertex') this.recalculateBoundingBox();
  }

  /**
   * @param {keyof Omit<ModelData, "boundingBoxIndex" | "boundingBoxVertex">} part
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
   * @param {keyof Omit<ModelData, "index" | "lineIndex" | "boundingBoxIndex" | "boundingBoxVertex">} part
   */
  updateBufferEnd(newData, part) {
    const oldLength = this.data[part].length - newData.length;
    this.data[part].set(newData, oldLength);
    this.#ctx.bindBuffer(this.#ctx.ARRAY_BUFFER, this.buffer[part]);
    this.#ctx.bufferSubData(this.#ctx.ARRAY_BUFFER, newData.BYTES_PER_ELEMENT * oldLength, newData.buffer);

    if (part === 'lineVertex' || part === 'vertex') this.recalculateBoundingBox();
  }

  /**
   * @param {SubModel} subModel
   * @param {Instance | null} parent
   * @param {number} [id]
   * @returns {Instance[]}
   */
  instantiate(subModel, parent, id) {
    const instance = new Instance(this, subModel, parent, this.#engine, id);
    subModel.children.push(instance);
    parent?.children.push(instance);
    this.instances.push(instance);
    const instances = [instance];

    for (const subSubModel of this.subModels) {
      const subInstances = subSubModel.model.instantiate(subSubModel, instance);
      instances.push(...subInstances);
    }

    return instances;
  }

  /**
   * @param {Model} model
   * @param {mat4} trs
   * @returns {Instance[]}
   */
  adopt(model, trs) {
    const subModel = { model, trs: this.#engine.math.mat4.clone(trs), children: [] };
    this.subModels.push(subModel);
    this.recalculateBoundingBox();

    const instances = [];
    for (const instance of this.instances) {
      instances.push(...model.instantiate(subModel, instance));
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
