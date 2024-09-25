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
 * @template {import('../general/state.js').Value} [D=null]
 * @typedef Constraint
 * @property {T} type
 * @property {Tuple<number, I>} indices
 * @property {D} data
 */

/** @typedef {Constraint<"distance", 2, number>} DistanceConstraint */
/** @typedef {Constraint<"coincident", 2>} CoincidentConstraint */
/** @typedef {Constraint<"horizontal", 2>} HorizontalConstraint */
/** @typedef {Constraint<"vertical", 2>} VerticalConstraint */
/** @typedef {DistanceConstraint|CoincidentConstraint|HorizontalConstraint|VerticalConstraint} Constraints */

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

/**
 * @typedef LinesData
 * @property {PointInfo} p1
 * @property {PointInfo} p2
 * @property {boolean} v1Locked
 * @property {boolean} v2Locked
 * @property {vec2} v1
 * @property {vec2} v2
 * @property {number} incrementScale
 */

/**
 * @template {Constraints["type"]} T
 * @typedef {(data: LinesData, value: Find<Constraints, "type", T>["data"], current: typeof value) => void} ApplyFn
 */

/**
 * @template {Constraints["type"]} T
 * @typedef {(data: LinesData, value: Find<Constraints, "type", T>["data"]) => [typeof value, boolean]} CheckFn
 */

// cached structures
const tempVec2 = vec2.create();
const forward = vec3.fromValues(0, 0, 1);
const rotation = quat.create();
const tempVertex = vec3.create();

/**
 * @template T
 * @param {T[]} collection
 * @param {(pair: [T, T]) => void} fn
 */
const forAllUniquePairs = (collection, fn) => {
  collection = collection.filter((v, i, a) => a.indexOf(v) === i);
  for (let i = 0; i < collection.length; ++i) {
    for (let k = i + 1; k < collection.length; ++k) {
      fn([collection[i], collection[k]]);
    }
  }
};

/**
 * @param {import("../editor.js").Collection} selection
 * @param {Sketch} sketch
 * @returns {number[]}
 */
const extractSelectionPoints = (selection, sketch) => selection.elements.flatMap(({ type, index }) => {
  switch (type) {
    case 'point': return index;
    case 'line': {
      const line = sketch.getLine(index);
      return line ? sketch.getLineIndices(line) ?? [] : [];
    }
  }
  return [];
});

/**
 * @param {Constraints} constraint
 * @param {Sketch} sketch
 * @param {number[]} locked
 * @returns {LinesData | null}
 */
const getElements = (constraint, sketch, locked) => {
  const [p1, p2] = constraint.indices.map(index => sketch.getPointInfo(index));
  if (!p1 || !p2) return null;

  const v1Locked = locked.includes(p1.index);
  const v2Locked = locked.includes(p2.index);
  if (v1Locked && v2Locked) return null;

  return {
    p1,
    p2,
    v1: p1.vec2,
    v2: p2.vec2,
    v1Locked,
    v2Locked,
    incrementScale: v1Locked || v2Locked ? 0.5 : 0.25,
  };
};

/** @type {{ [K in Constraints["type"]]: CheckFn<K> }} */
const checkConstraint = {
  distance: ({ v1, v2 }, value, distance = vec2.distance(v1, v2)) => [distance, equals(distance, value)],
  coincident: ({ v1, v2 }) => [null, vec2.equals(v1, v2)],
  horizontal: ({ v1, v2 }) => [null, v1[1] === v2[1]],
  vertical: ({ v1, v2 }) => [null, v1[0] === v2[0]],
};

/** @type {{ [K in Constraints["type"]]: ApplyFn<K> }} */
const applyConstraint = {
  distance({ v1Locked, v2Locked, v1, v2, incrementScale }, value, distance) {
    vec2.subtract(tempVec2, v1, v2);
    vec2.normalize(tempVec2, tempVec2);
    vec2.scale(tempVec2, tempVec2, (value - distance) * incrementScale);

    if (!v1Locked) vec2.add(v1, v1, tempVec2);
    if (!v2Locked) vec2.subtract(v2, v2, tempVec2);
  },
  coincident({ v1Locked, v2Locked, v1, v2, incrementScale }) {
    vec2.subtract(tempVec2, v1, v2);
    vec2.scale(tempVec2, tempVec2, incrementScale);

    if (!v1Locked) vec2.subtract(v1, v1, tempVec2);
    if (!v2Locked) vec2.add(v2, v2, tempVec2);
  },
  horizontal({ v1Locked, v2Locked, v1, v2, incrementScale }) {
    const diff = (v1[1] - v2[1]) * incrementScale;

    if (!v1Locked) v1[1] -= diff;
    if (!v2Locked) v2[1] += diff;
  },
  vertical({ v1Locked, v2Locked, v1, v2, incrementScale }) {
    const diff = (v1[0] - v2[0]) * incrementScale;

    if (!v1Locked) v1[0] -= diff;
    if (!v2Locked) v2[0] += diff;
  },
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

    const { editor: { selection }, scene, history, config } = engine;

    const distanceKey = config.createString('shortcuts.sketch.distance', 'Sketch constraint: distance', 'key', 'd');
    const coincidentKey = config.createString('shortcuts.sketch.coincident', 'Sketch constraint: coincident point', 'key', 'c');
    const horizontalKey = config.createString('shortcuts.sketch.horizontal', 'Sketch constraint: horizontal', 'key', 'h');
    const verticalKey = config.createString('shortcuts.sketch.vertical', 'Sketch constraint: vertical', 'key', 'v');

    engine.on('keydown', (_, keyCombo) => {
      const sketch = scene.currentStep ?? scene.enteredInstance?.body.step;
      if (!(sketch instanceof Sketch)) return;

      switch (keyCombo) {
        case 'delete': {
          const elements = selection.elements.filter(el => el.type === 'line' || el.type === 'point');
          const lines = elements.reduce((out, { type, index }) => {
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
              selection.remove(elements);
            },
            () => {
              lines.forEach(line => sketch.addElement(line));
              selection.add(elements);
            },
          );
          action.commit();

          break;
        }
        case distanceKey.value: {
          const selected = /** @type {[PointInfo, PointInfo, number?][]} */ ([]);
          const lines = selection.getByType('line').map(({ index }) => index);
          for (const index of lines) {
            const line = sketch.getLine(index);
            const [p1, p2] = line ? sketch.getPoints(line) : [];
            if (p1 && p2) {
              selected.push([p1, p2, sketch.getConstraintsForPoints([p1.index, p2.index], 'distance').pop()?.data]);
            }
          };

          const points = selection.getByType('point').map(({ index }) => index);
          forAllUniquePairs(points, (indices) => {
            const p1 = sketch.getPointInfo(indices[0]);
            const p2 = sketch.getPointInfo(indices[1]);
            if (p1 && p2 && !selected.find(([pp1, pp2]) => (pp1 === p1 && pp2 === p2) || (pp1 === p2 && pp2 === p1))) {
              selected.push([p1, p2, sketch.getConstraintsForPoints(indices, 'distance').pop()?.data]);
            }
          });

          if (!selected.length) return;

          const value = selected.find(([,, d]) => d)?.[2] ?? vec2.distance(selected[0][0].vec2, selected[0][1].vec2);

          engine.emit('propertyrequest', { type: 'distance', value }, /** @param {number} newValue */ (newValue) => {
            if (newValue <= 0) return;
            for (const [p1, p2] of selected) {
              sketch.distance(newValue, [p1.index, p2.index]);
            }
          });

          break;
        }
        case coincidentKey.value: {
          const points = selection.getByType('point').map(({ index }) => index);
          forAllUniquePairs(points, indices => sketch.coincident(indices));
          break;
        }
        case horizontalKey.value: {
          const points = extractSelectionPoints(selection, sketch);
          forAllUniquePairs(points, indices => sketch.horizontal(indices));
          break;
        }
        case verticalKey.value: {
          const points = extractSelectionPoints(selection, sketch);
          forAllUniquePairs(points, indices => sketch.vertical(indices));
          break;
        }
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
      case 'coincident':
      case 'horizontal':
      case 'vertical':
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

    this.#recalculate([]);
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
    const existingConstraint = this.getConstraintsForPoints(indices, type).pop();
    if (existingConstraint) {
      existingConstraint.data = data;
      this.update();
      return /** @type {T} */ (/** @type {Constraints} */ (existingConstraint));
    }

    const constraint = Sketch.makeConstraint(type, indices, data);
    this.addConstraint(constraint);
    return constraint;
  }

  /**
   * @param {number[]} lockedIndices
   */
  #solve(lockedIndices) {
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

    let solved = true;
    let iteration = 0;

    do {
      iteration++;
      solved = true;

      for (const constraint of this.data.constraints) {
        const elements = getElements(constraint, this, lockedIndices);
        if (!elements) continue;

        const [currentValue, passes] = /** @type {CheckFn<typeof constraint["type"]>} */
          (checkConstraint[constraint.type])(elements, constraint.data);

        if (passes) continue;
        solved = false;

        /** @type {ApplyFn<typeof constraint["type"]>} */
        (applyConstraint[constraint.type])(elements, constraint.data, currentValue);

        const { element: { data: d1 }, offset: o1, vec2: v1 } = elements.p1;
        const { element: { data: d2 }, offset: o2, vec2: v2 } = elements.p2;
        d1[o1] = v1[0];
        d1[o1 + 1] = v1[1];
        d2[o2] = v2[0];
        d2[o2 + 1] = v2[1];
      }
    } while (!solved && iteration < 1000);
  }

  /**
   * @param {number[]} lockedIndices
   */
  #recalculate(lockedIndices) {
    this.#solve(lockedIndices);

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

  /**
   * @param {number[]} [lockedIndices]
   */
  update(lockedIndices = []) {
    this.#recalculate(lockedIndices);
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
      const lineIndices = this.getLineIndices(lineOrIndices);
      if (!lineIndices) return null;

      lineOrIndices = lineIndices;
    } else if (!lineOrIndices.every(idx => this.hasPoint(idx))) return null;

    return /** @type {DistanceConstraint} */ (this.#createConstraint('distance', lineOrIndices, length));
  }

  /**
   * @param {[number, number]} indices
   * @returns {Readonly<CoincidentConstraint> | null}
   */
  coincident(indices) {
    if (indices[0] === indices[1]) return null;

    const p1 = this.getPointInfo(indices[0]);
    if (!p1) return null;

    const p2 = this.getPointInfo(indices[1]);
    if (!p2) return null;

    if (p1.element === p2.element) return null;

    return /** @type {CoincidentConstraint} */ (this.#createConstraint('coincident', indices, null));
  }

  /**
   * @param {LineConstructionElement | [number, number]} lineOrIndices
   * @returns {Readonly<HorizontalConstraint> | null}
   */
  horizontal(lineOrIndices) {
    if (!Array.isArray(lineOrIndices)) {
      const lineIndices = this.getLineIndices(lineOrIndices);
      if (!lineIndices) return null;

      lineOrIndices = lineIndices;
    } else if (lineOrIndices[0] === lineOrIndices[1]) return null;

    return /** @type {HorizontalConstraint} */ (this.#createConstraint('horizontal', lineOrIndices, null));
  }

  /**
   * @param {LineConstructionElement | [number, number]} lineOrIndices
   * @returns {Readonly<VerticalConstraint> | null}
   */
  vertical(lineOrIndices) {
    if (!Array.isArray(lineOrIndices)) {
      const lineIndices = this.getLineIndices(lineOrIndices);
      if (!lineIndices) return null;

      lineOrIndices = lineIndices;
    } else if (lineOrIndices[0] === lineOrIndices[1]) return null;

    return /** @type {VerticalConstraint} */ (this.#createConstraint('vertical', lineOrIndices, null));
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
   * @param {LineConstructionElement} line
   * @returns {[number, number] | null}
   */
  getLineIndices(line) {
    const index = this.data.elements.indexOf(line);
    if (index === -1) return null;

    const indices = this.pointInfo.filter(info => info.elementIndex === index).map(info => info.index);
    if (indices.length !== 2) return null;

    return /** @type {[number, number]} */ (indices);
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
   * @template {Constraints["type"] | undefined} T
   * @template {IfEquals<T, undefined, Constraints, Extract<Constraints, { type: T } >>} R
   * @param {number[]} indices
   * @param {T} [type]
   * @returns {R[]}
   */
  getConstraintsForPoints(indices, type) {
    const constraints = this.data.constraints
      .filter(constraint => indices.every(index => constraint.indices.includes(index)));
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
    const pointIndices = this.getPoints(element).map(point => point.index);
    this.data.elements.splice(index, 1);

    for (const constraint of constraints) {
      this.deleteConstraint(constraint);
    }

    for (const constraint of this.data.constraints) {
      for (const pointIndex of pointIndices) {
        for (let i = 0; i < constraint.indices.length; ++i) {
          if (constraint.indices[i] > pointIndex) --constraint.indices[i];
        }
      }
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
