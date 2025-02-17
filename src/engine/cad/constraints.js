const { glMatrix: { equals }, vec2 } = glMatrix;

/**
 * @template {string} T
 * @template {number} I
 * @template {import("../general/state.js").Value} [D=null]
 * @typedef Constraint
 * @property {T} type
 * @property {Tuple<number, I>} indices
 * @property {D} data
 */

/** @typedef {Constraint<"distance", 2, number>} DistanceConstraint */
/** @typedef {Constraint<"width", 2, number>} WidthConstraint */
/** @typedef {Constraint<"height", 2, number>} HeightConstraint */
/** @typedef {Constraint<"coincident", 2>} CoincidentConstraint */
/** @typedef {Constraint<"horizontal", 2>} HorizontalConstraint */
/** @typedef {Constraint<"vertical", 2>} VerticalConstraint */
/** @typedef {Constraint<"equal", 4, null>} EqualConstraint */

/** @typedef {DistanceConstraint|WidthConstraint|HeightConstraint|EqualConstraint} DistanceConstraints */
/** @typedef {HorizontalConstraint|VerticalConstraint} OrientationConstraints */
/** @typedef {DistanceConstraints|CoincidentConstraint|OrientationConstraints} Constraints */

/** @typedef {{ [K in Constraints["type"]]: Find<Constraints, "type", K>["data"] }} OriginalCurrentData */
/** @typedef {{ equal: [number, number ]}} CustomCurrentData */

/**
 * @template {keyof OriginalCurrentData} K
 * @typedef {(Omit<OriginalCurrentData, keyof CustomCurrentData> & CustomCurrentData)[K]} CurrentData
 */

/**
 * @template {Constraints} C
 * @typedef ConstraintData
 * @property {Tuple<import("./sketch.js").PointInfo, C["indices"]["length"]>} elements
 * @property {number} incrementScale
 * @property {C["data"]} value
 */

/**
 * @template {Constraints} C
 * @typedef {(data: ConstraintData<C>) => [CurrentData<C["type"]>, boolean]} CheckFn
 */

/**
 * @template {Constraints} C
 * @typedef {(data: ConstraintData<C>, current: CurrentData<C["type"]>) => void} ApplyFn
 */

/**
 * @template {Constraints} C
 * @template S
 * @typedef ConstraintHandler
 * @property {CheckFn<C>} check
 * @property {ApplyFn<C>} apply
 */

// cached structures
const tempVec2 = vec2.create();

/**
 * @template {{ [K in Constraints["type"]]: any }} T
 * @type {{ [K in Constraints["type"]]: ConstraintHandler<Find<Constraints, "type", K>, T[K]> }}
 */
export default {
  distance: {
    check({ elements: [p1, p2], value }) {
      const current = vec2.distance(p1.vec2, p2.vec2);
      return [current, equals(current, value)];
    },
    apply({ elements: [p1, p2], incrementScale, value }, distance) {
      vec2.subtract(tempVec2, p1.vec2, p2.vec2);
      vec2.normalize(tempVec2, tempVec2);
      vec2.scale(tempVec2, tempVec2, (value - distance) * incrementScale);

      if (!p1.locked) vec2.add(p1.vec2, p1.vec2, tempVec2);
      if (!p2.locked) vec2.subtract(p2.vec2, p2.vec2, tempVec2);
    },
  },
  width: {
    check({ elements: [p1, p2], value }) {
      const current = Math.abs(p1.vec2[0] - p2.vec2[0]);
      return [current, equals(current, value)];
    },
    apply({ elements: [p1, p2], incrementScale, value }, distance) {
      const diff = (value - distance) * incrementScale * (p1.vec2[0] < p2.vec2[0] ? -1 : 1);

      if (!p1.locked) p1.vec2[0] += diff;
      if (!p2.locked) p2.vec2[0] -= diff;
    },
  },
  height: {
    check({ elements: [p1, p2], value }) {
      const current = Math.abs(p1.vec2[1] - p2.vec2[1]);
      return [current, equals(current, value)];
    },
    apply({ elements: [p1, p2], incrementScale, value }, distance) {
      const diff = (value - distance) * incrementScale * (p1.vec2[1] < p2.vec2[1] ? -1 : 1);

      if (!p1.locked) p1.vec2[1] += diff;
      if (!p2.locked) p2.vec2[1] -= diff;
    },
  },
  coincident: {
    check({ elements: [p1, p2] }) {
      return [null, vec2.equals(p1.vec2, p2.vec2)];
    },
    apply({ elements: [p1, p2], incrementScale }) {
      vec2.subtract(tempVec2, p1.vec2, p2.vec2);
      vec2.scale(tempVec2, tempVec2, incrementScale);

      if (!p1.locked) vec2.subtract(p1.vec2, p1.vec2, tempVec2);
      if (!p2.locked) vec2.add(p2.vec2, p2.vec2, tempVec2);
    },
  },
  horizontal: {
    check({ elements: [p1, p2] }) {
      return [null, equals(p1.vec2[1], p2.vec2[1])];
    },
    apply({ elements: [p1, p2], incrementScale }) {
      const diff = (p1.vec2[1] - p2.vec2[1]) * incrementScale;

      if (!p1.locked) p1.vec2[1] -= diff;
      if (!p2.locked) p2.vec2[1] += diff;
    },
  },
  vertical: {
    check({ elements: [p1, p2] }) {
      return [null, equals(p1.vec2[0], p2.vec2[0])];
    },
    apply({ elements: [p1, p2], incrementScale }) {
      const diff = (p1.vec2[0] - p2.vec2[0]) * incrementScale;

      if (!p1.locked) p1.vec2[0] -= diff;
      if (!p2.locked) p2.vec2[0] += diff;
    },
  },
  equal: {
    check({ elements: [p1, p2, p3, p4] }) {
      const distance1 = vec2.distance(p1.vec2, p2.vec2);
      const distance2 = vec2.distance(p3.vec2, p4.vec2);
      return [[distance1, distance2], equals(distance1, distance2)];
    },
    apply({ elements: [p1, p2, p3, p4], incrementScale }, [distance1, distance2]) {
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
  },
};
