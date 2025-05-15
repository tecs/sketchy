import { Properties } from '../general/properties.js';
import Step from './step.js';

const { vec3 } = glMatrix;

/**
 * @typedef PullState
 * @property {number} faceId
 * @property {number} distance
 * @property {boolean} reverse
 */

/** @typedef {import("./step.js").BaseParams<PullState>} BaseParams */
/** @typedef {import("../3d/model.js").PlainFace} PlainFace */

// cached structures
const tempVec3 = vec3.create();

/**
 * @param {vec3} out
 * @param {Readonly<PlainVec3>} a
 * @param {Readonly<PlainVec3>} b
 * @param {Readonly<PlainVec3>} c
 * @returns {vec3}
 */
const findNormal = (out, a, b, c) => {
  out[0] = (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]);
  out[1] = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
  out[2] = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  return vec3.normalize(out, out);
};

export default class Pull extends /** @type {typeof Step<PullState>} */ (Step) {
  #offset = vec3.create();
  normal = vec3.create();

  /** @type {number} */
  newFaceId;

  /** @param {BaseParams} args  */
  constructor(...args) {
    super(...args);

    this.Properties.extend(properties => Properties.merge(properties, {
      Attachment: {
        FaceId: { value: String(this.State.data.faceId), type: 'plain' },
        Distance: {
          value: this.State.data.distance,
          type: 'distance',
          onEdit: (distance) => {
            if (distance < 0) return;
            this.State.data.distance = distance;
            this.recompute();
          },
        },
        Reverse: {
          value: this.State.data.reverse,
          type: 'boolean',
          onEdit: (reverse) => {
            this.State.data.reverse = reverse;
            this.recompute();
          },
        },
      },
    }));

    this.#recompute();

    this.newFaceId = this.assertProperty('newFaceId');
  }

  static getType() {
    return 'PushPull';
  }

  #recompute() {
    const { faceId, reverse } = this.data;
    const newData = this.model.export();

    if (faceId > newData.faces.length) throw new Error(`Face #${faceId} does not exist on body`);

    const face = newData.faces[faceId - 1];

    this.normal.set(face.normal);
    vec3.scale(this.#offset, this.normal, reverse ? -this.data.distance : this.data.distance);

    const nVertices = newData.vertices.length / 3;
    const indexMap = new Map(
      face.holes.flat().concat(face.loop)
        .filter((v, i, a) => a.indexOf(v) === i)
        .map((index, i) => [index, i + nVertices]),
    );

    const newFace = /** @type {PlainFace} */ ({
      normal: /** @type {PlainVec3} */ (face.normal.slice()),
      color: /** @type {PlainVec3} */ (face.color.slice()),
      loop: face.loop.map(index => indexMap.get(index)),
      holes: face.holes.map(hole => hole.map(index => indexMap.get(index))),
    });
    newData.faces.push(newFace);
    this.newFaceId = newData.faces.length;

    for (const [index, newIndex] of indexMap) {
      newData.segments.push(index, newIndex);
      vec3.set(tempVec3, .../** @type {PlainVec3} */ (newData.vertices.slice(index * 3, index * 3 + 3)));
      vec3.add(tempVec3, tempVec3, this.#offset);
      newData.vertices.push(...tempVec3);
    }

    for (let i = 0; i < newFace.loop.length; ++i) {
      const prevIndex = i === 0 ? newFace.loop.length - 1 : i - 1;
      newData.segments.push(newFace.loop[i], newFace.loop[prevIndex]);

      findNormal(
        tempVec3,
        /** @type {PlainVec3} */ (newData.vertices.slice(face.loop[prevIndex] * 3, face.loop[prevIndex] * 3 + 3)),
        /** @type {PlainVec3} */ (newData.vertices.slice(face.loop[i] * 3, face.loop[i] * 3 + 3)),
        /** @type {PlainVec3} */ (newData.vertices.slice(newFace.loop[i] * 3, newFace.loop[i] * 3 + 3)),
      );

      const sideFace = /** @type {PlainFace} */ ({
        normal: /** @type {PlainVec3} */ ([...tempVec3]),
        color: /** @type {PlainVec3} */ (face.color.slice()),
        loop: [
          face.loop[i], face.loop[prevIndex],
          newFace.loop[prevIndex], newFace.loop[i],
        ],
        holes: [],
      });
      newData.faces.push(sideFace);
    }

    for (let i = 0; i < newFace.holes.length; ++i) {
      const hole = face.holes[i];
      const newHole = newFace.holes[i];
      for (let j = 0; j < newHole.length; ++j) {
        const prevIndex = j === 0 ? newHole.length - 1 : j - 1;
        newData.segments.push(newHole[j], newHole[prevIndex]);

        findNormal(
          tempVec3,
          /** @type {PlainVec3} */ (newData.vertices.slice(hole[prevIndex] * 3, hole[prevIndex] * 3 + 3)),
          /** @type {PlainVec3} */ (newData.vertices.slice(hole[j] * 3, hole[j] * 3 + 3)),
          /** @type {PlainVec3} */ (newData.vertices.slice(newHole[j] * 3, newHole[j] * 3 + 3)),
        );

        const sideFace = /** @type {PlainFace} */ ({
          normal: /** @type {PlainVec3} */ ([...tempVec3]),
          color: /** @type {PlainVec3} */ (face.color.slice()),
          loop: [
            hole[j], hole[prevIndex],
            newHole[prevIndex], newHole[j],
          ],
          holes: [],
        });
        newData.faces.push(sideFace);
      }
    }

    this.model.import(newData);
  }

  recompute() {
    super.recompute();
    this.#recompute();
  }
}
