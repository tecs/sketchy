import { Properties } from '../general/properties.js';
import Input from '../input.js';
import Step from './step.js';
import triangulate from './triangulate.js';

const { glMatrix: { equals }, vec2, vec3, mat4, quat } = glMatrix;

/** @typedef {import("./step.js").BaseParams<SketchState>} BaseParams */
/** @typedef {import("./step.js").BaseParams<ConstructableSketchState>} PartialBaseParams */
/** @typedef {import("../general/state.js").Value} Value */

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
 * @template {Value} [D=null]
 * @template [S=D]
 * @typedef Constraint
 * @property {T} type
 * @property {Tuple<number, I>} indices
 * @property {D} data
 * @property {S} _current
 */

/** @typedef {Constraint<"distance", 2, number>} DistanceConstraint */
/** @typedef {Constraint<"coincident", 2>} CoincidentConstraint */
/** @typedef {Constraint<"horizontal", 2>} HorizontalConstraint */
/** @typedef {Constraint<"vertical", 2>} VerticalConstraint */
/** @typedef {Constraint<"equal", 4, null, [number, number]>} EqualConstraint */

/** @typedef {DistanceConstraint|EqualConstraint} DistanceConstraints */
/** @typedef {HorizontalConstraint|VerticalConstraint} OrientationConstraints */
/** @typedef {DistanceConstraints|CoincidentConstraint|OrientationConstraints} Constraints */

/**
 * @typedef PointInfo
 * @property {ConstructionElements} element
 * @property {number} elementIndex
 * @property {number} offset
 * @property {number} index
 * @property {boolean} locked
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
 * @template {Constraints} C
 * @typedef ConstraintData
 * @property {Tuple<PointInfo, C["indices"]["length"]>} elements
 * @property {number} incrementScale
 * @property {C["data"]} value
 */

/**
 * @template {Constraints} C
 * @typedef {(data: ConstraintData<C>) => [C["_current"], boolean]} CheckFn
 */

/**
 * @template {Constraints} C
 * @typedef {(data: ConstraintData<C>, current: C["_current"]) => void} ApplyFn
 */

// cached structures
const tempVec2 = vec2.create();
const forward = vec3.fromValues(0, 0, 1);
const rotation = quat.create();
const tempVertex = vec3.create();

/**
 * @param {number[]} flatBuffer
 * @param {ReadonlyMat4} transform
 * @returns {Float32Array}
 */
const transformFlatBuffer = (flatBuffer, transform) => {
  const nVertices = flatBuffer.length / 2;
  const buffer = new Float32Array(nVertices * 3);

  /** @type {[x: number, y: number, index: number][]} */
  const verticesCache = [];

  for (let i = 0; i < nVertices; ++i) {
    const flatIndex = i * 2;
    const index = i * 3;

    const dataX = flatBuffer[flatIndex];
    const dataY = flatBuffer[flatIndex + 1];

    const cacheIndex = verticesCache.find(([x, y]) => x === dataX && y === dataY)?.[2];
    if (cacheIndex !== undefined) {
      buffer.copyWithin(index, cacheIndex, cacheIndex + 3);
      continue;
    }

    vec3.set(tempVertex, dataX, dataY, 0);
    vec3.transformMat4(tempVertex, tempVertex, transform);

    verticesCache.push([dataX, dataY, index]);
    buffer.set(tempVertex, index);
  }

  return buffer;
};

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
 * @template {Constraints} C
 * @param {C} constraint
 * @param {Sketch} sketch
 * @returns {ConstraintData<C>?}
 */
const getElements = (constraint, sketch) => {
  const pointsInfo = constraint.indices.map(index => sketch.getPointInfo(index)).filter(p => !!p);
  if (pointsInfo.length !== constraint.indices.length) return null;

  const numLocked = pointsInfo.reduce((total, { locked }) => total + (locked ? 1 : 0), 0);
  if (numLocked === pointsInfo.length) return null;

  return {
    elements: /** @type {ConstraintData<C>["elements"]} */ (pointsInfo),
    value: constraint.data,
    incrementScale: 0.5 / (pointsInfo.length - numLocked),
  };
};

/** @type {{ [K in Constraints["type"]]: CheckFn<Find<Constraints, "type", K>> }} */
const checkConstraint = {
  distance({ elements: [p1, p2], value }) {
    const current = vec2.distance(p1.vec2, p2.vec2);
    return [current, equals(current, value)];
  },
  coincident: ({ elements: [p1, p2] }) => [null, vec2.equals(p1.vec2, p2.vec2)],
  horizontal: ({ elements: [p1, p2] }) => [null, equals(p1.vec2[1], p2.vec2[1])],
  vertical: ({ elements: [p1, p2] }) => [null, equals(p1.vec2[0], p2.vec2[0])],
  equal: ({ elements: [p1, p2, p3, p4] }) => {
    const distance1 = vec2.distance(p1.vec2, p2.vec2);
    const distance2 = vec2.distance(p3.vec2, p4.vec2);
    return [[distance1, distance2], equals(distance1, distance2)];
  },
};

/** @type {{ [K in Constraints["type"]]: ApplyFn<Find<Constraints, "type", K>> }} */
const applyConstraint = {
  distance({ elements: [p1, p2], incrementScale, value }, distance) {
    vec2.subtract(tempVec2, p1.vec2, p2.vec2);
    vec2.normalize(tempVec2, tempVec2);
    vec2.scale(tempVec2, tempVec2, (value - distance) * incrementScale);

    if (!p1.locked) vec2.add(p1.vec2, p1.vec2, tempVec2);
    if (!p2.locked) vec2.subtract(p2.vec2, p2.vec2, tempVec2);
  },
  coincident({ elements: [p1, p2], incrementScale }) {
    vec2.subtract(tempVec2, p1.vec2, p2.vec2);
    vec2.scale(tempVec2, tempVec2, incrementScale);

    if (!p1.locked) vec2.subtract(p1.vec2, p1.vec2, tempVec2);
    if (!p2.locked) vec2.add(p2.vec2, p2.vec2, tempVec2);
  },
  horizontal({ elements: [p1, p2], incrementScale }) {
    const diff = (p1.vec2[1] - p2.vec2[1]) * incrementScale;

    if (!p1.locked) p1.vec2[1] -= diff;
    if (!p2.locked) p2.vec2[1] += diff;
  },
  vertical({ elements: [p1, p2], incrementScale }) {
    const diff = (p1.vec2[0] - p2.vec2[0]) * incrementScale;

    if (!p1.locked) p1.vec2[0] -= diff;
    if (!p2.locked) p2.vec2[0] += diff;
  },
  equal({ elements: [p1, p2, p3, p4], incrementScale }, [distance1, distance2]) {
    if (!p1.locked || !p2.locked) {
      vec2.subtract(tempVec2, p1.vec2, p2.vec2);
      vec2.normalize(tempVec2, tempVec2);
      vec2.scale(tempVec2, tempVec2, (distance2 - distance1) * incrementScale);

      if (!p1.locked) vec2.add(p1.vec2, p1.vec2, tempVec2);
      if (!p2.locked) vec2.subtract(p2.vec2, p2.vec2, tempVec2);
    }

    if (!p3.locked || !p4.locked) {
      vec2.subtract(tempVec2, p3.vec2, p4.vec2);
      vec2.normalize(tempVec2, tempVec2);
      vec2.scale(tempVec2, tempVec2, (distance1 - distance2) * incrementScale);

      if (!p3.locked) vec2.add(p3.vec2, p3.vec2, tempVec2);
      if (!p4.locked) vec2.subtract(p4.vec2, p4.vec2, tempVec2);
    }
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

    const distanceKey = config.createString('shortcuts.sketch.distance', 'Sketch constraint: distance', 'key', Input.stringify([['k'], ['d']]));
    const coincidentKey = config.createString('shortcuts.sketch.coincident', 'Sketch constraint: coincident point', 'key', Input.stringify([['k'], ['c']]));
    const horizontalKey = config.createString('shortcuts.sketch.horizontal', 'Sketch constraint: horizontal', 'key', Input.stringify([['k'], ['h']]));
    const verticalKey = config.createString('shortcuts.sketch.vertical', 'Sketch constraint: vertical', 'key', Input.stringify([['k'], ['v']]));
    const equalKey = config.createString('shortcuts.sketch.equal', 'Sketch constraint: equal', 'key', Input.stringify([['k'], ['e']]));

    engine.input.registerShortcuts(distanceKey, coincidentKey, horizontalKey, verticalKey, equalKey);

    let previousTool = engine.tools.selected;

    const cancellableTask = {
      handle: { valid: false },

      drop(revertTool = true) {
        if (this.handle.valid && revertTool) {
          engine.emit('cursorchange', previousTool?.cursor);
          engine.tools.setTool(previousTool);
        }
        this.handle.valid = false;
      },

      /**
       * @template T
       * @param {(collection: typeof selection) => T} extractFn
       * @param {(arg: T) => boolean} testFn
       * @param {(arg: T) => void} thenFn
       */
      async exec(extractFn, testFn, thenFn) {
        this.drop(false);

        const selectTool = engine.tools.get('select');
        previousTool = engine.tools.selected ?? selectTool;
        engine.tools.setTool(selectTool);
        engine.emit('cursorchange', 'context-menu');

        this.handle = { valid: true };
        const { handle } = this;

        let data = extractFn(selection);
        let pass = testFn(data);

        while (!pass && handle.valid) {
          await selection.waitFor('change');
          if (!handle.valid) return;
          data = extractFn(selection);
          pass = testFn(data);
        }

        this.drop();
        if (pass) thenFn(data);
      },
    };

    engine.on('keydown', (_, keyCombo) => {
      if (keyCombo === 'esc') cancellableTask.drop();

      const sketch = scene.currentStep ?? scene.enteredInstance?.body.step;
      if (!(sketch instanceof Sketch) || keyCombo !== 'delete') return;

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
    });

    engine.on('shortcut', setting => {
      const sketch = scene.currentStep ?? scene.enteredInstance?.body.step;
      if (!(sketch instanceof Sketch)) return;

      switch (setting) {
        case distanceKey:
          cancellableTask.exec(
            s => {
              const pairs = /** @type {[PointInfo, PointInfo, number?][]} */ ([]);
              const lines = s.getByType('line').map(({ index }) => index);
              for (const index of lines) {
                const line = sketch.getLine(index);
                const [p1, p2] = line ? sketch.getPoints(line) : [];
                if (p1 && p2) {
                  pairs.push([p1, p2, sketch.getConstraintsForPoints([p1.index, p2.index], 'distance').pop()?.data]);
                }
              };

              const points = s.getByType('point').map(({ index }) => index);
              forAllUniquePairs(points, (indices) => {
                const p1 = sketch.getPointInfo(indices[0]);
                const p2 = sketch.getPointInfo(indices[1]);
                if (p1 && p2 && !pairs.find(([p3, p4]) => (p3 === p1 && p4 === p2) || (p3 === p2 && p4 === p1))) {
                  pairs.push([p1, p2, sketch.getConstraintsForPoints(indices, 'distance').pop()?.data]);
                }
              });
              return pairs;
            },
            pairs => pairs.length > 0,
            pairs => {
              const value = pairs.find(([,, d]) => d)?.[2] ?? vec2.distance(pairs[0][0].vec2, pairs[0][1].vec2);

              engine.emit('propertyrequest', { type: 'distance', value }, /** @param {number} newValue */ (newValue) => {
                if (newValue <= 0) return;
                for (const [p1, p2] of pairs) {
                  sketch.distance(newValue, [p1.index, p2.index]);
                }
              });
            },
          );
          break;
        case equalKey:
          cancellableTask.exec(
            s => s.getByType('line').map(({ index }) => sketch.getLine(index)).filter(line => line !== null),
            lines => lines.length > 1,
            lines => forAllUniquePairs(lines, linePairs => sketch.equal(linePairs)),
          );
          break;
        case coincidentKey:
          cancellableTask.exec(
            s => s.getByType('point').map(({ index }) => index),
            points => points.length > 1,
            points => forAllUniquePairs(points, indices => sketch.coincident(indices)),
          );
          break;
        case horizontalKey:
          cancellableTask.exec(
            s => extractSelectionPoints(s, sketch),
            points => points.length > 1,
            points => forAllUniquePairs(points, indices => sketch.horizontal(indices)),
          );
          break;
        case verticalKey:
          cancellableTask.exec(
            s => extractSelectionPoints(s, sketch),
            points => points.length > 1,
            points => forAllUniquePairs(points, indices => sketch.vertical(indices)),
          );
          break;
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

    engine.on('stepchange', (current, previous) => {
      cancellableTask.drop();
      if (current instanceof Sketch) current.update();
      if (previous instanceof Sketch) previous.update();
    });

    engine.on('toolchange', () => cancellableTask.drop(false));
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
      case 'equal':
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
    const firstIndex = this.offsets.lineVertex / 3;
    this.pointInfo = [];
    for (let elementIndex = 0; elementIndex < this.data.elements.length; ++elementIndex) {
      const element = this.data.elements[elementIndex];
      for (let offset = 0; offset < element.data.length; offset += 2) {
        const index = firstIndex + this.pointInfo.length;
        this.pointInfo.push({
          element,
          elementIndex,
          offset,
          index,
          locked: lockedIndices.includes(index),
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
        const constraintData = getElements(constraint, this);
        if (!constraintData) continue;

        const [currentValue, passes] = /** @type {CheckFn<typeof constraint>} */
          (checkConstraint[constraint.type])(constraintData);

        if (passes) continue;
        solved = false;

        /** @type {ApplyFn<typeof constraint>} */
        (applyConstraint[constraint.type])(constraintData, currentValue);

        for (const { element: { data }, offset, vec2: vec } of constraintData.elements) {
          data[offset] = vec[0];
          data[offset + 1] = vec[1];
        }
      }
    } while (!solved && iteration < 1000);
  }

  /**
   * @param {number[]} lockedIndices
   */
  #recalculate(lockedIndices) {
    this.#solve(lockedIndices);

    const lineVertices2D = /** @type {number[]} */ ([]);
    const lineIndices = /** @type {number[]} */ ([]);

    for (const { element, vec2: [dataX, dataY], index } of this.pointInfo) {
      switch (element.type) {
        case 'line':
          lineVertices2D.push(dataX, dataY);
          lineIndices.push(index);
          break;
      }
    }

    const lineVertices = transformFlatBuffer(lineVertices2D, this.fromSketch);
    this.#resizeModelBuffer('lineVertex', lineVertices);
    this.#resizeModelBuffer('lineIndex', lineIndices);

    // don't triangulate while editing the sketch
    if (this.engine.scene.currentStep === this) {
      this.#resizeModelBuffer('vertex', 0);
      this.#resizeModelBuffer('index', 0);
      this.#resizeModelBuffer('normal', 0);
      this.#resizeModelBuffer('color', 0);
    } else {
      const [indices, vertices2D] = triangulate(lineVertices2D, lineIndices.map(i => i - this.offsets.lineIndex));
      const vertices = transformFlatBuffer(vertices2D, this.fromSketch);

      const normals = new Uint8Array(vertices.length);
      for (let i = 0; i < normals.length; i += 3) {
        normals.set(this.data.attachment.normal, i);
      }

      const startingVertex = this.offsets.vertex / 3;

      this.#resizeModelBuffer('vertex', vertices);
      this.#resizeModelBuffer('index', indices.map(i => i + startingVertex));
      this.#resizeModelBuffer('normal', normals);
      this.#resizeModelBuffer('color', new Array(vertices.length).fill(255));
    }

    this.model.update('lineVertex', 'lineIndex', 'vertex', 'index', 'normal', 'color');
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
   * @returns {Readonly<DistanceConstraint>?}
   */
  distance(length, lineOrIndices) {
    if (!Array.isArray(lineOrIndices)) {
      const lineIndices = this.getLineIndices(lineOrIndices);
      if (!lineIndices) return null;

      lineOrIndices = lineIndices;
    } else if (lineOrIndices.some(idx => !this.hasPoint(idx))) return null;

    return /** @type {DistanceConstraint} */ (this.#createConstraint('distance', lineOrIndices, length));
  }

  /**
   * @param {[LineConstructionElement, LineConstructionElement]} lines
   * @returns {Readonly<EqualConstraint>?}
   */
  equal(lines) {
    if (lines[0] === lines[1] || lines.some(line => !this.data.elements.includes(line))) return null;
    const indices = lines.flatMap(line => this.getPoints(line) ?? []).map(({ index }) => index);

    return /** @type {EqualConstraint} */ (
      this.#createConstraint('equal', /** @type {[number, number, number, number]}*/ (indices), null)
    );
  }

  /**
   * @param {[number, number]} indices
   * @returns {Readonly<CoincidentConstraint>?}
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
   * @returns {Readonly<HorizontalConstraint>?}
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
   * @returns {Readonly<VerticalConstraint>?}
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
   * @returns {LineConstructionElement?}
   */
  getLine(index) {
    if (!this.hasLine(index)) return null;
    return this.data.elements[index - this.offsets.lineIndex / 2] ?? null;
  }

  /**
   * @param {LineConstructionElement} line
   * @returns {number?}
   */
  getLineIndex(line) {
    const elementIndex = this.data.elements.indexOf(line);
    if (elementIndex === -1) return null;
    return this.offsets.lineIndex / 2 + elementIndex;
  }

  /**
   * @param {LineConstructionElement} line
   * @returns {[number, number]?}
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
   * @returns {[LineConstructionElement, number]?}
   */
  getLineForPoint(index) {
    const elementInfo = this.pointInfo.find(info => info.index === index);
    if (!elementInfo) return null;

    const line = this.data.elements[elementInfo.elementIndex];
    return line ? [line, elementInfo.offset] : null;
  }

  /**
   * @param {number} index
   * @returns {PointInfo?}
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
    return this.indexBelongsTo('lineVertex', index * 3);
  }
}
