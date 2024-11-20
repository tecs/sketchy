import { implement } from '../general/base.js';
import { Properties } from '../general/properties.js';
import State from '../general/state.js';

const { vec3, mat4, quat } = glMatrix;

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
        (axis = vec3.create(), angle = quat.getAxisAngle(axis, this.rotation)) => ({
          Placement: {
            Position: {
              value: this.translation,
              onEdit: (translation) => {
                vec3.subtract(translation, translation, this.translation);
                this.translate(translation);
              },
              type: 'coord',
            },
            Axis: {
              value: axis,
              type: 'vec3',
              onEdit: (normal) => {
                const component = (normal[1] !== axis[1] ? 1 : 0) + (normal[2] !== axis[2] ? 2 : 0);
                const value = Math.min(Math.max(normal[component], -1), 1);
                normal[component] = 0;

                const length = vec3.length(normal);
                if (length > 0) vec3.scale(normal, normal, Math.sqrt(1 - value * value) / length);

                normal[component] = value;
                vec3.normalize(normal, normal);

                if (vec3.length(normal) === 0) return;

                mat4.rotate(this.trs, this.trs, -angle, axis);
                mat4.rotate(this.trs, this.trs, angle, normal);
                this.#recalculateAll();
              },
            },
            Angle: {
              value: angle,
              type: 'angle',
              onEdit: (value) => {
                mat4.rotate(this.trs, this.trs, value - angle, axis);
                this.#recalculateAll();
              },
            },
            Scale: {
              value: this.scaling,
              type: 'vec3',
              onEdit: (factor) => {
                vec3.divide(factor, factor, this.scaling);
                this.scale(factor);
              },
            },
          },
        }),
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
   * @param {ReadonlyVec3} factor
   */
  scale(factor) {
    mat4.scale(this.trs, this.trs, factor);
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
