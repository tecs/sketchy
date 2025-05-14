const { glMatrix: { equals }, vec2 } = glMatrix;

/**
 * @template {string} T
 * @template {number} I
 * @typedef Constraint
 * @property {T} type
 * @property {Tuple<number, I>} indices
 * @property {null} data
 */

/**
 * @template {string} T
 * @template {number} I
 * @typedef MovableConstraint
 * @property {T} type
 * @property {Tuple<number, I>} indices
 * @property {number} data
 * @property {string} formula
 * @property {PlainVec2} labelOffset
 */

/** @typedef {MovableConstraint<"distance", 2>} DistanceConstraint */
/** @typedef {MovableConstraint<"width", 2>} WidthConstraint */
/** @typedef {MovableConstraint<"height", 2>} HeightConstraint */
/** @typedef {Constraint<"coincident", 2>} CoincidentConstraint */
/** @typedef {Constraint<"horizontal", 2>} HorizontalConstraint */
/** @typedef {Constraint<"vertical", 2>} VerticalConstraint */
/** @typedef {Constraint<"equal", 4>} EqualConstraint */
/** @typedef {MovableConstraint<"angle", 4>} AngleConstraint */
/** @typedef {Constraint<"parallel", 4>} ParallelConstraint */
/** @typedef {Constraint<"perpendicular", 4>} PerpendicularConstraint */

/** @typedef {DistanceConstraint|WidthConstraint|HeightConstraint|EqualConstraint} DistanceConstraints */
/** @typedef {HorizontalConstraint|VerticalConstraint} AxisConstraints */
/** @typedef {AxisConstraints|AngleConstraint|ParallelConstraint|PerpendicularConstraint} OrientationConstraints */
/** @typedef {DistanceConstraints|CoincidentConstraint|OrientationConstraints} Constraints */

/** @typedef {{ [K in Constraints["type"]]: Find<Constraints, "type", K>["data"] }} OriginalCurrentData */
/**
 * @typedef CustomCurrentData
 * @property {[number, number]} equal
 * @property {[number, number]} parallel
 * @property {[number, number]} perpendicular
 */

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
const constraints = {
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
  angle: {
    check({ elements: [p1, p2, p3, p4], value }) {
      vec2.subtract(tempVec2, p2.vec2, p1.vec2);
      const angle1 = Math.atan2(tempVec2[1], tempVec2[0]);

      vec2.subtract(tempVec2, p4.vec2, p3.vec2);
      const angle2 = Math.atan2(tempVec2[1], tempVec2[0]);

      let angle = angle2 - angle1;
      if (angle < 0) angle += Math.PI * 2;

      return [angle, equals(value, angle)];
    },
    apply({ elements: [p1, p2, p3, p4], incrementScale, value }, angle) {
      const diff = (angle - value) * incrementScale;

      if (!p1.locked && !p2.locked) {
        vec2.add(tempVec2, p1.vec2, p2.vec2);
        vec2.scale(tempVec2, tempVec2, 0.5);
        vec2.rotate(p1.vec2, p1.vec2, tempVec2, diff);
        vec2.rotate(p2.vec2, p2.vec2, tempVec2, diff);
      }
      else if (!p1.locked) vec2.rotate(p1.vec2, p1.vec2, p2.vec2, diff);
      else if (!p2.locked) vec2.rotate(p2.vec2, p2.vec2, p1.vec2, diff);

      if (!p3.locked && !p4.locked) {
        vec2.add(tempVec2, p3.vec2, p4.vec2);
        vec2.scale(tempVec2, tempVec2, 0.5);
        vec2.rotate(p3.vec2, p3.vec2, tempVec2, -diff);
        vec2.rotate(p4.vec2, p4.vec2, tempVec2, -diff);
      }
      else if (!p3.locked) vec2.rotate(p3.vec2, p3.vec2, p4.vec2, -diff);
      else if (!p4.locked) vec2.rotate(p4.vec2, p4.vec2, p3.vec2, -diff);
    },
  },
  parallel: {
    check({ elements: [p1, p2, p3, p4] }) {
      vec2.subtract(tempVec2, p2.vec2, p1.vec2);
      const angle1 = Math.atan2(tempVec2[1], tempVec2[0]);

      vec2.subtract(tempVec2, p4.vec2, p3.vec2);
      const angle2 = Math.atan2(tempVec2[1], tempVec2[0]);

      let angle = angle2 - angle1;
      if (angle < 0) angle += Math.PI * 2;
      const value = angle < Math.PI * 0.5 || angle > Math.PI * 1.5 ? 0 : Math.PI;

      return [[value, angle], equals(value, angle)];
    },
    apply({ elements: [p1, p2, p3, p4], incrementScale }, [value, angle]) {
      constraints.angle.apply({ elements: [p1, p2, p3, p4], incrementScale, value }, angle);
    },
  },
  perpendicular: {
    check({ elements: [p1, p2, p3, p4] }) {
      vec2.subtract(tempVec2, p2.vec2, p1.vec2);
      const angle1 = Math.atan2(tempVec2[1], tempVec2[0]);

      vec2.subtract(tempVec2, p4.vec2, p3.vec2);
      const angle2 = Math.atan2(tempVec2[1], tempVec2[0]);

      let angle = angle2 - angle1;
      if (angle < 0) angle += Math.PI * 2;
      const value = angle < Math.PI ? Math.PI * 0.5 : Math.PI * 1.5;

      return [[value, angle], equals(value, angle)];
    },
    apply({ elements: [p1, p2, p3, p4], incrementScale }, [value, angle]) {
      constraints.angle.apply({ elements: [p1, p2, p3, p4], incrementScale, value }, angle);
    },
  },
};

export default constraints;
