import { flattenVertices, triangulateFace } from '../cad/triangulate.js';
import Base from '../general/base.js';
import BoundingBox from './bounding-box.js';

const { vec3 } = glMatrix;

/**
 * @typedef Face
 * @property {number} id
 * @property {vec3} normal
 * @property {vec3} color
 * @property {number[]} loop
 * @property {number[][]} holes
 * @property {number[]} adjacentFaces
 * @property {boolean} connected
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
 * @property {number[][]} volumes
 * @property {number[]} segments
 * @property {number[]} supportSegments
 */

/**
 * @typedef PlainModelData
 * @property {number[]} vertices
 * @property {PlainFace[]} faces
 * @property {number[]} segments
 * @property {number[]} supportSegments
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
 * @property {Float32Array} lineSupports
 * @property {Float32Array} startingVertex
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
      lineSupports: this.#ctx.createBuffer(),
      startingVertex: this.#ctx.createBuffer(),
    };

    this.import(data ?? { faces: [], vertices: [], segments: [], supportSegments: [] });

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

    this.lastFaceId = 0;
    this.lastLineId = 0;
    this.lastPointId = 0;

    const vertices = data.vertices.slice();
    const segments = data.segments.slice();
    const supportSegments = data.supportSegments.slice();
    /** @type {Face[]} */
    const faces = data.faces.map(face => ({
      id: ++this.lastFaceId,
      normal: vec3.fromValues(...face.normal),
      color: vec3.fromValues(...face.color),
      loop: face.loop.slice(),
      holes: face.holes.map(hole => hole.slice()),
      adjacentFaces: [],
      connected: true,
    }));

    this.data = { vertices, faces, segments, supportSegments, volumes: [] };
    const { volumes } = this.data;

    const vertex  = /** @type {number[]} */ ([]);
    const lineVertex = /** @type {number[]} */ ([]);
    const normals = /** @type {number[]} */ ([]);
    const colors  = /** @type {number[]} */ ([]);
    const index   = /** @type {number[]} */ ([]);
    const faceIds = /** @type {number[]} */ ([]);
    const lineIds = /** @type {number[]} */ ([]);
    const pointIds = /** @type {number[]} */ ([]);
    const lineSupports = /** @type {number[]} */ ([]);
    const startingVertex = /** @type {number[]} */ ([]);

    const indexMap = /** @type {string[]} */ ([]);

    /** @type {Map<string, number[]>} */
    const segmentFaces = new Map();

    for (const face of faces) {
      const { loop, color, normal, holes } = face;
      if (loop.length) {
        const flatVertices = flattenVertices(vertices, normal);
        const inputVertexIndices = triangulateFace(flatVertices, loop, holes);

        for (let i = 0; i < inputVertexIndices.length; ++i) {
          const vertexOffset = inputVertexIndices[i] * 3;
          const indexKey = `${vertexOffset}_${face.id}`;
          if (!indexMap.includes(indexKey)) {
            indexMap.push(indexKey);
            vertex.push(
              vertices[vertexOffset],
              vertices[vertexOffset + 1],
              vertices[vertexOffset + 2],
            );
            normals.push(...normal);
            colors.push(...color);
            faceIds.push(face.id);
          }
          index.push(indexMap.indexOf(indexKey));
        }

        const loops = [loop, ...holes];
        for (const segmentLoop of loops) {
          for (let j = 0; j < segmentLoop.length; ++j) {
            const i1 = segmentLoop[j];
            const i2 = j > 0 ? segmentLoop[j - 1] : segmentLoop[segmentLoop.length - 1];
            const key = i1 < i2 ? `${i1}_${i2}` : `${i2}_${i1}`;
            const segment2 = segmentFaces.get(key);
            if (segment2) segment2.push(face.id);
            else segmentFaces.set(key, [face.id]);
          }
        }
      }
    }

    const adjacentFaces = Array.from(segmentFaces.values(), a => new Set(a));

    while (true) {
      let pruned = false;
      for (const face of faces) {
        if (!face.connected) continue;

        const adjacencies = adjacentFaces.filter(adjacent => adjacent.has(face.id));
        if (adjacencies.some(adjacent => adjacent.size === 1)) {
          face.connected = false;
          pruned = true;
          adjacencies.forEach(adjacent => adjacent.delete(face.id));
        }
      }

      if (!pruned) break;
    }

    for (const face of faces) {
      if (!face.connected) continue;

      const adjacencies = adjacentFaces.filter(adjacent => adjacent.has(face.id));
      for (const [id1, id2] of adjacencies.values()) {
        const id = id1 === face.id ? id2 : id1;
        if (!face.adjacentFaces.includes(id)) face.adjacentFaces.push(id);
      }

      if (volumes.find(v => v.includes(face.id))) continue;
      const volume = new Set([face.id, ...face.adjacentFaces]);

      for (const id of volume) {
        for (const segment of adjacentFaces) {
          if (!segment.has(id)) continue;
          for (const otherId of segment) volume.add(otherId);
        }
      }
      volumes.push([...volume]);
    }

    for (let i = 1; i < segments.length; i += 2) {
      this.lastLineId++;
      lineIds.push(this.lastLineId, this.lastLineId);

      pointIds.push(++this.lastPointId);
      pointIds.push(++this.lastPointId);

      const isSupport = supportSegments.some((vi, ii, ai) =>
        (ii % 2 === 0)
        && vi === segments[i - 1]
        && ai[ii + 1] === segments[i],
      );
      lineSupports.push(isSupport ? 1 : 0);
      lineSupports.push(isSupport ? 1 : 0);

      const v1 = vertices.slice(segments[i - 1] * 3, segments[i - 1] * 3 + 3);
      const v2 = vertices.slice(segments[i] * 3, segments[i] * 3 + 3);

      lineVertex.push(...v1, ...v2);
      startingVertex.push(...v1, ...(isSupport ? v1 : v2));
    }

    const maxIds = Math.max(faceIds.length, lineIds.length, pointIds.length);

    this.bufferData = {
      vertex: new Float32Array(vertex),
      normal: new Float32Array(normals),
      color: new Uint8Array(colors),
      index: new Uint32Array(index),
      lineIndex: new Uint32Array(segments.length).map((_, i) => i),
      lineVertex: new Float32Array(lineVertex),
      faceIds: new Uint32Array(maxIds),
      lineIds: new Uint32Array(maxIds),
      pointIds: new Uint32Array(maxIds),
      lineSupports: new Float32Array(lineSupports),
      startingVertex: new Float32Array(startingVertex),
    };

    this.bufferData.faceIds.set(faceIds);
    this.bufferData.lineIds.set(lineIds);
    this.bufferData.pointIds.set(pointIds);

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
      supportSegments: this.data.supportSegments.slice(),
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
