import { Properties } from '../general/properties.js';
import Step from './step.js';

const { glMatrix: { equals }, vec2, vec3, mat4, quat } = glMatrix;

/** @typedef {import("./step.js").BaseParams<SketchState>} BaseParams */
/** @typedef {import("./step.js").BaseParams<ConstructableSketchState>} PartialBaseParams */

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
 * @template {string} T
 * @template {number} I
 * @template {import('../general/state.js').Value} D
 * @typedef Constraint
 * @property {T} type
 * @property {Tuple<number, I>} indices
 * @property {D} data
 */

/** @typedef {Constraint<"distance", 1, number>} DistanceConstraint */
/** @typedef {DistanceConstraint} Constraints */

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
 * @property {Constraints[]} constraints
 */

/** @typedef {Omit<SketchState, "elements" | "constraints"> & Partial<SketchState>} ConstructableSketchState */

// cached structures
const tempVec2 = vec2.create();
const forward = vec3.fromValues(0, 0, 1);
const rotation = quat.create();
const tempVertex = vec3.create();

/**
 * @param {Readonly<LineConstructionElement>} line
 * @returns {[vec2, vec2]}
 */
const getLineVertices = ({ data: [x1, y1, x2, y2] }) => {
  return [vec2.fromValues(x1, y1), vec2.fromValues(x2, y2)];
};

export default class Sketch extends /** @type {typeof Step<SketchState>} */ (Step) {
  normal = vec3.create();
  toSketch = mat4.create();
  fromSketch = mat4.create();

  /** @type {[element: number, componentOffset: number][]} */
  indexToElement = [];

  /** @param {PartialBaseParams} args  */
  constructor(...args) {
    if (!args[0].elements) {
      args[0] = { ...args[0], elements: [] };
    }
    if (!args[0].constraints) {
      args[0] = { ...args[0], constraints: [] };
    }
    super(.../** @type {BaseParams} */ (args));

    this.Properties.extend(properties => Properties.merge(properties, {
      Attachment: {
        Type: { value: this.State.data.attachment.type, type: 'plain' },
        Normal: { value: this.normal, type: 'vec3' },
      },
    }));

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

    const { scene, history, config } = engine;

    const distanceKey = config.createString('sketch.distance', 'Sketch constraint: distance', 'key', 'd');

    engine.on('keydown', (_, keyCombo) => {
      const sketch = scene.currentStep ?? scene.enteredInstance?.body.step;
      if (!(sketch instanceof Sketch)) return;

      if (keyCombo === 'delete') {
        const index = scene.selectedPointIndex ?? scene.selectedLineIndex;
        if (index === null) return;

        const type = scene.selectedPointIndex !== null ? 'point' : 'line';

        const line = type === 'point' ? sketch.getLineForPoint(index)?.[0] : sketch.getLine(index);
        if (!line) return;

        const action = history.createAction(`Delete line from Sketch ${sketch.name}`, {});
        if (!action) return;

        action.append(
          () => {
            sketch.deleteElement(line);
            if (type === 'line') scene.setSelectedLine(null);
            else scene.setSelectedPoint(null);
          },
          () => {
            sketch.addElement(line);
            if (type === 'line') scene.setSelectedLine(index);
            else scene.setSelectedPoint(index);
          },
        );
        action.commit();
      } else if (keyCombo === distanceKey.value) {
        if (scene.selectedLineIndex === null) return;

        const line = sketch.getLine(scene.selectedLineIndex);
        if (!line) return;

        const distance = sketch.getConstraints(line, 'distance').pop();
        const value = distance?.data ?? vec2.distance(...getLineVertices(line));

        engine.emit('propertyrequest', { type: 'distance', value });
        engine.on('propertyresponse', (property) => {
          if (property?.type !== 'distance') return;
          if (distance) {
            distance.data = property.value;
            sketch.update();
          } else sketch.distance(property.value, line);
        }, true);
      }
    });

    engine.on('mousedown', (button, count) => {
      const { currentInstance, hoveredInstance, currentStep, hoveredLineIndex, hoveredPointIndex } = scene;
      if (button !== 'left' || count !== 2 || hoveredInstance !== currentInstance) return;

      const sketch = currentInstance.body.step;
      if (!(sketch instanceof Sketch) || sketch === currentStep) return;

      if (hoveredLineIndex !== null && sketch.hasLine(hoveredLineIndex)) scene.setCurrentStep(sketch);
      else if (hoveredPointIndex !== null && sketch.hasPoint(hoveredPointIndex)) scene.setCurrentStep(sketch);
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
      case 'line':
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
   * @template {Constraints} T
   * @param {T["type"]} type
   * @param {T["indices"]} indices
   * @param {T["data"]} data
   * @returns {T}
   */
  static makeConstraint(type, indices, data) {
    switch (type) {
      case 'distance':
        return /** @type {T} */ ({ type, indices, data });
      default:
        throw new Error(`Unknown constraint type "${type}"`);
    }
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

  /**
   * @template {Constraints} T
   * @param {T["type"]} type
   * @param {T["indices"]} indices
   * @param {T["data"]} data
   * @returns {T}
   */
  #createConstraint(type, indices, data) {
    const constraint = Sketch.makeConstraint(type, indices, data);
    this.data.constraints.push(constraint);
    this.update();
    return constraint;
  }

  #solve() {
    let solved = true;
    let iteration = 0;

    do {
      iteration++;

      for (const constraint of this.data.constraints) {
        switch (constraint.type) {
          case 'distance': {
            const line = this.data.elements[constraint.indices[0]];
            const [v1, v2] = getLineVertices(line);
            const distance = vec2.distance(v1, v2);
            if (!equals(distance, constraint.data)) {
              solved = false;
              const scale = (constraint.data - distance) / 4;
              vec2.subtract(tempVec2, v1, v2);
              vec2.scaleAndAdd(v1, v1, tempVec2, scale);
              vec2.scaleAndAdd(v2, v2, tempVec2, -scale);
              line.data[0] = v1[0];
              line.data[1] = v1[1];
              line.data[2] = v2[0];
              line.data[3] = v2[1];
            }
            break;
          }
        }
      }
    } while (!solved && iteration < 1000);
  }

  #recalculate() {
    this.#solve();

    const { data } = this.model;

    this.#resizeModelBuffer('lineIndex', this.data.elements.length * 2);

    const firstIndex = this.offsets.vertex / 3;
    let lineIndexOffset = this.offsets.lineIndex;
    let lastIndex = firstIndex;

    this.indexToElement = [];

    /** @type {number | undefined} */
    let cacheIndex = undefined;

    /** @type {[x: number, y: number, index: number][]} */
    const verticesCache = [];

    /** @type {number[]} */
    const verticesToAdd = [];

    for (let i = 0; i < this.data.elements.length; ++i) {
      const element = this.data.elements[i];
      switch (element.type) {
        case 'line':
          for (let c = 0; c < element.data.length; c += 2) {
            const dataX = element.data[c + 0];
            const dataY = element.data[c + 1];

            cacheIndex = verticesCache.find(([x, y]) => x === dataX && y === dataY)?.[2];
            if (cacheIndex === undefined) {
              vec3.set(tempVertex, dataX, dataY, 0);
              vec3.transformMat4(tempVertex, tempVertex, this.fromSketch);

              verticesCache.push([dataX, dataY, verticesToAdd.length]);
              verticesToAdd.push(...tempVertex);
            } else verticesToAdd.push(...verticesToAdd.slice(cacheIndex, cacheIndex + 3));

            this.indexToElement.push([i, c]);
            data.lineIndex[lineIndexOffset++] = lastIndex++;
          }

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
   * @param {number} length
   * @param {LineConstructionElement} line
   * @returns {Readonly<DistanceConstraint> | null}
   */
  distance(length, line) {
    const index = this.data.elements.indexOf(line);
    if (index === -1) return null;

    return this.#createConstraint('distance', [index], length);
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
    const elementInfo = this.indexToElement[index];
    if (!elementInfo) return null;

    const line = this.data.elements[elementInfo[0]];
    return line ? [line, elementInfo[1]] : null;
  }

  /**
   * @template {Constraints["type"] | undefined} T
   * @template {IfEquals<T, undefined, Constraints, Extract<Constraints, { type: T } >>} R
   * @param {ConstructionElements} element
   * @param {T} [type]
   * @returns {R[]}
   */
  getConstraints(element, type) {
    const index = this.data.elements.indexOf(element);
    if (index === -1) return [];
    const constraints = this.data.constraints.filter(constraint => constraint.indices.includes(index));
    return /** @type {R[]} */ (type !== undefined ? constraints.filter(c => c.type === type) : constraints);
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
   * @param {Readonly<Constraints>} constraint
   */
  addConstraint(constraint) {
    if (this.data.constraints.includes(constraint)) return;
    this.data.constraints.push(constraint);
    this.update();
  }

  /**
   * @param {Readonly<ConstructionElements>} element
   */
  deleteElement(element) {
    const index = this.data.elements.indexOf(element);
    if (index === -1) return;

    const constraints = this.getConstraints(element);
    this.data.elements.splice(index, 1);

    for (const constraint of constraints) {
      this.deleteConstraint(constraint);
    }

    this.update();
  }

  /**
   * @param {Readonly<Constraints>} constraint
   */
  deleteConstraint(constraint) {
    const index = this.data.constraints.indexOf(constraint);
    if (index === -1) return;

    this.data.constraints.splice(index, 1);
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
