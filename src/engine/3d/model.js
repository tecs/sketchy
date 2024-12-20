import { flattenVertices, triangulateFace } from '../cad/triangulate.js';
import Base from '../general/base.js';
import BoundingBox from './bounding-box.js';

const { vec3 } = glMatrix;

/**
 * @typedef Face
 * @property {vec3} normal
 * @property {vec3} color
 * @property {number[]} loop
 * @property {number[][]} holes
 */

/**
 * @typedef PlainFace
 * @property {PlainVec3} normal
 * @property {PlainVec3} color
 * @property {number[]} loop
 * @property {number[][]} holes
 */

/**
 * @typedef ModelData
 * @property {number[]} vertices
 * @property {Face[]} faces
 * @property {number[]} segments
 */

/**
 * @typedef PlainModelData
 * @property {number[]} vertices
 * @property {PlainFace[]} faces
 * @property {number[]} segments
 */

/**
 * @typedef BufferData
 * @property {Uint32Array} index
 * @property {Float32Array} vertex
 * @property {Float32Array} normal
 * @property {Uint8Array} color
 * @property {Uint32Array} lineIndex
 * @property {Float32Array} lineVertex
 * @property {Uint32Array} faceIds
 * @property {Uint32Array} lineIds
 * @property {Uint32Array} pointIds
 */

/** @typedef {Record<keyof BufferData, GLBuffer>} ModelBuffers */
/** @typedef {import("../cad/subinstance.js").default} SubInstance */

export default class Model extends Base.implement({ BoundingBox }) {
  /** @type {Engine["driver"]} */
  #driver;

  /** @type {WebGL2RenderingContext} */
  #ctx;

  /** @type {import("../cad/body.js").default} */
  body;

  /** @type {ModelBuffers} */
  buffer;

  /** @type {BufferData} */
  bufferData;

  /** @type {ModelData} */
  data;

  lastFaceId = 0;
  lastLineId = 0;
  lastPointId = 0;

  /**
   * @param {Readonly<PlainModelData> | undefined} data
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
      lineVertex: this.#ctx.createBuffer(),
      faceIds: this.#ctx.createBuffer(),
      lineIds: this.#ctx.createBuffer(),
      pointIds: this.#ctx.createBuffer(),
    };

    this.import(data ?? { faces: [], vertices: [], segments: [] });

    this.bufferData = this.assertProperty('bufferData');
    this.data = this.assertProperty('data');
  }

  /**
   * @param {Readonly<PlainModelData>} data
   */
  import(data) {
    if (data.vertices.length % 3 !== 0) throw new Error('Number of supplied vertices is not divisible by 3');
    const nVertices = data.vertices.length / 3;

    const loopTest = data.faces.flatMap(face => face.holes.concat(face.loop.length ? [face.loop] : []));
    if (loopTest.some(loop => loop.length && loop.length < 3)) throw new Error('Loop incomplete');
    if (loopTest.some(loop => loop.some((v, i, a) => a.indexOf(v) !== i))) throw new Error('Invalid loop');
    if (loopTest.some(loop => loop.some(i => i < 0 || i > nVertices - 1))) throw new Error('Loop out of range');

    if (data.segments.length % 2 !== 0) throw new Error('Segment incomplete');
    if (data.segments.some(i => i < 0 || i > nVertices - 1)) throw new Error('Segment out of range');

    const vertices = data.vertices.slice();
    const segments = data.segments.slice();
    const faces = data.faces.map(face => ({
      normal: vec3.fromValues(...face.normal),
      color: vec3.fromValues(...face.color),
      loop: face.loop.slice(),
      holes: face.holes.map(hole => hole.slice()),
    }));

    this.data = { vertices, faces, segments };

    const vertex  = /** @type {number[]} */ ([]);
    const lineVertex = /** @type {number[]} */ ([]);
    const normals = /** @type {number[]} */ ([]);
    const colors  = /** @type {number[]} */ ([]);
    const index   = /** @type {number[]} */ ([]);
    const faceIds = /** @type {number[]} */ ([]);
    const lineIds = /** @type {number[]} */ ([]);
    const pointIds = /** @type {number[]} */ ([]);

    const indexMap = /** @type {string[]} */ ([]);

    this.lastFaceId = 0;
    this.lastLineId = 0;
    this.lastPointId = 0;

    for (const { loop, color, normal, holes } of faces) {
      if (loop.length) {
        this.lastFaceId++;

        const flatVertices = flattenVertices(vertices, normal);
        const inputVertexIndices = triangulateFace(flatVertices, loop, holes);

        for (let i = 0; i < inputVertexIndices.length; ++i) {
          const vertexOffset = inputVertexIndices[i] * 3;
          const indexKey = `${vertexOffset}_${this.lastFaceId}`;
          if (!indexMap.includes(indexKey)) {
            indexMap.push(indexKey);
            vertex.push(
              vertices[vertexOffset],
              vertices[vertexOffset + 1],
              vertices[vertexOffset + 2],
            );
            normals.push(...normal);
            colors.push(...color);
            faceIds.push(this.lastFaceId);
          }
          index.push(indexMap.indexOf(indexKey));
        }
      }
    }

    for (let i = 1; i < segments.length; i += 2) {
      this.lastLineId++;
      lineIds.push(this.lastLineId, this.lastLineId);

      pointIds.push(++this.lastPointId);
      pointIds.push(++this.lastPointId);

      lineVertex.push(...vertices.slice(segments[i - 1] * 3, segments[i - 1] * 3 + 3));
      lineVertex.push(...vertices.slice(segments[i] * 3, segments[i] * 3 + 3));
    }

    this.bufferData = {
      vertex: new Float32Array(vertex),
      normal: new Float32Array(normals),
      color: new Uint8Array(colors),
      index: new Uint32Array(index),
      lineIndex: new Uint32Array(segments.length * 2).map((_, i) => i),
      lineVertex: new Float32Array(lineVertex),
      faceIds: new Uint32Array(faceIds),
      lineIds: new Uint32Array(lineIds),
      pointIds: new Uint32Array(pointIds),
    };

    for (const part of /** @type {(keyof BufferData)[]} */ (Object.keys(this.bufferData))) {
      const isIndex = part === 'lineIndex' || part === 'index';
      const BUFFER_TYPE = isIndex ? this.#ctx.ELEMENT_ARRAY_BUFFER : this.#ctx.ARRAY_BUFFER;
      this.#ctx.bindBuffer(BUFFER_TYPE, this.buffer[part]);
      this.#ctx.bufferData(BUFFER_TYPE, this.bufferData[part], this.#ctx.STATIC_DRAW);
    }

    if (vertices.length) this.recalculateBoundingBox();
  }

  /**
   * @returns {PlainModelData}
   */
  export() {
    return {
      vertices: this.data.vertices.slice(),
      faces: this.data.faces.map(face => ({
        color: /** @type {PlainVec3} */ ([...face.color]),
        normal: /** @type {PlainVec3} */ ([...face.normal]),
        holes: face.holes.map(hole => hole.slice()),
        loop: face.loop.slice(),
      })),
      segments: this.data.segments.slice(),
    };
  }

  /**
   * @returns {Model}
   */
  clone() {
    return new Model(this.export(), this.body, this.#driver);
  }

  recalculateBoundingBox() {
    this.BoundingBox.reset();
    this.BoundingBox.expand(this.bufferData.vertex);
    this.BoundingBox.expand(this.bufferData.lineVertex);

    this.body.recalculateBoundingBox();
  }
}
