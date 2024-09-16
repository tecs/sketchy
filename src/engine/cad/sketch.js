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

/** @typedef {Constraint<"distance", 2, number>} DistanceConstraint */
/** @typedef {DistanceConstraint} Constraints */

/**
 * @typedef PointInfo
 * @property {ConstructionElements} element
 * @property {number} elementIndex
 * @property {number} offset
 * @property {number} index
 * @property {vec2} vec2
 */

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

  /** @type {PointInfo[]} */
  pointInfo = [];

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
        const selection = scene.selection.filter(el => el.type === 'line' || el.type === 'point');
        const lines = selection.reduce((out, { type, index }) => {
          const line = type === 'line' ? sketch.getLine(index) : sketch.getLineForPoint(index)?.[0];
          if (line && !out.includes(line)) {
            out.push(line);
          }
          return out;
        }, /** @type {LineConstructionElement[]} */ ([]));

        if (!lines.length) return;

        const action = history.createAction(`Delete line from Sketch ${sketch.name}`, {});
        if (!action) return;

        action.append(
          () => {
            lines.forEach(line => sketch.deleteElement(line));
            scene.removeFromSelection(selection);
          },
          () => {
            lines.forEach(line => sketch.addElement(line));
            scene.addToSelection(selection);
          },
        );
        action.commit();
      } else if (keyCombo === distanceKey.value) {
        const selectedLines = scene.getSelectionByType('line').reduce((lines, { index }) => {
          const line = sketch.getLine(index);
          if (line) lines.push([line, sketch.getConstraints(line, 'distance').pop()]);
          return lines;
        }, /** @type {[LineConstructionElement, DistanceConstraint?][]} */ ([]));
        if (!selectedLines.length) return;

        const value = selectedLines.find(([, distance]) => distance)?.[1]?.data
          ?? vec2.distance(...getLineVertices(selectedLines[0][0]));

        engine.emit('propertyrequest', { type: 'distance', value });
        engine.on('propertyresponse', (property) => {
          if (property?.type !== 'distance' || property.value <= 0) return;
          for (const [line, distance] of selectedLines) {
            if (distance) {
              distance.data = property.value;
              sketch.update();
            } else sketch.distance(property.value, line);
          }
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
    this.addElement(element);
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
    this.addConstraint(constraint);
    return constraint;
  }

  #solve() {
    const firstIndex = this.offsets.vertex / 3;
    this.pointInfo = [];
    for (let elementIndex = 0; elementIndex < this.data.elements.length; ++elementIndex) {
      const element = this.data.elements[elementIndex];
      for (let offset = 0; offset < element.data.length; offset += 2) {
        this.pointInfo.push({
          element,
          elementIndex,
          offset,
          index: firstIndex + this.pointInfo.length,
          vec2: vec2.fromValues(element.data[offset], element.data[offset + 1]),
        });
      }
    }

    const { currentStep } = this.engine.scene;
    const lockedIndices  = /** @type {PointInfo[]} */ ([]);

    if (this.engine.tools.isActive('move') && currentStep === this) {
      const selectedPoints = this.engine.scene.getSelectionByType('point');
      for (const point of selectedPoints) {
        const selectedPoint = this.getPointInfo(point.index);
        if (selectedPoint) lockedIndices.push(selectedPoint);
      }

      const selectedLines = this.engine.scene.getSelectionByType('line');
      for (const line of selectedLines) {
        const selectedLine = this.getLine(line.index);
        if (selectedLine) lockedIndices.push(...this.getPoints(selectedLine));
      }
    }

    let solved = true;
    let iteration = 0;

    do {
      iteration++;

      for (const constraint of this.data.constraints) {
        switch (constraint.type) {
          case 'distance': {
            const [p1, p2] = constraint.indices.map(index => this.getPointInfo(index));
            if (!p1 || !p2) break;
            const v1 = p1.vec2;
            const v2 = p2.vec2;

            const v1Locked = lockedIndices.includes(p1);
            const v2Locked = lockedIndices.includes(p2);
            if (v1Locked && v2Locked) break;

            const distance = vec2.distance(v1, v2);
            if (equals(distance, constraint.data)) break;

            solved = false;
            vec2.subtract(tempVec2, v1, v2);
            vec2.normalize(tempVec2, tempVec2);
            vec2.scale(tempVec2, tempVec2, (constraint.data - distance) * (v1Locked || v2Locked ? 0.5 : 0.25));

            if (!v1Locked) {
              vec2.add(v1, v1, tempVec2);
              const el1 = p1.element;
              el1.data[p1.offset] = v1[0];
              el1.data[p1.offset + 1] = v1[1];
            }
            if (!v2Locked) {
              vec2.subtract(v2, v2, tempVec2);
              const el2 = p2.element;
              el2.data[p2.offset] = v2[0];
              el2.data[p2.offset + 1] = v2[1];
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
    this.#resizeModelBuffer('vertex', this.pointInfo.length * 3);

    let lineIndexOffset = this.offsets.lineIndex;

    /** @type {number | undefined} */
    let cacheIndex = undefined;

    /** @type {[x: number, y: number, index: number][]} */
    const verticesCache = [];

    for (const { element, vec2: [dataX, dataY], index } of this.pointInfo) {
      const coordIndex = index * 3;
      switch (element.type) {
        case 'line':
          data.lineIndex[lineIndexOffset++] = index;
          cacheIndex = verticesCache.find(([x, y]) => x === dataX && y === dataY)?.[2];
          if (cacheIndex) {
            data.vertex.copyWithin(coordIndex, cacheIndex, cacheIndex + 3);
            break;
          }

          vec3.set(tempVertex, dataX, dataY, 0);
          vec3.transformMat4(tempVertex, tempVertex, this.fromSketch);

          verticesCache.push([dataX, dataY, coordIndex]);
          data.vertex.set(tempVertex, coordIndex);

          break;
      }
    }

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
   * @param {LineConstructionElement | [number, number]} lineOrIndices
   * @returns {Readonly<DistanceConstraint> | null}
   */
  distance(length, lineOrIndices) {
    if (!Array.isArray(lineOrIndices)) {
      const index = this.data.elements.indexOf(lineOrIndices);
      if (index === -1) return null;
      const indices = this.pointInfo.filter(info => info.elementIndex === index).map(info => info.index);
      if (indices.length !== 2) return null;
      lineOrIndices = /** @type {[number, number]} */ (indices);
    }

    if (!lineOrIndices.every(idx => this.hasPoint(idx))) return null;

    return this.#createConstraint('distance', lineOrIndices, length);
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
   * @param {LineConstructionElement} line
   * @returns {number | null}
   */
  getLineIndex(line) {
    const elementIndex = this.data.elements.indexOf(line);
    if (elementIndex === -1) return null;
    return this.offsets.lineIndex / 2 + elementIndex;
  }

  /**
   * @param {number} index
   * @returns {[LineConstructionElement, number] | null}
   */
  getLineForPoint(index) {
    const elementInfo = this.pointInfo.find(info => info.index === index);
    if (!elementInfo) return null;

    const line = this.data.elements[elementInfo.elementIndex];
    return line ? [line, elementInfo.offset] : null;
  }

  /**
   * @param {number} index
   * @returns {PointInfo | null}
   */
  getPointInfo(index) {
    return this.pointInfo.find(info => info.index === index) ?? null;
  }

  /**
   * @param {ConstructionElements} element
   * @returns {PointInfo[]}
   */
  getPoints(element) {
    return this.pointInfo.filter(info => info.element === element);
  }

  /**
   * @template {Constraints["type"] | undefined} T
   * @template {IfEquals<T, undefined, Constraints, Extract<Constraints, { type: T } >>} R
   * @param {ConstructionElements} element
   * @param {T} [type]
   * @returns {R[]}
   */
  getConstraints(element, type) {
    const indices = this.getPoints(element).map(info => info.index);
    const constraints = this.data.constraints
      .filter(constraint => constraint.indices.some(index => indices.includes(index)));
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
   * @template {ConstructionElements["type"] | undefined} T
   * @template {IfEquals<T, undefined, ConstructionElements, Extract<ConstructionElements, { type: T } >>} R
   * @param {T} [type]
   * @returns {R[]}
   */
  listElements(type) {
    return /** @type {R[]} */ (type ? this.data.elements.filter(e => e.type === type) : this.data.elements);
  }

  /**
   * @template {Constraints["type"] | undefined} T
   * @template {IfEquals<T, undefined, Constraints, Extract<Constraints, { type: T } >>} R
   * @param {T} [type]
   * @returns {R[]}
   */
  listConstraints(type) {
    return /** @type {R[]} */ (type ? this.data.constraints.filter(c => c.type === type) : this.data.constraints);
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
