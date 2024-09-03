import { implement } from '../general/base.js';
import { Properties } from '../general/properties.js';
import State from '../general/state.js';

const { vec3, mat4, quat } = glMatrix;

/**
 * @param {Iterable<number>} f
 * @returns {string}
 */
const stringifyFloat32 = (f) => `[${[...f].map(v => v.toFixed(3)).join(', ')}]`;

// cached structures
export const defaultTrs = /** @type {PlainMat4} */ (Object.freeze([...mat4.create()]));
const tempToVec3 = vec3.create();
const tempTranslateVec3 = vec3.create();
const tempTransform = mat4.create();

export default class Placement extends implement({
  State: State.withDefaults({ trs: defaultTrs }),
  Properties,
}) {
  trs = mat4.create();
  inverseTrs = mat4.create();

  rotation = quat.create();
  inverseRotation = quat.create();

  translation = vec3.create();
  inverseTranslation = vec3.create();

  scaling = vec3.create();
  inverseScaling = vec3.create();

  #recalculateAll() {
    mat4.invert(this.inverseTrs, this.trs);
    mat4.getTranslation(this.translation, this.trs);
    mat4.getTranslation(this.inverseTranslation, this.inverseTrs);
    mat4.getRotation(this.rotation, this.trs);
    mat4.getRotation(this.inverseRotation, this.inverseTrs);
    mat4.getScaling(this.scaling, this.trs);
    mat4.getScaling(this.inverseScaling, this.inverseTrs);
  }

  constructor() {
    super({
      State: [
        undefined,
        {
          onExport: () => ({ trs: /** @type {PlainMat4} */ ([...this.trs]) }),
        },
      ],
      Properties: [
        () => {
          const angle = quat.getAxisAngle(tempToVec3, this.rotation);
          return {
            Placement: {
              Position: stringifyFloat32(this.translation),
              Axis: stringifyFloat32(tempToVec3),
              Angle: `${(angle * 180 / Math.PI).toFixed(3)}°`,
            },
          };
        },
      ],
    });
    this.set(this.State.trs);
  }

  /**
   * @param {vec3} out
   * @param {ReadonlyVec3} globalRelativeCoords
   * @param {ReadonlyMat4} inverseTrs
   * @returns {vec3}
   */
  static toLocalRelativeCoords(out, globalRelativeCoords, inverseTrs) {
    vec3.transformMat4(out, globalRelativeCoords, inverseTrs);
    mat4.getTranslation(tempToVec3, inverseTrs);
    return vec3.subtract(out, out, tempToVec3);
  }

  /**
   * @param {vec3} out
   * @param {ReadonlyVec3} localRelativeCoords
   * @param {ReadonlyMat4} trs
   * @returns {vec3}
   */
  static toGlobalRelativeCoords(out, localRelativeCoords, trs) {
    vec3.transformMat4(out, localRelativeCoords, trs);
    mat4.getTranslation(tempToVec3, trs);
    return vec3.subtract(out, out, tempToVec3);
  }

  /**
   * @param {ReadonlyMat4 | PlainMat4} trs
   */
  set(trs) {
    mat4.copy(this.trs, /** @type {mat4} */ (trs));
    this.#recalculateAll();
  }

  /**
   * @param {ReadonlyMat4} transformation
   */
  transform(transformation) {
    mat4.multiply(this.trs, this.trs, transformation);
    this.#recalculateAll();
  }

  /**
   * @param {ReadonlyMat4} transformation
   */
  preTransform(transformation) {
    mat4.multiply(this.trs, transformation, this.trs);
    this.#recalculateAll();
  }

  /**
   * @param {ReadonlyMat4} transformation
   */
  transformGlobal(transformation) {
    this.toLocalTransformation(tempTransform, transformation);
    this.transform(tempTransform);
  }

  /**
   * @param {ReadonlyVec3} translation
   */
  translate(translation) {
    mat4.fromTranslation(tempTransform, translation);
    this.preTransform(tempTransform);
  }

  /**
   * @param {ReadonlyVec3} translation
   */
  translateGlobal(translation) {
    this.toLocalRelativeCoords(tempTranslateVec3, translation);
    this.translate(tempTranslateVec3);
  }

  /**
   * @param {mat4} out
   * @param {ReadonlyMat4} globalTransformation
   * @returns {mat4}
   */
  toLocalTransformation(out, globalTransformation) {
    return mat4.multiply(out, globalTransformation, this.inverseTrs);
  }

  /**
   * @param {mat4} out
   * @param {ReadonlyMat4} localTransformation
   * @returns {mat4}
   */
  toGlobalTransformation(out, localTransformation) {
    return mat4.multiply(out, localTransformation, this.trs);
  }

  /**
   * @param {vec3} out
   * @param {ReadonlyVec3} globalCoords
   * @returns {vec3}
   */
  toLocalCoords(out, globalCoords) {
    return vec3.transformMat4(out, globalCoords, this.inverseTrs);
  }

  /**
   * @param {vec3} out
   * @param {ReadonlyVec3} localCoords
   * @returns {vec3}
   */
  toGlobalCoords(out, localCoords) {
    return vec3.transformMat4(out, localCoords, this.trs);
  }

  /**
   * @param {vec3} out
   * @param {ReadonlyVec3} globalRelativeCoords
   * @returns {vec3}
   */
  toLocalRelativeCoords(out, globalRelativeCoords) {
    return Placement.toLocalRelativeCoords(out, globalRelativeCoords, this.inverseTrs);
  }

  /**
   * @param {vec3} out
   * @param {ReadonlyVec3} localRelativeCoords
   * @returns {vec3}
   */
  toGlobalRelativeCoords(out, localRelativeCoords) {
    return Placement.toGlobalRelativeCoords(out, localRelativeCoords, this.trs);
  }
}
