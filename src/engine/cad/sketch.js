import { Properties } from '../general/properties.js';
import Input from '../input.js';
import cs from './constraints.js';
import Step from './step.js';
import triangulate from './triangulate.js';

const { vec2, vec3, mat4, quat } = glMatrix;

/** @typedef {import("./step.js").BaseParams<SketchState>} BaseParams */
/** @typedef {import("./step.js").BaseParams<ConstructableSketchState>} PartialBaseParams */
/** @typedef {import("../editor.js").Collection} Collection */
/** @typedef {import("./constraints.js").DistanceConstraint} DistanceConstraint */
/** @typedef {import("./constraints.js").WidthConstraint} WidthConstraint */
/** @typedef {import("./constraints.js").HeightConstraint} HeightConstraint */
/** @typedef {import("./constraints.js").EqualConstraint} EqualConstraint */
/** @typedef {import("./constraints.js").CoincidentConstraint} CoincidentConstraint */
/** @typedef {import("./constraints.js").HorizontalConstraint} HorizontalConstraint */
/** @typedef {import("./constraints.js").VerticalConstraint} VerticalConstraint */
/** @typedef {import("./constraints.js").Constraints} Constraints */

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
 * @template {Constraints["type"]} T
 * @template {Constraints} [C=Find<Constraints, "type", T>]
 * @typedef {[pairs: C["indices"][], data: (C["data"] | undefined)[], type: T, sketch: Sketch]} ExecArgs
 */

/** @typedef {Exclude<import("./constraints.js").DistanceConstraints, EqualConstraint>["type"]} DistanceType */
/** @typedef {Exclude<Constraints["type"], DistanceType>} ConstraintType */

// cached structures
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
 * @template {{}} T
 * @param {(T | null | undefined)[]} dirtyCollection
 * @returns {[T, T][]}
 */
const pair = (dirtyCollection) => {
  const collection = /** @type {T[]} */ ([]);

  for (const element of dirtyCollection) {
    if (element !== null && element !== undefined && !collection.includes(element)) {
      collection.push(element);
    }
  }

  const pairs = /** @type {[T, T][]} */ ([]);
  for (let i = 0; i < collection.length; ++i) {
    for (let k = i + 1; k < collection.length; ++k) {
      pairs.push([collection[i], collection[k]]);
    }
  }

  return pairs;
};

/**
 * @param {Collection} selection
 * @returns {[number, number][]}
 */
const extractPointPairs = selection => pair(selection.getByType('point').map(({ index }) => index));

/**
 * @param {Collection} selection
 * @param {Sketch} sketch
 * @returns {[number, number, number, number][]}
 */
const extractLinePairs = (selection, sketch) => pair(selection.getByType('line').map(({ index }) => sketch.getLine(index)))
  .reduce((indices, [l1, l2]) => {
    const i1 = sketch.getLineIndices(l1);
    const i2 = sketch.getLineIndices(l2);
    if (i1 && i2) indices.push([...i1, ...i2]);
    return indices;
  }, /** @type {[number, number, number, number][]} */ ([]));

/**
 * @param {Collection} selection
 * @param {Sketch} sketch
 * @returns {[number, number][]}
 */
const extractAllPoints = (selection, sketch) => pair(selection.elements.flatMap(({ type, index }) => {
  switch (type) {
    case 'point': return index;
    case 'line': {
      const line = sketch.getLine(index);
      return line ? sketch.getLineIndices(line) ?? [] : [];
    }
  }
  return [];
}));

/**
 * @param {Collection} selection
 * @param {Sketch} sketch
 * @returns {[number, number][]}
 */
const extractLinesOrPointPairs = (selection, sketch) => {
  const pairs = /** @type {[number, number][]} */ ([]);
  const lines = selection.getByType('line').map(({ index }) => sketch.getLine(index));
  for (const line of lines) {
    if (!line) continue;
    const indices = sketch.getLineIndices(line);
    if (indices) {
      pairs.push(indices);
    }
  };

  const pointPairs = extractPointPairs(selection);
  for (const [p1, p2] of pointPairs) {
    if (!pairs.find(([p3, p4]) => (p3 === p1 && p4 === p2) || (p3 === p2 && p4 === p1))) {
      pairs.push([p1, p2]);
    }
  }
  return pairs;
};

/**
 * @template {Constraints} C
 * @param {C} constraint
 * @param {Sketch} sketch
 * @returns {import("./constraints.js").ConstraintData<C>?}
 */
const getElements = (constraint, sketch) => {
  const pointsInfo = constraint.indices.map(index => sketch.getPointInfo(index)).filter(p => !!p);
  if (pointsInfo.length !== constraint.indices.length) return null;

  const numLocked = pointsInfo.reduce((total, { locked }) => total + (locked ? 1 : 0), 0);
  if (numLocked === pointsInfo.length) return null;

  return {
    elements: /** @type {import("./constraints.js").ConstraintData<C>["elements"]} */ (pointsInfo),
    value: constraint.data,
    incrementScale: 1 / (pointsInfo.length - numLocked),
  };
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

    let previousTool = engine.tools.selected;

    const cancellableTask = {
      handle: { valid: false },

      drop(revertTool = true) {
        if (this.handle.valid && revertTool) {
          engine.emit('cursorchange', previousTool?.cursor);
          engine.emit('contextactionchange', null);
          engine.tools.setTool(previousTool);
        }
        this.handle.valid = false;
      },

      /**
       * @template {Constraints["type"]} C
       * @param {C} constraintType
       * @param {(collection: typeof selection, sketch: Sketch) => ExecArgs<C>[0]} extractFn
       * @param {(...args: ExecArgs<C>) => void} thenFn
       * @param {(...args: ExecArgs<C>) => void} undoFn
       */
      async exec(constraintType, extractFn, thenFn, undoFn) {
        this.drop(false);

        const sketch = scene.currentStep ?? scene.enteredInstance?.body.step;
        if (!(sketch instanceof Sketch)) return;

        const selectTool = engine.tools.get('select');
        previousTool = engine.tools.selected ?? selectTool;
        engine.tools.setTool(selectTool);
        engine.emit('cursorchange', 'context-menu');

        this.handle = { valid: true };
        const { handle } = this;

        let data = extractFn(selection, sketch);
        let pass = data.length > 0;

        while (!pass && handle.valid) {
          await selection.waitFor('change');
          if (!handle.valid) return;
          data = extractFn(selection, sketch);
          pass = data.length > 0;
        }

        this.drop();
        if (!pass) return;

        const constraintData = data.map(indices => sketch.getConstraintsForPoints(indices, constraintType).pop()?.data);
        const action = history.createAction(`Create a ${constraintType} constraint`, null);
        if (!action) {
          thenFn(data, /** @type {ExecArgs<C>[1]} */ (constraintData), constraintType, sketch);
          return;
        }
        action.append(
          () => {
            thenFn(data, /** @type {ExecArgs<C>[1]} */ (constraintData), constraintType, sketch);
          },
          () => {
            undoFn(data, /** @type {ExecArgs<C>[1]} */ (constraintData), constraintType, sketch);
          },
        );
        action.commit();
      },
    };

    /**
     * @template T
     * @template {unknown[]} A
     * @param {(...args: A) => T} fn
     * @returns {(...args: A) => T}
     */
    const cache = (fn) => {
      /** @type {T?} */
      let result = null;
      let hydrated = false;

      return (...args) => {
        if (!hydrated) {
          result = fn(...args);
          hydrated = true;
        }
        return /** @type {T} */ (result);
      };
    };

    /**
     * @param {number} defaultValue
     * @returns {(value: number) => Promise<number>}
     */
    const cacheUserValue = (defaultValue = 0) => {
      let hydrated = false;

      return (value) => {
        if (!hydrated) {
          hydrated = true;
          return new Promise(resolve => {
            engine.emit('propertyrequest', { type: 'distance', value }, /** @param {number} newValue */ (newValue) => {
              defaultValue = newValue;
              resolve(newValue);
            });
          });
        }
        return Promise.resolve(defaultValue);
      };
    };

    /**
     * @param {0 | 1} [component]
     * @returns {(...args: ExecArgs<DistanceType>) => void}
     */
    const cachedDistanceConstraint = (component) => {
      const getUserValue = cacheUserValue();
      const getValue = cache(/** @type {(...args: ExecArgs<DistanceType>) => number} */ ((pairs, _, type, sketch) => {
        for (const indices of pairs) {
          const constraint = sketch.getConstraintsForPoints(indices, type).pop();
          if (constraint) return constraint.data;
        }
        const p1 = sketch.getPointInfo(pairs[0][0]);
        const p2 = sketch.getPointInfo(pairs[0][1]);
        if (!p1 || !p2) return 0;
        if (component === undefined) return vec2.distance(p1.vec2, p2.vec2);
        return Math.abs(p1.vec2[component] - p2.vec2[component]);
      }));

      return async (pairs, _, constraintType, sketch) => {
        const value = getValue(pairs, _, constraintType, sketch);
        const userValue = await getUserValue(value);
        if (userValue <= 0) return;
        for (const indices of pairs) {
          sketch[constraintType](userValue, indices);
        }
      };
    };

    /** @type {(...args: ExecArgs<DistanceType>) => void} */
    const undoDistanceConstraint = (pairs, previousValues, constraintType, sketch) => pairs.forEach((indices, i) => {
      const constraint = sketch.getConstraintsForPoints(indices, constraintType).pop();
      if (!constraint) return;
      if (previousValues[i] === undefined) sketch.deleteConstraint(constraint);
      else {
        constraint.data = previousValues[i];
        sketch.update();
      }
    });

    /** @type {(...args: ExecArgs<ConstraintType>) => void} */
    const doConstraint = (pairs, currentValues, constraintType, sketch) => pairs.forEach((indices, i) => {
      if (currentValues[i] === undefined) sketch[constraintType](/** @type {any} */ (indices));
    });

    /** @type {(...args: ExecArgs<ConstraintType>) => void} */
    const undoConstraint = (pairs, previousValues, constraintType, sketch) => pairs.forEach((indices, i) => {
      if (previousValues[i] !== undefined) return;

      const constraint = sketch.getConstraintsForPoints(indices, constraintType).pop();
      if (constraint) sketch.deleteConstraint(constraint);
    });

    /**
     * @template {Constraints["type"]} C
     * @param {C} type
     * @param {string} icon
     * @param {import("../input.js").KeyboardShortcutRepresentation} shortcut
     * @param {(collection: typeof selection, sketch: Sketch) => ExecArgs<C>[0]} extractFn
     * @param {(...args: ExecArgs<C>) => void} thenFn
     * @param {(...args: ExecArgs<C>) => void} undoFn
     * @returns {import("../tools.js").Action & { key: Readonly<import("../config.js").StringSetting>}}
     */
    const makeAction = (type, icon, shortcut, extractFn, thenFn, undoFn) => {
      const name = type.charAt(0).toUpperCase().concat(type.substring(1));
      const contextAction = {
        name,
        icon,
        call() {
          engine.emit('contextactionchange', contextAction);
          cancellableTask.exec(type, extractFn, thenFn, undoFn);
        },
        key: config.createString(`shortcuts.sketch.${type}`, `Sketch constraint: ${type}`, 'key', Input.stringify(shortcut)),
      };
      engine.input.registerShortcuts(contextAction.key);
      return contextAction;
    };

    const contextActions = [
      makeAction('distance', '⤡', [['k'], ['d']], extractLinesOrPointPairs, cachedDistanceConstraint(), undoDistanceConstraint),
      makeAction('width', '🡘', [['k'], ['l']], extractLinesOrPointPairs, cachedDistanceConstraint(0), undoDistanceConstraint),
      makeAction('height', '🡙', [['k'], ['i']], extractLinesOrPointPairs, cachedDistanceConstraint(1), undoDistanceConstraint),
      makeAction('equal', '=', [['k'], ['e']], extractLinePairs, doConstraint, undoConstraint),
      makeAction('coincident', '⌖', [['k'], ['c']], extractPointPairs, doConstraint, undoConstraint),
      makeAction('horizontal', '―', [['k'], ['h']], extractAllPoints, doConstraint, undoConstraint),
      makeAction('vertical', '|', [['k'], ['v']], extractAllPoints, doConstraint, undoConstraint),
    ];

    engine.on('keydown', (_, keyCombo) => {
      if (keyCombo === 'esc') cancellableTask.drop();

      const sketch = scene.currentStep ?? scene.enteredInstance?.body.step;
      if (!(sketch instanceof Sketch) || keyCombo !== 'delete') return;

      const elements = selection.elements.filter(el => el.type === 'line' || el.type === 'point');
      const selectedConstraints = selection.getByType('constraint');
      const lines = elements.reduce((out, { type, index }) => {
        const line = type === 'line' ? sketch.getLine(index) : sketch.getLineForPoint(index)?.[0];
        if (line && !out.includes(line)) {
          out.push(line);
        }
        return out;
      }, /** @type {LineConstructionElement[]} */ ([]))
        .map(line => /** @type {const} */ ([line, sketch.listElements().indexOf(line)]));

      const constraints = lines.flatMap(([line]) => sketch.getConstraints(line))
        .concat(selectedConstraints.map(({ index }) => sketch.data.constraints[index]))
        .filter((v, i, a) => v && a.indexOf(v) === i)
        .map(constraint => /** @type {const} */ ([constraint, sketch.listConstraints().indexOf(constraint)]));

      if (!lines.length && !constraints.length) return;

      const action = history.createAction(`Delete elements from Sketch ${sketch.name}`, null);
      if (!action) return;

      action.append(
        () => {
          lines.forEach(([line]) => sketch.deleteElement(line));
          constraints.forEach(([constraint]) => sketch.deleteConstraint(constraint));
          selection.remove(elements);
          selection.remove(selectedConstraints);
        },
        () => {
          lines.forEach(([line, indexAt]) => sketch.addElement(line, indexAt));
          constraints.forEach(([constraint, indexAt]) => sketch.addConstraint(constraint, indexAt));
          selection.add(elements);
          selection.add(selectedConstraints);
        },
      );
      action.commit();
    });

    engine.on('shortcut', setting => {
      for (const { key, call } of contextActions) {
        if (key === setting) return call();
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

    engine.on('stepchange', (current, previous, isSelectionChange) => {
      if (isSelectionChange) return;

      cancellableTask.drop();
      const isSketch = current instanceof Sketch;
      const wasSketch = previous instanceof Sketch;
      if (isSketch) current.update();
      if (wasSketch) previous.update();
      if (isSketch && !wasSketch) engine.tools.setContextActions(contextActions);
      else if (wasSketch && !isSketch) engine.tools.setContextActions(null);
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

    const constraint = /** @type {T} */ ({ type, indices, data });
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

        const handler = cs[constraint.type];

        const [currentValue, passes] = /** @type {import("./constraints.js").CheckFn<typeof constraint>} */
          (handler.check)(constraintData);

        if (passes) continue;
        solved = false;

        /** @type {import("./constraints.js").ApplyFn<typeof constraint>} */
        (handler.apply)(constraintData, currentValue);

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
      const lastFaceId = this.model.data.faceIds
        .subarray(0, this.offsets.faceIds)
        .reduce((max, next) => Math.max(next, max), 0);

      const faces = triangulate(lineVertices2D, lineIndices.map(i => i - this.offsets.lineIndex));
      const indices = faces.flatMap(face => face[0]);
      const vertices = transformFlatBuffer(faces.flatMap(face => face[1]), this.fromSketch);
      const faceIds = faces.flatMap(([, { length }], i) => Array(length * 0.5).fill(i + lastFaceId + 1));

      const normals = new Uint8Array(vertices.length);
      for (let i = 0; i < normals.length; i += 3) {
        normals.set(this.data.attachment.normal, i);
      }

      const startingVertex = this.offsets.vertex / 3;

      this.#resizeModelBuffer('vertex', vertices);
      this.#resizeModelBuffer('index', indices.map(i => i + startingVertex));
      this.#resizeModelBuffer('normal', normals);
      this.#resizeModelBuffer('color', new Array(vertices.length).fill(255));
      this.#resizeModelBuffer('faceIds', faceIds);
    }

    this.model.update('lineVertex', 'lineIndex', 'vertex', 'index', 'normal', 'color', 'faceIds');
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
   * @param {number} length
   * @param {LineConstructionElement | [number, number]} lineOrIndices
   * @returns {Readonly<WidthConstraint>?}
   */
  width(length, lineOrIndices) {
    if (!Array.isArray(lineOrIndices)) {
      const lineIndices = this.getLineIndices(lineOrIndices);
      if (!lineIndices) return null;

      lineOrIndices = lineIndices;
    } else if (lineOrIndices.some(idx => !this.hasPoint(idx))) return null;

    return /** @type {WidthConstraint} */ (this.#createConstraint('width', lineOrIndices, length));
  }

  /**
   * @param {number} length
   * @param {LineConstructionElement | [number, number]} lineOrIndices
   * @returns {Readonly<HeightConstraint>?}
   */
  height(length, lineOrIndices) {
    if (!Array.isArray(lineOrIndices)) {
      const lineIndices = this.getLineIndices(lineOrIndices);
      if (!lineIndices) return null;

      lineOrIndices = lineIndices;
    } else if (lineOrIndices.some(idx => !this.hasPoint(idx))) return null;

    return /** @type {HeightConstraint} */ (this.#createConstraint('height', lineOrIndices, length));
  }

  /**
   * @param {[LineConstructionElement, LineConstructionElement] | [number, number, number, number]} indices
   * @returns {Readonly<EqualConstraint>?}
   */
  equal(indices) {
    if (indices.length === 2) {
      if (indices[0] === indices[1] || indices.some(line => !this.data.elements.includes(line))) return null;

      const i1 = this.getLineIndices(indices[0]);
      const i2 = this.getLineIndices(indices[1]);
      if (!i1 || !i2) return null;

      indices = [...i1, ...i2];
    } else {
      if (indices.some((v, i, a) => a.indexOf(v) !== i)) return null;

      const lines = indices.map(index => this.getLineForPoint(index)?.[0]);
      if (lines.some(v => v === null)) return null;
      if (lines[0] !== lines[1] || lines[1] === lines[2] || lines[2] !== lines[3]) return null;
    }

    if (indices.length !== 4) return null;

    return /** @type {EqualConstraint} */ (this.#createConstraint('equal', indices, null));
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
   * @param {number} [atIndex]
   */
  addElement(element, atIndex = this.data.elements.length) {
    if (this.data.elements.includes(element)) return;
    this.data.elements.splice(atIndex, 0, element);
    this.update();
  }

  /**
   * @param {Readonly<Constraints>} constraint
   * @param {number} [atIndex]
   */
  addConstraint(constraint, atIndex = this.data.constraints.length) {
    if (this.data.constraints.includes(constraint)) return;
    this.data.constraints.splice(atIndex, 0, constraint);
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
