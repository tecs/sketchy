import { Properties } from '../general/properties.js';
import Input from '../input.js';
import cs from './constraints.js';
import Step from './step.js';
import { triangulate } from './triangulate.js';

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
/** @typedef {import("./constraints.js").AngleConstraint} AngleConstraint */
/** @typedef {import("./constraints.js").ParallelConstraint} ParallelConstraint */
/** @typedef {import("./constraints.js").PerpendicularConstraint} PerpendicularConstraint */
/** @typedef {import("./constraints.js").Constraints} Constraints */

/**
 * @template {string} T
 * @template {number} S
 * @typedef ConstructionElement
 * @property {T} type
 * @property {Tuple<number, S>} data
 * @property {boolean} support
 */

/** @typedef {ConstructionElement<"line", 4>} LineConstructionElement */
/** @typedef {LineConstructionElement} ConstructionElements */

/**
 * @typedef PointInfo
 * @property {ConstructionElements} element
 * @property {number} elementIndex
 * @property {number} offset
 * @property {number} id
 * @property {boolean} locked
 * @property {vec2} vec2
 */

/**
 * @typedef AxisAttachment
 * @property {"plane"} type
 * @property {PlainVec3} normal
 */

/**
 * @typedef FaceAttachment
 * @property {"face"} type
 * @property {number} faceId
 */

/** @typedef {AxisAttachment | FaceAttachment} Attachment */

/**
 * @typedef SketchState
 * @property {Attachment} attachment
 * @property {ConstructionElements[]} elements
 * @property {Constraints[]} constraints
 */

/** @typedef {Omit<SketchState, "elements" | "constraints"> & Partial<SketchState>} ConstructableSketchState */

/** @typedef {Exclude<import("./constraints.js").DistanceConstraints, EqualConstraint>["type"]} DistanceType */
/** @typedef {AngleConstraint["type"]} AngleType */
/** @typedef {Exclude<Constraints["type"], DistanceType | AngleType>} ConstraintType */

/**
 * @typedef IndexMapping
 * @property {number} [nextIndex]
 * @property {number} [duplicate]
 * @property {Map<number, number>} mapping
 */

// cached structures
const forward = vec3.fromValues(0, 0, 1);
const rotation = quat.create();
const tempVertex = vec3.create();
const tempVertex2 = vec3.create();

const originElement = /** @type {LineConstructionElement} */ ({ type: 'line', data: [0, 0, 0, 0] });
const xAxisElement = /** @type {LineConstructionElement} */ ({ type: 'line', data: [-1, 0, 1, 0] });
const yAxisElement = /** @type {LineConstructionElement} */ ({ type: 'line', data: [0, -1, 0, 1] });

const originPoint = /** @type {PointInfo} */ ({
  element: originElement,
  elementIndex: -1,
  offset: 0,
  id: -1,
  locked: true,
  vec2: vec2.create(),
});
const xAxisPoint1 = { ...originPoint, index: -2, element: xAxisElement, vec2: vec2.fromValues(-1, 0) };
const xAxisPoint2 = { ...xAxisPoint1, index: -3, offset: 2, vec2: vec2.fromValues(1, 0) };
const yAxisPoint1 = { ...originPoint, index: -4, element: yAxisElement, vec2: vec2.fromValues(0, -1) };
const yAxisPoint2 = { ...yAxisPoint1, index: -5, offset: 2, vec2: vec2.fromValues(0, 1) };

const xAxisPointIds = /** @type {const} */ ([xAxisPoint1.index, xAxisPoint2.index]);
const yAxisPointIds = /** @type {const} */ ([yAxisPoint1.index, yAxisPoint2.index]);

/**
 * @param {number} axisId
 * @returns {Readonly<[number, number]>?}
 */
const getAxisIds = (axisId) => {
  switch (axisId) {
    case 1: return xAxisPointIds;
    case 2: return yAxisPointIds;
    default: return null;
  }
};

/**
 * @param {Readonly<number[]>} flatBuffer
 * @param {number[]} buffer
 * @param {ReadonlyMat4} transform
 * @param {IndexMapping} mapping
 */
const appendFlatBuffer = (flatBuffer, buffer, transform, mapping) => {
  mapping.nextIndex ??= buffer.length / 3;
  mapping.duplicate ??= 0;

  for (let i = 0; i < flatBuffer.length; i += 2) {
    vec3.set(tempVertex, flatBuffer[i], flatBuffer[i + 1], 0);
    vec3.transformMat4(tempVertex, tempVertex, transform);

    let found = false;
    for (let k = 0; k < buffer.length; k += 3) {
      vec3.set(tempVertex2, buffer[k], buffer[k + 1], buffer[k + 2]);
      if (vec3.equals(tempVertex, tempVertex2)) {
        ++mapping.duplicate;
        found = true;
        mapping.mapping.set(mapping.nextIndex, k / 3);
        break;
      }
    }

    if (!found) {
      if (mapping.duplicate > 0) mapping.mapping.set(mapping.nextIndex, mapping.nextIndex - mapping.duplicate);
      buffer.push(...tempVertex);
    }

    ++mapping.nextIndex;
  }
};

/**
 * @param {Readonly<number[]>} indices
 * @param {Readonly<IndexMapping>} mapping
 * @returns {number[]}
 */
const remapIndices = (indices, { mapping }) => {
  const newIndices = indices.slice();
  for (let i = 0; i < newIndices.length; ++i) {
    const toIndex = mapping.get(newIndices[i]);
    if (toIndex !== undefined) newIndices[i] = toIndex;
  }
  return newIndices;
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
const extractPointPairs = selection => pair(
  selection.getByType('point').map(({ id }) => id)
    .concat(selection.getByType('axis').some(({ id }) => id === 0) ? -1 : []),
);

/**
 * @param {Collection} selection
 * @param {Sketch} sketch
 * @returns {[number, number, number, number][]}
 */
const extractLinePairs = (selection, sketch) => pair(selection.getByType('line').map(({ id }) => sketch.getLine(id)))
  .reduce((indices, [l1, l2]) => {
    const i1 = sketch.getLineIds(l1);
    const i2 = sketch.getLineIds(l2);
    if (i1 && i2) indices.push([...i1, ...i2]);
    return indices;
  }, /** @type {[number, number, number, number][]} */ ([]));

/**
 * @param {Collection} selection
 * @param {Sketch} sketch
 * @returns {[number, number, number, number][]}
 */
const extractLinePairWithAxes = (selection, sketch) => {
  /** @type {Readonly<[number, number]>[]} */
  const lines = selection.getByType('line')
    .map(({ id }) => sketch.getLine(id))
    .map(line => line ? sketch.getLineIds(line) : null)
    .filter(ids => ids !== null);

  const axes = selection.getByType('axis')
    .map(({ id }) => getAxisIds(id))
    .filter(ids => ids !== null);
  for (const axisIds of axes) {
    lines.unshift(axisIds);
    break; // only one axis in a pair
  }

  return lines.length > 1 ? [[...lines[0], ...lines[1]]] : [];
};

/**
 * @param {Collection} selection
 * @param {Sketch} sketch
 * @returns {[number, number, number, number][]}
 */
const extractLinePairsWithAxes = (selection, sketch) => {
  /** @type {Readonly<[number, number]>[]} */
  const lines = selection.getByType('line')
    .map(({ id }) => sketch.getLine(id))
    .map(line => line ? sketch.getLineIds(line) : null)
    .filter(ids => ids !== null);

  const axes = selection.getByType('axis')
    .map(({ id }) => getAxisIds(id))
    .filter(ids => ids !== null);

  if (axes.length > 0) return lines.map(lineIds => [...lineIds, ...axes[0]]);

  return pair(lines).map(([ids1, ids2]) => [...ids1, ...ids2]);
};

/**
 * @param {Collection} selection
 * @param {Sketch} sketch
 * @returns {[number, number][]}
 */
const extractAllPoints = (selection, sketch) => pair(selection.elements.flatMap(({ type, id }) => {
  switch (type) {
    case 'axis': return id ? [] : -1;
    case 'point': return id;
    case 'line': {
      const line = sketch.getLine(id);
      return line ? sketch.getLineIds(line) ?? [] : [];
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
  const lines = selection.getByType('line').map(({ id }) => sketch.getLine(id));
  for (const line of lines) {
    if (!line) continue;
    const indices = sketch.getLineIds(line);
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
 * @param {boolean} [ignoreLocked]
 * @returns {import("./constraints.js").ConstraintData<C>?}
 */
const getElements = (constraint, sketch, ignoreLocked = false) => {
  const pointsInfo = constraint.indices.map(index => sketch.getPointInfo(index)).filter(p => !!p);
  if (pointsInfo.length !== constraint.indices.length) return null;

  const numLocked = ignoreLocked ? 0 : pointsInfo.reduce((total, { locked }) => total + (locked ? 1 : 0), 0);
  if (numLocked === pointsInfo.length) return null;

  return {
    elements: /** @type {import("./constraints.js").ConstraintData<C>["elements"]} */ (pointsInfo),
    value: constraint.data,
    incrementScale: 1 / (pointsInfo.length - numLocked),
  };
};

export default class Sketch extends /** @type {typeof Step<SketchState>} */ (Step) {
  normal = vec3.create();
  offset = vec3.create();
  toSketch = mat4.create();
  fromSketch = mat4.create();

  /** @type {PointInfo[]} */
  pointInfo = [];

  static #drawAsSupport = false;

  static #cancellableTask = {
    handle: { valid: false },
    drop: (_revertTool = true) => false,
    /**
     * @template {Constraints["type"]} C
     * @param {C} _constraintType
     * @param {(collection: Collection, sketch: Sketch) => import("./sketch-types").ExecArgs<C>[0]} _extractFn
     * @param {(...args: import("./sketch-types").ExecArgs<C>) => void} _thenFn
     * @param {(...args: import("./sketch-types").ExecArgs<C>) => void} _undoFn
     */
    exec(_constraintType, _extractFn, _thenFn, _undoFn) {},
  };

  /** @param {PartialBaseParams} args  */
  constructor(...args) {
    if (!args[0].elements) {
      args[0] = { ...args[0], elements: [] };
    }
    if (!args[0].constraints) {
      args[0] = { ...args[0], constraints: [] };
    }
    super(.../** @type {BaseParams} */ (args));

    /** @type {Record<string, import("../general/properties.js").PropertyData>} */
    const attachmentProperties = {
      Type: { value: this.State.data.attachment.type, type: 'plain' },
      Normal: { value: this.normal, type: 'vec3' },
      Offset: { value: this.offset, type: 'coord' },
    };

    if (this.State.data.attachment.type === 'face') {
      attachmentProperties.FaceId = { value: String(this.State.data.attachment.faceId), type: 'plain' };
    }

    this.Properties.extend(properties => Properties.merge(properties, {
      Attachment: attachmentProperties,
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

    const { editor: { selection, edited }, scene, history, config } = engine;

    let previousTool = engine.tools.selected;

    Sketch.#cancellableTask = {
      handle: { valid: false },

      drop(revertTool = true) {
        const taskDropped = this.handle.valid;
        if (taskDropped && revertTool) {
          engine.emit('cursorchange', previousTool?.cursor);
          engine.emit('contextactionchange', null);
          engine.tools.setTool(previousTool);
        }
        this.handle.valid = false;
        return taskDropped;
      },

      async exec(constraintType, extractFn, thenFn, undoFn) {
        this.drop(false);

        const sketch = scene.currentStep ?? scene.enteredInstance?.body.step;
        if (!(sketch instanceof Sketch)) return;

        const selectTool = engine.tools.get('select');
        previousTool = engine.tools.selected ?? selectTool;
        engine.tools.setTool(selectTool);
        engine.emit('cursorchange', `constraint-action-${constraintType}`);

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
          thenFn(data, constraintData, constraintType, sketch);
          return;
        }
        action.append(
          () => thenFn(data, constraintData, constraintType, sketch),
          () => undoFn(data, constraintData, constraintType, sketch),
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
     * @param {"distance" | "angle"} type
     * @param {number} defaultValue
     * @returns {(value: number) => Promise<number>}
     */
    const cacheUserValue = (type, defaultValue = 0) => {
      let hydrated = false;

      return (value) => {
        const propertyData = /** @type {{ type: "distance", value: number }} */ ({ type, value });
        if (!hydrated) {
          hydrated = true;
          return new Promise(resolve => {
            engine.emit('propertyrequest', propertyData, /** @param {number} newValue */ (newValue) => {
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
     * @returns {(...args: import("./sketch-types").ExecArgs<DistanceType>) => void}
     */
    const cachedDistanceConstraint = (component) => {
      const getUserValue = cacheUserValue('distance');
      const getValue = cache(/** @type {(...args: import("./sketch-types").ExecArgs<DistanceType>) => number} */ (
        (pairs, _, type, sketch) => {
          for (const indices of pairs) {
            const constraint = sketch.getConstraintsForPoints(indices, type).pop();
            if (constraint) return constraint.data;
          }
          const p1 = sketch.getPointInfo(pairs[0][0]);
          const p2 = sketch.getPointInfo(pairs[0][1]);
          if (!p1 || !p2) return 0;
          if (component === undefined) return vec2.distance(p1.vec2, p2.vec2);
          return Math.abs(p1.vec2[component] - p2.vec2[component]);
        }
      ));

      return async (pairs, _, constraintType, sketch) => {
        const value = getValue(pairs, _, constraintType, sketch);
        const userValue = await getUserValue(value);
        if (userValue <= 0) return;
        for (const indices of pairs) {
          sketch[constraintType](userValue, indices);
        }
      };
    };

    /** @type {(...args: import("./sketch-types").ExecArgs<DistanceType>) => void} */
    const undoDistanceConstraint = (pairs, previousValues, constraintType, sketch) => pairs.forEach((indices, i) => {
      const constraint = sketch.getConstraintsForPoints(indices, constraintType).pop();
      if (!constraint) return;
      if (previousValues[i] === undefined) sketch.deleteConstraint(constraint);
      else {
        constraint.data = previousValues[i];
        sketch.update();
      }
    });

    /**
     * @returns {(...args: import("./sketch-types").ExecArgs<AngleType>) => void}
     */
    const cachedAngleConstraint = () => {
      const getUserValue = cacheUserValue('angle');
      const getValue = cache(/** @type {(...args: import("./sketch-types").ExecArgs<AngleType>) => number} */ (
        (pairs, _, type, sketch) => {
          for (const indices of pairs) {
            const constraint = sketch.getConstraintsForPoints(indices, type).pop();
            if (constraint) return constraint.data;
          }
          const p1 = sketch.getPointInfo(pairs[0][0]);
          const p2 = sketch.getPointInfo(pairs[0][1]);
          const p3 = sketch.getPointInfo(pairs[0][2]);
          const p4 = sketch.getPointInfo(pairs[0][3]);
          if (!p1 || !p2 || !p3 || !p4) return 0;
          return cs[type].check({ elements: [p1, p2, p3, p4], incrementScale: 0, value: 0 })[0];
        }
      ));

      return async (pairs, _, constraintType, sketch) => {
        const value = getValue(pairs, _, constraintType, sketch);
        const userValue = await getUserValue(value);
        for (const indices of pairs) {
          sketch[constraintType](userValue, indices);
        }
      };
    };

    /** @type {(...args: import("./sketch-types").ExecArgs<AngleType>) => void} */
    const undoAngleConstraint = (pairs, previousValues, constraintType, sketch) => pairs.forEach((indices, i) => {
      const constraint = sketch.getConstraintsForPoints(indices, constraintType).pop();
      if (!constraint) return;
      if (previousValues[i] === undefined) sketch.deleteConstraint(constraint);
      else {
        constraint.data = previousValues[i];
        sketch.update();
      }
    });

    /** @type {(...args: import("./sketch-types").ExecArgs<ConstraintType>) => void} */
    const doConstraint = (pairs, currentValues, constraintType, sketch) => pairs.forEach((indices, i) => {
      if (currentValues[i] === undefined) sketch[constraintType](/** @type {any} */ (indices));
    });

    /** @type {(...args: import("./sketch-types").ExecArgs<ConstraintType>) => void} */
    const undoConstraint = (pairs, previousValues, constraintType, sketch) => pairs.forEach((indices, i) => {
      if (previousValues[i] !== undefined) return;

      const constraint = sketch.getConstraintsForPoints(indices, constraintType).pop();
      if (constraint) sketch.deleteConstraint(constraint);
    });

    /**
     * @template {Constraints["type"]} C
     * @param {C} type
     * @param {import("../input.js").KeyboardShortcutRepresentation} shortcut
     * @param {(collection: typeof selection, sketch: Sketch) => import("./sketch-types").ExecArgs<C>[0]} extractFn
     * @param {(...args: import("./sketch-types").ExecArgs<C>) => void} thenFn
     * @param {(...args: import("./sketch-types").ExecArgs<C>) => void} undoFn
     * @returns {import("../tools.js").Action}}
     */
    const makeAction = (type, shortcut, extractFn, thenFn, undoFn) => {
      const name = type.charAt(0).toUpperCase().concat(type.substring(1));
      const contextAction = {
        name,
        icon: `constraint-${type}`,
        call() {
          engine.emit('contextactionchange', contextAction);
          Sketch.#cancellableTask.exec(type, extractFn, thenFn, undoFn);
        },
        key: config.createString(`shortcuts.sketch.${type}`, `Sketch constraint: ${type}`, 'key', Input.stringify(shortcut)),
      };
      engine.input.registerShortcuts(contextAction.key);
      return contextAction;
    };

    const supportContextAction = {
      name: 'Toggle support geometry',
      icon: 'support-geometry',
      active: this.#drawAsSupport,
      call() {
        const sketch = scene.currentStep;
        if (!(sketch instanceof Sketch)) return;

        // toggle selected lines
        const selected = selection.getByType('line').map(({ id }) => sketch.getLine(id)).filter(line => line !== null);
        if (selected.length > 0) {
          const mostAreSupport = selected.reduce((count, { support }) => count + (support ? 1 : -1), 0) > 0;
          const toChange = selected.filter(({ support }) => support === mostAreSupport);

          const action = history.createAction('Toggle support geometry', { geometry: toChange });
          if (!action) return;

          action.append(
            ({ geometry }) => {
              for (const element of geometry) element.support = !mostAreSupport;
              sketch.update();
            },
            ({ geometry }) => {
              for (const element of geometry) element.support = mostAreSupport;
              sketch.update();
            },
          );

          action.commit();
          return;
        }

        // toggle currently drawn lines
        const drawn = edited.getByType('line').map(({ id }) => sketch.getLine(id)).filter(line => line !== null);
        if (drawn.length > 0) {
          for (const line of drawn) line.support = !line.support;
          sketch.update();
          return;
        }

        supportContextAction.active = !supportContextAction.active;
        Sketch.#drawAsSupport = supportContextAction.active;

        if (supportContextAction.active) engine.emit('contextactionactivate', supportContextAction);
        else engine.emit('contextactiondeactivate', supportContextAction);
      },
      key: config.createString(`shortcuts.sketch.support`, 'Support geometry', 'key', Input.stringify([['d'], ['s']])),
    };
    engine.input.registerShortcuts(supportContextAction.key);

    const contextActions = [
      supportContextAction,
      null,
      makeAction('distance', [['k'], ['d']], extractLinesOrPointPairs, cachedDistanceConstraint(), undoDistanceConstraint),
      makeAction('width', [['k'], ['l']], extractLinesOrPointPairs, cachedDistanceConstraint(0), undoDistanceConstraint),
      makeAction('height', [['k'], ['i']], extractLinesOrPointPairs, cachedDistanceConstraint(1), undoDistanceConstraint),
      makeAction('equal', [['k'], ['e']], extractLinePairs, doConstraint, undoConstraint),
      makeAction('coincident', [['k'], ['c']], extractPointPairs, doConstraint, undoConstraint),
      makeAction('horizontal', [['k'], ['h']], extractAllPoints, doConstraint, undoConstraint),
      makeAction('vertical', [['k'], ['v']], extractAllPoints, doConstraint, undoConstraint),
      makeAction('angle', [['k'], ['a']], extractLinePairWithAxes, cachedAngleConstraint(), undoAngleConstraint),
      makeAction('parallel', [['k'], ['p']], extractLinePairsWithAxes, doConstraint, undoConstraint),
      makeAction('perpendicular', [['k'], ['n']], extractLinePairsWithAxes, doConstraint, undoConstraint),
    ];

    engine.on('keydown', (_, keyCombo) => {
      const sketch = scene.currentStep ?? scene.enteredInstance?.body.step;
      if (!(sketch instanceof Sketch) || keyCombo !== 'delete') return;

      const elements = selection.elements.filter(el => el.type === 'line' || el.type === 'point');
      const selectedConstraints = selection.getByType('constraint');
      const lines = elements.reduce((out, { type, id }) => {
        const line = type === 'line' ? sketch.getLine(id) : sketch.getLineForPoint(id)?.[0];
        if (line && !out.includes(line)) {
          out.push(line);
        }
        return out;
      }, /** @type {LineConstructionElement[]} */ ([]))
        .map(line => /** @type {const} */ ([line, sketch.listElements().indexOf(line)]));

      const constraints = lines.flatMap(([line]) => sketch.getConstraints(line))
        .concat(selectedConstraints.map(({ id }) => sketch.data.constraints[id]))
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
      for (const action of contextActions) {
        if (action?.key === setting) return action.call();
      }
    });

    engine.on('mousedown', (button, count) => {
      const { currentInstance, hoveredInstance, currentStep, hoveredLineId, hoveredPointId } = scene;
      if (button !== 'left' || count !== 2 || hoveredInstance !== currentInstance) return;

      const sketch = currentInstance.body.step;
      if (!(sketch instanceof Sketch) || sketch === currentStep) return;

      if (hoveredLineId !== null && sketch.hasLine(hoveredLineId)) scene.setCurrentStep(sketch);
      else if (hoveredPointId !== null && sketch.hasPoint(hoveredPointId)) scene.setCurrentStep(sketch);
    });

    engine.on('stepchange', (current, previous, isSelectionChange) => {
      if (isSelectionChange) return;

      Sketch.#cancellableTask.drop();
      const isSketch = current instanceof Sketch;
      const wasSketch = previous instanceof Sketch;
      if (isSketch) current.update();
      if (wasSketch) previous.update();
      if (isSketch && !wasSketch) engine.tools.setContextActions(contextActions);
      else if (wasSketch && !isSketch) engine.tools.setContextActions(null);
    });

    engine.on('toolchange', () => void(Sketch.#cancellableTask.drop(false)));

    engine.on('copy', entities => {
      const sketch = scene.currentStep;

      if (!(sketch instanceof Sketch)) {
        // don't copy sketch elements if outside an active sketch
        const entityTypes = ['line', 'constraint', 'point'];
        entities.remove(entities.elements.filter(({ type }) => entityTypes.includes(type)));
        return;
      }

      // only lines are supported for copying
      entities.remove(entities.elements.filter(({ type }) => type !== 'line'));
    });

    engine.on('paste', action => {
      const sketch = scene.currentStep;
      if (!(sketch instanceof Sketch)) return;

      const instance = scene.currentInstance;

      const selectedLines = action.data.elements.filter(({ type }) => type === 'line');
      if (selectedLines.length === 0) return;

      const parentSketch = selectedLines[0].instance.body.listSteps(Sketch)
        .findLast(testSketch => testSketch.hasLine(selectedLines[0].id));
      if (!parentSketch) return;

      const lines = action.data.elements.map(({ id }) => parentSketch.getLine(id)).filter(line => line !== null);
      const linePoints = lines.map(line => parentSketch.getLineIds(line)).filter(points => points !== null);
      const pointMap = new Map(linePoints.flat().map((id, i) => [id, sketch.model.lastPointId + i + 1]));
      const linesToAdd = lines.map(line => Sketch.cloneConstructionElement(line));

      const constraints = [
        ...pair(linePoints.flat()).flatMap(pointPair => parentSketch.getConstraintsForPoints(pointPair)),
        ...pair(linePoints).flatMap(pointPair => parentSketch.getConstraintsForPoints(pointPair.flat())),
      ].filter((v, i, a) => a.indexOf(v) === i);

      const constraintsToAdd = constraints.map(constraint => {
        const newConstraint = Sketch.cloneConstraint(constraint);
        for (let i = 0; i < newConstraint.indices.length; ++i) {
          const oldId = newConstraint.indices[i];
          newConstraint.indices[i] = pointMap.get(oldId) ?? oldId;
        }
        return newConstraint;
      });

      action.append(
        () => {
          linesToAdd.forEach(line => sketch.addElement(line));
          constraintsToAdd.forEach(constraint => sketch.addConstraint(constraint));
          const lineIds = linesToAdd.map(line => sketch.getLineId(line)).filter(id => id !== null);
          selection.set(lineIds.map(id => ({ id, instance, type: 'line' })));
        },
        () => linesToAdd.forEach(line => sketch.deleteElement(line)),
      );

      action.data.onSuccess.push(() => {
        const { tools } = engine;
        const tool = tools.get('move');
        tools.setTool(tool);
        tool?.start();
      });
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

    const element = /** @type {T} */ ({ type, data: Array(size), support: this.#drawAsSupport });
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
    const clone = /** @type {T} */ ({
      type: element.type,
      data: Array(element.data.length),
      support: element.support,
    });
    for (let i = 0; i < element.data.length; ++i) {
      clone.data[i] = element.data[i];
    }
    return clone;
  }

  /**
   * @template {Constraints} T
   * @param {T} constraint
   * @returns {T}
   */
  static cloneConstraint(constraint) {
    return /** @type {T} */ ({ type: constraint.type, data: constraint.data, indices: [...constraint.indices] });
  }

  #recompute() {
    if (this.data.attachment.type === 'plane') vec3.set(this.normal, ...this.data.attachment.normal);
    else {
      const face = this.model.data.faces[this.data.attachment.faceId - 1];
      const index = face?.loop[0] ?? face?.holes[0]?.[0];
      if (index !== undefined) {
        vec3.copy(this.normal, face.normal);
        tempVertex.set(this.model.data.vertices.slice(index * 3, index * 3 + 3));
        vec3.scale(this.offset, this.normal, -vec3.dot(this.normal, tempVertex));
      }
    }
    quat.rotationTo(rotation, this.normal, forward);
    mat4.fromQuat(this.toSketch, rotation);
    mat4.translate(this.toSketch, this.toSketch, this.offset);
    mat4.invert(this.fromSketch, this.toSketch);

    this.#recalculate([]);
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
   * @param {number[]} lockedIds
   */
  #solve(lockedIds) {
    const nextPointId = this.lastPointId + 1;
    this.pointInfo = [];
    for (let elementIndex = 0; elementIndex < this.data.elements.length; ++elementIndex) {
      const element = this.data.elements[elementIndex];
      for (let offset = 0; offset < element.data.length; offset += 2) {
        const id = nextPointId + this.pointInfo.length;
        this.pointInfo.push({
          element,
          elementIndex,
          offset,
          id,
          locked: lockedIds.includes(id),
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

    if (lockedIds.length === 0) return;

    for (const constraint of this.data.constraints) {
      if (!solved) break;

      const constraintData = getElements(constraint, this, true);
      if (!constraintData) continue;

      [, solved] = /** @type {import("./constraints.js").CheckFn<typeof constraint>} */
        (cs[constraint.type].check)(constraintData);
    }

    if (!solved) this.#solve([]);
  }

  /**
   * @param {number[]} lockedIndices
   */
  #recalculate(lockedIndices) {
    this.#solve(lockedIndices);

    const lineVertices2D = /** @type {number[]} */ ([]);
    const lineIndices = /** @type {number[]} */ ([]);
    const supportIndices = /** @type {number[]} */ ([]);

    const nextFaceId = this.lastFaceId + 1;
    const nextIndex = this.lastVerticesLength / 3;

    const newData = this.model.export();

    newData.faces.splice(nextFaceId - 1);
    newData.vertices.splice(this.lastVerticesLength);
    newData.segments.splice(this.lastSegmentsLength);
    for (let i = newData.supportSegments.length - 1; i >= 0; --i) {
      if (!newData.segments.includes(newData.supportSegments[i])) {
        newData.supportSegments.splice(i, 1);
      }
    }

    for (const { element, vec2: [dataX, dataY] } of this.pointInfo) {
      switch (element.type) {
        case 'line':
          lineIndices.push(nextIndex + lineVertices2D.length / 2);
          if (element.support) supportIndices.push(nextIndex + lineVertices2D.length / 2);
          lineVertices2D.push(dataX, dataY);
          break;
      }
    }

    const mapping = /** @type {IndexMapping} */ ({ mapping: new Map() });
    appendFlatBuffer(lineVertices2D, newData.vertices, this.fromSketch, mapping);
    newData.segments.push(...remapIndices(lineIndices, mapping));
    newData.supportSegments.push(...remapIndices(supportIndices, mapping));

    // don't triangulate while editing the sketch
    if (this.engine.scene.currentStep !== this) {
      const vertices2D = /** @type {PlainVec2[]} */ ([]);
      const triangulations = triangulate(
        lineVertices2D,
        lineIndices.filter(i => !supportIndices.includes(i)).map(i => i - nextIndex),
        vertices2D,
      );
      const nextVertexIndex = mapping.nextIndex ?? 0;
      appendFlatBuffer(vertices2D.flat(), newData.vertices, this.fromSketch, mapping);
      for (const { loop, holes } of triangulations) {
        newData.faces.push({
          color: [255, 255, 255],
          normal: /** @type {PlainVec3} */ ([...this.normal]),
          holes: holes.map(hole => remapIndices(hole.map(i => i + nextVertexIndex), mapping)),
          loop: remapIndices(loop.indices.map(i => i + nextVertexIndex), mapping),
        });
      }
    }

    this.model.import(newData);
  }

  recompute() {
    super.recompute();
    this.#recompute();
  }

  /**
   * @param {number[]} [lockedIds]
   */
  update(lockedIds = []) {
    this.#recalculate(lockedIds);
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
   * @param {LineConstructionElement | [number, number]} lineOrPointIds
   * @returns {Readonly<DistanceConstraint>?}
   */
  distance(length, lineOrPointIds) {
    if (!Array.isArray(lineOrPointIds)) {
      const ids = this.getLineIds(lineOrPointIds);
      if (!ids) return null;

      lineOrPointIds = ids;
    } else if (lineOrPointIds.some(idx => idx > -1 && !this.hasPoint(idx))) return null;

    return /** @type {DistanceConstraint} */ (this.#createConstraint('distance', lineOrPointIds, length));
  }

  /**
   * @param {number} length
   * @param {LineConstructionElement | [number, number]} lineOrPointIds
   * @returns {Readonly<WidthConstraint>?}
   */
  width(length, lineOrPointIds) {
    if (!Array.isArray(lineOrPointIds)) {
      const ids = this.getLineIds(lineOrPointIds);
      if (!ids) return null;

      lineOrPointIds = ids;
    } else if (lineOrPointIds.some(idx => idx > -1 && !this.hasPoint(idx))) return null;

    return /** @type {WidthConstraint} */ (this.#createConstraint('width', lineOrPointIds, length));
  }

  /**
   * @param {number} length
   * @param {LineConstructionElement | [number, number]} lineOrPointIds
   * @returns {Readonly<HeightConstraint>?}
   */
  height(length, lineOrPointIds) {
    if (!Array.isArray(lineOrPointIds)) {
      const ids = this.getLineIds(lineOrPointIds);
      if (!ids) return null;

      lineOrPointIds = ids;
    } else if (lineOrPointIds.some(idx => idx > -1 && !this.hasPoint(idx))) return null;

    return /** @type {HeightConstraint} */ (this.#createConstraint('height', lineOrPointIds, length));
  }

  /**
   * @param {[LineConstructionElement, LineConstructionElement] | [number, number, number, number]} ids
   * @returns {Readonly<EqualConstraint>?}
   */
  equal(ids) {
    const linePairIds = this.getLinePairIds(ids);
    if (linePairIds === null) return null;
    return /** @type {EqualConstraint} */ (this.#createConstraint('equal', linePairIds, null));
  }

  /**
   * @param {[number, number]} ids
   * @returns {Readonly<CoincidentConstraint>?}
   */
  coincident(ids) {
    if (ids[0] === ids[1]) return null;

    const p1 = this.getPointInfo(ids[0]);
    if (!p1) return null;

    const p2 = this.getPointInfo(ids[1]);
    if (!p2) return null;

    if (p1.element === p2.element) return null;

    return /** @type {CoincidentConstraint} */ (this.#createConstraint('coincident', ids, null));
  }

  /**
   * @param {LineConstructionElement | [number, number]} lineOrPointIds
   * @returns {Readonly<HorizontalConstraint>?}
   */
  horizontal(lineOrPointIds) {
    if (!Array.isArray(lineOrPointIds)) {
      const ids = this.getLineIds(lineOrPointIds);
      if (!ids) return null;

      lineOrPointIds = ids;
    } else if (lineOrPointIds[0] === lineOrPointIds[1]) return null;

    return /** @type {HorizontalConstraint} */ (this.#createConstraint('horizontal', lineOrPointIds, null));
  }

  /**
   * @param {LineConstructionElement | [number, number]} lineOrPointIds
   * @returns {Readonly<VerticalConstraint>?}
   */
  vertical(lineOrPointIds) {
    if (!Array.isArray(lineOrPointIds)) {
      const ids = this.getLineIds(lineOrPointIds);
      if (!ids) return null;

      lineOrPointIds = ids;
    } else if (lineOrPointIds[0] === lineOrPointIds[1]) return null;

    return /** @type {VerticalConstraint} */ (this.#createConstraint('vertical', lineOrPointIds, null));
  }

  /**
   * @param {number} value
   * @param {[number, number, number, number]} pointIds
   * @returns {Readonly<AngleConstraint>?}
   */
  angle(value, pointIds) {
    if (pointIds.some((v, i, a) => a.indexOf(v) !== i)) return null;

    return /** @type {AngleConstraint} */ (this.#createConstraint('angle', pointIds, value));
  }

  /**
   * @param {[LineConstructionElement, LineConstructionElement] | [number, number, number, number]} ids
   * @returns {Readonly<ParallelConstraint>?}
   */
  parallel(ids) {
    const linePairIds = this.getLinePairIds(ids);
    if (linePairIds === null) return null;
    return /** @type {ParallelConstraint} */ (this.#createConstraint('parallel', linePairIds, null));
  }

  /**
   * @param {[LineConstructionElement, LineConstructionElement] | [number, number, number, number]} ids
   * @returns {Readonly<PerpendicularConstraint>?}
   */
  perpendicular(ids) {
    const linePairIds = this.getLinePairIds(ids);
    if (linePairIds === null) return null;
    return /** @type {PerpendicularConstraint} */ (this.#createConstraint('perpendicular', linePairIds, null));
  }

  /**
   * @param {number} lineId
   * @returns {LineConstructionElement?}
   */
  getLine(lineId) {
    if (!this.hasLine(lineId)) return null;
    return this.data.elements[lineId - this.lastLineId - 1] ?? null;
  }

  /**
   * @param {LineConstructionElement} line
   * @returns {number?}
   */
  getLineId(line) {
    const elementIndex = this.data.elements.indexOf(line);
    if (elementIndex === -1) return null;
    return this.lastLineId + elementIndex + 1;
  }

  /**
   * @param {LineConstructionElement} line
   * @returns {[number, number]?}
   */
  getLineIds(line) {
    const index = this.data.elements.indexOf(line);
    if (index === -1) return null;

    const ids = this.pointInfo.filter(info => info.elementIndex === index).map(info => info.id);
    if (ids.length !== 2) return null;

    return /** @type {[number, number]} */ (ids);
  }

  /**
   * @param {[LineConstructionElement, LineConstructionElement] | [number, number, number, number]} ids
   * @returns {[number, number, number, number]?}
   */
  getLinePairIds(ids) {
    if (ids.length === 2) {
      if (ids[0] === ids[1] || ids.some(line => !this.data.elements.includes(line))) return null;

      const i1 = this.getLineIds(ids[0]);
      const i2 = this.getLineIds(ids[1]);
      if (!i1 || !i2) return null;

      ids = [...i1, ...i2];
    } else {
      if (ids.some((v, i, a) => a.indexOf(v) !== i)) return null;

      const lines = ids.map(index => this.getLineForPoint(index)?.[0]);
      if (lines.some(v => v === null)) return null;
      if (lines[0] !== lines[1] || lines[1] === lines[2] || lines[2] !== lines[3]) return null;
    }

    return ids.length === 4 ? ids : null;
  }

  /**
   * @param {number} pointId
   * @returns {[LineConstructionElement, number]?}
   */
  getLineForPoint(pointId) {
    const elementInfo = this.getPointInfo(pointId);
    if (!elementInfo) return null;

    return [elementInfo.element, elementInfo.offset];
  }

  /**
   * @param {number} pointId
   * @returns {PointInfo?}
   */
  getPointInfo(pointId) {
    switch (pointId) {
      case -1: return originPoint;
      case -2: return xAxisPoint1;
      case -3: return xAxisPoint2;
      case -4: return yAxisPoint1;
      case -5: return yAxisPoint2;
    }
    return this.pointInfo.find(info => info.id === pointId) ?? null;
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
    const indices = this.getPoints(element).map(info => info.id);
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
    const pointIndices = this.getPoints(element).map(point => point.id);
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
   * @param {number} lineId
   * @returns {boolean}
   */
  hasLine(lineId) {
    return lineId > this.lastLineId && lineId <= this.model.lastLineId;
  }

  /**
   * @param {number} pointId
   * @returns {boolean}
   */
  hasPoint(pointId) {
    return pointId > this.lastPointId && pointId <= this.model.lastPointId;
  }

  exitStep() {
    const { scene } = this.engine;

    if (scene.currentStep === this && !Sketch.#cancellableTask.drop()) {
      super.exitStep();
    }
  }
}
