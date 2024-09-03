import Step from './step.js';

const { vec3, mat4, quat } = glMatrix;

/** @typedef {import("./step.js").BaseParams<SketchState>} BaseParams */
/** @typedef {import("./step.js").BaseParams<Omit<SketchState, "elements"> & Partial<SketchState>>} PartialBaseParams */

/**
 * @template {string} T
 * @template {number} S
 * @typedef ConstructionElement
 * @property {T} type
 * @property {Tuple<number, S>} data
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

  /** @type {[x: number, y: number][]} */
  vertexToIndex = [];

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
   * @param {Engine} engine
   */
  static register(engine) {
    super.register(engine);

    engine.on('keydown', (_, keyCombo) => {
      const sketch = engine.scene.currentStep ?? engine.scene.enteredInstance?.body.step;
      if (keyCombo === 'delete' && sketch instanceof Sketch) {
        const index = engine.scene.selectedPointIndex ?? engine.scene.selectedLineIndex;
        if (!index) return;

        const type = engine.scene.selectedPointIndex ? 'point' : 'line';

        const line = type === 'point' ? sketch.getLineForPoint(index - 1)?.[0] : sketch.getLine(index - 1);
        if (!line) return;

        const action = engine.history.createAction(`Delete line from Sketch ${sketch.name}`, {});
        if (!action) return;

        action.append(
          () => {
            sketch.deleteElement(line);
            if (type === 'line') engine.scene.setSelectedLine(null);
            else engine.scene.setSelectedPoint(null);
          },
          () => {
            sketch.addElement(line);
            if (type === 'line') engine.scene.setSelectedLine(index);
            else engine.scene.setSelectedPoint(index);
          },
        );
        action.commit();
      }
    });

    engine.on('mousedown', (button, count) => {
      const { currentInstance, hoveredInstance, currentStep, hoveredLineIndex, hoveredPointIndex } = engine.scene;
      if (button !== 'left' || count !== 2 || hoveredInstance !== currentInstance) return;

      const sketch = currentInstance.body.step;
      if (!(sketch instanceof Sketch) || sketch === currentStep) return;

      if (hoveredLineIndex && sketch.hasLine(hoveredLineIndex - 1)) engine.scene.setCurrentStep(sketch);
      else if (hoveredPointIndex && sketch.hasPoint(hoveredPointIndex - 1)) engine.scene.setCurrentStep(sketch);
    });
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
    this.lengths[part] = isNumber ? elements : elements.length;
    const newSize = this.offsets[part] + this.lengths[part];
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

    this.vertexToIndex = [];

    let index = -1;

    /** @type {number[]} */
    const verticesToAdd = [];

    for (const element of this.data.elements) {
      switch (element.type) {
        case 'line':
          index = firstIndex + this.vertexToIndex.findIndex(([x, y]) => x === element.data[0] && y === element.data[1]);
          if (index < firstIndex) {
            vec3.set(tempVertex, element.data[0], element.data[1], 0);
            vec3.transformMat4(tempVertex, tempVertex, this.fromSketch);

            this.vertexToIndex.push([element.data[0], element.data[1]]);
            verticesToAdd.push(...tempVertex);
            index = lastIndex++;
          }
          data.lineIndex[lineIndexOffset++] = index;

          index = firstIndex + this.vertexToIndex.findIndex(([x, y]) => x === element.data[2] && y === element.data[3]);
          if (index < firstIndex) {
            vec3.set(tempVertex, element.data[2], element.data[3], 0);
            vec3.transformMat4(tempVertex, tempVertex, this.fromSketch);

            this.vertexToIndex.push([element.data[2], element.data[3]]);
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
   * @param {number} index
   * @returns {LineConstructionElement | null}
   */
  getLine(index) {
    if (!this.hasLine(index)) return null;
    return this.data.elements[index - this.offsets.lineIndex / 2] ?? null;
  }

  /**
   * @param {number} index
   * @returns {[LineConstructionElement, number] | null}
   */
  getLineForPoint(index) {
    if (!this.hasPoint(index)) return null;
    index -= this.offsets.vertex / 3;
    const coords = this.vertexToIndex[index];
    if (!coords) return null;

    const line = this.data.elements.find(({ data }) =>
      (data[0] === coords[0] && data[1] === coords[1]) || (data[2] === coords[0] && data[3] === coords[1]),
    );
    return line ? [line, line.data[0] === coords[0] && line.data[1] === coords[1] ? 0 : 2] : null;
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

  /**
   * @param {number} index
   * @returns {boolean}
   */
  hasLine(index) {
    return this.indexBelongsTo('lineIndex', index * 2);
  }

  /**
   * @param {number} index
   * @returns {boolean}
   */
  hasPoint(index) {
    return this.indexBelongsTo('vertex', index * 3);
  }
}
