import Step from './step.js';

const { vec3, mat4, quat } = glMatrix;

/** @typedef {import("./step.js").BaseParams<SketchState>} BaseParams */
/** @typedef {import("./step.js").BaseParams<Omit<SketchState, "elements"> & Partial<SketchState>>} PartialBaseParams */

/**
 * @template {string} T
 * @template {number} S
 * @typedef ConstructionElement
 * @property {T} type
 * @property {FixedNumberArray<S>} data
 */

/** @typedef {ConstructionElement<"line", 4>} LineConstructionElement */
/** @typedef {LineConstructionElement} ConstructionElements */

/**
 * @typedef AxisAttachment
 * @property {"plane"} type
 * @property {PlainVec3} normal
 */

/** @typedef {AxisAttachment} Attachment */

/**
 * @typedef SketchState
 * @property {Attachment} attachment
 * @property {ConstructionElements[]} elements
 */

// cached structures
const forward = vec3.fromValues(0, 0, 1);
const rotation = quat.create();
const tempVertex = vec3.create();

export default class Sketch extends /** @type {typeof Step<SketchState>} */ (Step) {
  normal = vec3.create();
  toSketch = mat4.create();
  fromSketch = mat4.create();

  /** @param {PartialBaseParams} args  */
  constructor(...args) {
    if (!args[0].elements) {
      args[0] = { ...args[0], elements: [] };
    }
    super(.../** @type {BaseParams} */ (args));
    this.#recompute();
  }

  static getType() {
    return 'Sketch';
  }

  /**
   * @template {ConstructionElements} T
   * @param {T["type"]} type
   * @param {T["data"]} [data]
   * @returns {T}
   */
  static makeConstructionElement(type, data) {
    let size = 0;

    switch (type) {
      case "line":
        size = 4;
        break;
      default:
        throw new Error(`Unknown construction element type "${type}"`);
    }

    const element = /** @type {T} */ ({ type, data: Array(size) });
    for (let i = 0; i < size; ++i) {
      element.data[i] = data?.[i] ?? 0;
    }

    return element;
  }

  /**
   * @template {ConstructionElements} T
   * @param {T} element
   * @returns {T}
   */
  static cloneConstructionElement(element) {
    const clone = /** @type {T} */ ({ type: element.type, data: Array(element.data.length) });
    for (let i = 0; i < element.data.length; ++i) {
      clone.data[i] = element.data[i];
    }
    return clone;
  }

  #recompute() {
    vec3.set(this.normal, ...this.data.attachment.normal);
    quat.rotationTo(rotation, this.normal, forward);
    mat4.fromQuat(this.toSketch, rotation);
    mat4.invert(this.fromSketch, this.toSketch);

    this.#recalculate();
  }

  /**
   * @param {keyof import("../3d/model.js").ModelData} part
   * @param {number|ArrayLike<number>} elements
   */
  #resizeModelBuffer(part, elements) {
    const isNumber = typeof elements === 'number';
    const diff = isNumber ? elements : elements.length;
    const newSize = this.offsets[part] + diff;
    if (newSize !== this.model.data[part].length) {
      const oldData = this.model.data[part].subarray(0, this.offsets[part]);
      this.model.data[part] = new /** @type {new (e: number) => any} */ (this.model.data[part].constructor)(newSize);
      this.model.data[part].set(oldData);
    }
    if (!isNumber) {
      this.model.data[part].set(elements, this.offsets[part]);
    }
  }

  /**
   * @template {ConstructionElements} T
   * @param {T["type"]} type
   * @param {T["data"]} data
   * @returns {T}
   */
  #createConstructionElement(type, data) {
    const element = Sketch.makeConstructionElement(type, data);
    this.data.elements.push(element);
    this.update();
    return element;
  }

  #recalculate() {
    const { data } = this.model;

    this.#resizeModelBuffer('lineIndex', this.data.elements.length * 2);

    const firstIndex = this.offsets.vertex / 3;
    let lineIndexOffset = this.offsets.lineIndex;
    let lastIndex = firstIndex;

    /** @type {[x: number, y: number][]} */
    const vertexToIndex = [];

    let index = -1;

    /** @type {number[]} */
    const verticesToAdd = [];

    for (const element of this.data.elements) {
      switch (element.type) {
        case 'line':
          index = firstIndex + vertexToIndex.findIndex(([x, y]) => x === element.data[0] && y === element.data[1]);
          if (index < firstIndex) {
            vec3.set(tempVertex, element.data[0], element.data[1], 0);
            vec3.transformMat4(tempVertex, tempVertex, this.fromSketch);

            vertexToIndex.push([element.data[0], element.data[1]]);
            verticesToAdd.push(...tempVertex);
            index = lastIndex++;
          }
          data.lineIndex[lineIndexOffset++] = index;

          index = firstIndex + vertexToIndex.findIndex(([x, y]) => x === element.data[2] && y === element.data[3]);
          if (index < firstIndex) {
            vec3.set(tempVertex, element.data[2], element.data[3], 0);
            vec3.transformMat4(tempVertex, tempVertex, this.fromSketch);

            vertexToIndex.push([element.data[2], element.data[3]]);
            verticesToAdd.push(...tempVertex);
            index = lastIndex++;
          }
          data.lineIndex[lineIndexOffset++] = index;

          break;
      }
    }

    this.#resizeModelBuffer('vertex', verticesToAdd);

    this.model.update('lineIndex', 'vertex');
  }

  recompute() {
    super.recompute();
    this.#recompute();
  }

  update() {
    this.#recalculate();
    super.update();
  }

  /**
   * @param {number} x1
   * @param {number} y1
   * @param {number} x2
   * @param {number} y2
   * @returns {Readonly<LineConstructionElement>}
   */
  line(x1, y1, x2, y2) {
    return this.#createConstructionElement('line', [x1, y1, x2, y2]);
  }

  /**
   * @param {Readonly<ConstructionElements>} element
   */
  addElement(element) {
    if (this.data.elements.includes(element)) return;
    this.data.elements.push(element);
    this.update();
  }

  /**
   * @param {Readonly<ConstructionElements>} element
   */
  deleteElement(element) {
    const index = this.data.elements.indexOf(element);
    if (index === -1) return;

    this.data.elements.splice(index, 1);
    this.update();
  }
}
