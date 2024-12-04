const { glMatrix: { equals }, vec2 } = glMatrix;

/** @typedef {[i1: number, i2: number, angle: number]} Line */
/** @typedef {[indices: number[], vertices: number[]]} Face */
/**
 * @typedef Loop
 * @property {number[]} indices
 * @property {Line[]} lines
 */
/**
 * @typedef Triangulation
 * @property {number[]} meshIndices
 * @property {Loop} loop
 * @property {Bucket[]} descendentBuckets
 */
/**
 * @typedef Bucket
 * @property {Triangulation[]} triangulations
 * @property {number[]} outline
 */

const twoPI = Math.PI * 2;

/**
 * @param {vec2 | PlainVec2} v1
 * @param {vec2 | PlainVec2} v2
 * @returns {number}
 */
const cross = (v1, v2) => v1[0] * v2[1] - v1[1] * v2[0];

/**
 * @param {number} i
 * @param {number} l
 * @returns {number}
 */
// eslint-disable-next-line no-nested-ternary
const wrap = (i, l) => (i < 0 ? l + i : (i < l ? i : i - l));

/**
 * @param {Readonly<ArrayLike<number>>} vertices
 * @param {Readonly<number[]>} sortedIndices
 * @param {number[]} loop
 * @param {number[][]} holeLoops
 * @returns {number[]}
 */
const earClip = (vertices, sortedIndices, loop, holeLoops) => {
  const polygons = /** @type {number[]} */ ([]);

  /** @type {() => { index: number, hole: number }[]} */
  const makeSortedIndices = () => sortedIndices.reduce((sorted, idx) => {
    const iLoop = loop.indexOf(idx);
    if (iLoop > -1) {
      sorted.push({ index: iLoop, hole: -1 });
      return sorted;
    }

    for (let i = 0; i < holeLoops.length; ++i) {
      const iHole = holeLoops[i].indexOf(idx);
      if (iHole > -1) {
        sorted.push({ index: iHole, hole: i });
        return sorted;
      }
    }

    return sorted;
  }, /** @type {ReturnType<typeof makeSortedIndices>} */ ([]));

  let iSortedIndices = makeSortedIndices();

  main: while (loop.length > 3) {
    const iCurrent = iSortedIndices[0].index;

    const current = loop[iCurrent];

    const iPrev = wrap(iCurrent - 1, loop.length);
    const iNext = wrap(iCurrent + 1, loop.length);

    const prev = loop[iPrev];
    const next = loop[iNext];

    const xc = vertices[current * 2];
    const yc = vertices[current * 2 + 1];
    const xp = vertices[prev * 2];
    const yp = vertices[prev * 2 + 1];
    const xn = vertices[next * 2];
    const yn = vertices[next * 2 + 1];

    // ignore tangent points
    if (xc === xp && xc === xn) {
      loop.splice(iCurrent, 1);
      iSortedIndices = makeSortedIndices();
      continue;
    }

    for (let i = 1; i < iSortedIndices.length; ++i) {
      const hole = iSortedIndices[i].hole;
      const isHole = hole > -1;
      const iTest = iSortedIndices[i].index;
      const test = isHole ? holeLoops[hole][iTest] : loop[iTest];

      const xt = vertices[test * 2];
      if (test === prev || test === next) continue;
      if (xt > xp && xt > xn) break;

      const yt = vertices[test * 2 + 1];

      const s = (xc - xn) * (yt - yn) - (yc - yn) * (xt - xn);
      const t = (xp - xc) * (yt - yc) - (yp - yc) * (xt - xc);

      if ((s < 0) !== (t < 0) && s !== 0 && t !== 0) continue;

      const d = (xn - xp) * (yt - yp) - (yn - yp) * (xt - xp);

      if (d === 0 || (d < 0) === (s + t <= 0)) {
        if (isHole) {
          const [holeLoop] = holeLoops.splice(hole, 1);
          loop.splice(iNext, 0, ...holeLoop.slice(iTest), ...holeLoop.slice(0, iTest + 1), current);
          iSortedIndices = makeSortedIndices();

          continue main;
        }

        const length = Math.abs(iTest - iCurrent);
        const iFrom = iTest > iCurrent ? iCurrent : iTest;

        const nonMonotoneLoop = loop.slice(iFrom, iFrom + length + 1);

        polygons.push(
          ...earClip(
            vertices,
            sortedIndices,
            nonMonotoneLoop,
            holeLoops,
          ),
        );
        loop.splice(iFrom + 1, length - 1);
        iSortedIndices = makeSortedIndices();

        continue main;
      }
    }

    polygons.push(current, prev, next);
    loop.splice(iCurrent, 1);
    iSortedIndices = makeSortedIndices();
  }

  polygons.push(...loop);

  return polygons;
};

/**
 * @param {Readonly<number[]>} vertices
 * @param {Readonly<number[]>} indices A-B-C-D-...
 * @param {Readonly<number[]>[]} holesIndices (A-B-C-D-...)[]
 * @returns {number[]}
 */
const triangulateFace = (vertices, indices, holesIndices = []) => {
  const sortedIndices = [...indices].concat(holesIndices.flatMap(hole => [...hole]))
    .sort((a, b) => vertices[a * 2] - vertices[b * 2]);

  const loop = [sortedIndices[0]];

  const indexSplit = indices.indexOf(loop[0]);
  loop.push(
    ...indices.slice(indexSplit + 1, indices.length),
    ...indices.slice(0, indexSplit),
  );

  const holeLoops = holesIndices.map(holeIndices => {
    const holeStartIndex = sortedIndices.findIndex(idx => holeIndices.includes(idx));
    return [
      ...holeIndices.slice(holeStartIndex, holeIndices.length),
      ...holeIndices.slice(0, holeStartIndex),
    ];
  });

  return earClip(vertices, sortedIndices, loop, holeLoops);
};

/**
 * @param {Line[]} lines
 */
const removeDangling = (lines) => {
  // remove lines with unconnected nodes
  let hasDangling = true;
  while (hasDangling) {
    hasDangling = false;
    for (let i = lines.length - 1; i >= 0; --i) {
      const [idx1, idx2] = lines[i];
      let found1 = false;
      let found2 = false;
      for (let k = 0; k < lines.length && !(found1 && found2); ++k) {
        if (i === k) continue;
        const [idx1_, idx2_] = lines[k];
        found1 ||= idx1_ === idx1 || idx2_ === idx1;
        found2 ||= idx1_ === idx2 || idx2_ === idx2;
      }
      if (!found1 || !found2) {
        hasDangling = true;
        lines.splice(i, 1);
      }
    }
  }
};

/**
 * @param {Line[]} lines
 * @param {PlainVec2[]} vertices
 */
const intersect = (lines, vertices) => {
  const l1Coord = vec2.create();
  const l2Coord = vec2.create();
  const l1Offset = vec2.create();
  const l2Offset = vec2.create();
  const diff = vec2.create();

  for (let i = 0; i < lines.length - 1; ++i) {
    const line1 = lines[i];

    let recalculateL1 = true;

    for (let k = i + 1; k < lines.length; ++k) {
      if (recalculateL1) {
        vec2.set(l1Coord, ...vertices[line1[0]]);
        vec2.set(l1Offset, ...vertices[line1[1]]);
        vec2.subtract(l1Offset, l1Offset, l1Coord);
        recalculateL1 = false;
      }

      const line2 = lines[k];
      vec2.set(l2Coord, ...vertices[line2[0]]);
      vec2.set(l2Offset, ...vertices[line2[1]]);
      vec2.subtract(l2Offset, l2Offset, l2Coord);

      vec2.subtract(diff, l2Coord, l1Coord);

      const cross1 = cross(l1Offset, l2Offset);
      const cross2 = cross(diff, l2Offset);

      // parallel
      if (equals(cross1, 0)) {
        // check if colinear
        if (!equals(cross2, 0)) continue;

        const dot = vec2.dot(l1Offset, l1Offset);
        const t0 = vec2.dot(diff, l1Offset) / dot;
        const t1 = t0 + vec2.dot(l2Offset, l1Offset) / dot;

        // check if overlaps
        if (t1 <= 0 || t0 >= 1) continue;

        // check if duplicate
        if (t0 === 0 && t1 === 1) {
          lines.splice(k--, 1);
          continue;
        }

        // lines have coincident endpoints
        if (t0 === 0 || t1 === 1) {
          const innerLine = t0 > 0 || t1 < 1 ? line2 : line1;
          const outerLine = innerLine === line1 ? line2 : line1;
          outerLine[t0 === 0 ? 0 : 1] = innerLine[t0 === 0 ? 1 : 0];
          recalculateL1 = outerLine === line1;
          continue;
        }

        // one line is inside the other
        if ((t0 > 0 && t1 < 1) || (t0 < 0 && t1 > 1)) {
          const innerLine = t0 > 0 ? line2 : line1;
          const outerLine = innerLine === line1 ? line2 : line1;
          lines.push([innerLine[1], outerLine[1], outerLine[2]]);
          outerLine[1] = innerLine[0];
          recalculateL1 = outerLine === line1;
          continue;
        }

        // lines overlap on one side
        const leftLine = t0 < 0 ? line2 : line1;
        const rightLine = leftLine === line1 ? line2 : line1;
        const index = leftLine[1];
        lines.push([rightLine[0], index, leftLine[2]]);
        leftLine[1] = rightLine[0];
        rightLine[0] = index;
        recalculateL1 = true;
        continue;
      }

      const l1scale = cross2 / cross1;
      const l2scale = cross(diff, l1Offset) / cross1;

      // check if intersects
      const touches1 = l1scale > 0 && l1scale < 1;
      const touches2 = l2scale > 0 && l2scale < 1;
      if (!touches1 || !touches2) continue;

      // one line's endpoint is within the other line
      if (touches1 !== touches2) {
        const intersectedLine = touches1 ? line1 : line2;
        const otherLine = touches1 ? line2 : line1;
        const index = otherLine[l1scale === 0 || l2scale === 0 ? 0 : 1];
        lines.push([intersectedLine[1], index, intersectedLine[2]]);
        intersectedLine[1] = index;
        recalculateL1 = intersectedLine === line1;
        continue;
      }

      // lines cross
      // calculate and add intersection to vertices
      vec2.scaleAndAdd(l1Offset, l1Coord, l1Offset, l1scale);
      let index = vertices.findIndex(([x, y]) => equals(x, l1Offset[0]) && equals(y, l1Offset[1]));
      if (index === -1) {
        index = vertices.length;
        vertices.push([l1Offset[0], l1Offset[1]]);
      }
      recalculateL1 = true;

      lines.push([index, line1[1], line1[2]]);
      line1[1] = index;

      lines.push([index, line2[1], line2[2]]);
      line2[1] = index;
    }
  }
};

/**
 * @param {Readonly<PlainVec2[]>} uniquePoints
 * @param {boolean} clockwise
 * @returns {(a: Line, b: Line) => number}
 */
const lineSorter = (uniquePoints, clockwise = false) => {
  return ([i1,, a1], [i2,, a2]) => {
    const [x1, y1] = uniquePoints[i1];
    const [x2, y2] = uniquePoints[i2];
    if (x1 !== x2) return x1 - x2;
    if (y1 !== y2) return y2 - y1;
    if (((a1 > Math.PI && a2 > Math.PI) || (a1 < Math.PI && a2 < Math.PI)) !== clockwise) return a1 - a2;
    return a2 - a1;
  };
};

/**
 * @param {Readonly<Line[]>} lines
 * @param {boolean} outline
 * @returns {Loop[]}
 */
const findLoops = (lines, outline = false) => {
  const remaining = lines.slice();
  const closedLoops = /** @type {Loop[]} */ ([]);

  while (true) {
    removeDangling(remaining);

    const startingLine = remaining.shift();
    if (!startingLine) break;

    const current = [startingLine];
    let nextIndex = startingLine[1];
    let skipLine = /** @type {Line?} */ (null);

    while (true) {
      const currentLine = current[current.length - 1];
      let currentLineAngle = currentLine[2];
      if (currentLine[1] === nextIndex) {
        currentLineAngle += currentLineAngle < Math.PI ? Math.PI : -Math.PI;
      }

      const candidates = /** @type {[line: Line, diff: number][]} */ ([]);

      for (const line of remaining) {
        const connectedIdx = line[0] === nextIndex ? 0 : 1;
        if (line[connectedIdx] !== nextIndex || current.includes(line)) continue;

        let angle = line[2];
        if (connectedIdx === 1) {
          angle += angle < Math.PI ? Math.PI : -Math.PI;
        }
        const diff = (currentLineAngle >= angle ? 0 : twoPI) + currentLineAngle - angle;
        candidates.push([line, diff]);
      }

      const sortedCandidates = candidates.sort(([, a], [, b]) => a - b);
      const nextCandidateIndex = sortedCandidates.findIndex(([line]) => line === skipLine) + 1;
      const [nextLine] = sortedCandidates.at(nextCandidateIndex) ?? [];

      if (!nextLine) {
        current.pop();
        if (current.length === 0) break;

        skipLine = currentLine;
        continue;
      }

      current.push(nextLine);
      skipLine = null;

      nextIndex = nextLine[0] === nextIndex ? nextLine[1] : nextLine[0];
      const connectedIndex = current.slice(0, -2).findIndex(([i1, i2]) => i1 === nextIndex || i2 === nextIndex);

      if (connectedIndex === -1) continue;
      if (connectedIndex !== 0) break;

      const closed = [nextIndex];
      for (let i = 0; i < current.length; ++i) {
        const line = current[i];
        const index = closed[closed.length - 1] === line[0] ? line[1] : line[0];
        if (index !== nextIndex) closed.push(index);
      }
      closedLoops.push({ indices: closed, lines: current });

      if (outline) {
        return closedLoops;
      }

      break;
    }
  }

  return closedLoops;
};

/**
 * @param {Triangulation[]} triangulations
 * @param {PlainVec2[]} uniqueVertices
 */
const setHoles = (triangulations, uniqueVertices) => {
  const flatVertices = uniqueVertices.flat();

  const loopBuckets = /** @type {Bucket[]} */ ([]);
  const remainingLoops = triangulations.slice();

  // group touching loops into buckets
  while (true) {
    const initialLoop = remainingLoops.pop();
    if (!initialLoop) break;

    const bucket = /** @type {Bucket} */ ({ triangulations: [initialLoop], outline: [] });
    const remainingIndices = initialLoop.loop.indices.slice();

    while (true) {
      const index = remainingIndices.pop();
      if (index === undefined) break;

      for (let i = remainingLoops.length - 1; i >= 0; --i) {
        const otherLoop = remainingLoops[i];
        if (!otherLoop.loop.indices.includes(index)) continue;

        remainingLoops.splice(i, 1);
        bucket.triangulations.push(otherLoop);
        for (const otherIndex of otherLoop.loop.indices) {
          if (otherIndex !== index && !remainingIndices.includes(otherIndex)) {
            remainingIndices.push(otherIndex);
          }
        }
      }
    }

    loopBuckets.push(bucket);
  }

  if (loopBuckets.length < 2) return;

  const t = vec2.create();
  const v1 = vec2.create();
  const v2 = vec2.create();
  const v3 = vec2.create();
  const vv = vec2.create();
  const vt = vec2.create();
  let hasHoles = false;

  // check if a random vertex from a bucket is inside any other bucket's loop
  // if so, that first bucket's whole outline is inside the loop
  for (let i = 0; i < loopBuckets.length - 1; ++i) {
    for (let k = i + 1; k < loopBuckets.length; ++k) {
      pairCheck:
      for (const [bucket1, bucket2] of [[loopBuckets[i], loopBuckets[k]], [loopBuckets[k], loopBuckets[i]]]) {
        vec2.set(t, ...uniqueVertices[bucket1.triangulations[0].loop.indices[0]]);
        for (const { meshIndices: indices, descendentBuckets: descendents } of bucket2.triangulations) {
          for (let ii = 0; ii < indices.length; ii += 3) {
            vec2.set(v1, ...uniqueVertices[indices[ii]]);
            vec2.set(v2, ...uniqueVertices[indices[ii + 1]]);
            vec2.set(v3, ...uniqueVertices[indices[ii + 2]]);

            vec2.subtract(vv, v2, v1);
            vec2.subtract(vt, t, v1);
            const crossSign1 = Math.sign(cross(vt, vv));

            vec2.subtract(vv, v3, v2);
            vec2.subtract(vt, t, v2);
            const crossSign2 = Math.sign(cross(vt, vv));

            if (crossSign1 !== crossSign2) continue;

            vec2.subtract(vv, v1, v3);
            vec2.subtract(vt, t, v3);
            const crossSign3 = Math.sign(cross(vt, vv));

            if (crossSign2 !== crossSign3) continue;

            descendents.push(bucket1);
            hasHoles = true;
            break pairCheck;
          }
        }
      }
    }
  }

  if (!hasHoles) return;

  // cleanup the buckets' descendents so they become a directed graph
  for (const bucket1 of loopBuckets) {
    const descendents = bucket1.triangulations.flatMap(loop => loop.descendentBuckets);
    for (const bucket2 of loopBuckets) {
      if (bucket1 === bucket2) continue;
      for (const loop of bucket2.triangulations) {
        if (loop.descendentBuckets.includes(bucket1)) {
          for (const descendent of descendents) {
            const index = loop.descendentBuckets.indexOf(descendent);
            if (index !== -1) loop.descendentBuckets.splice(index, 1);
          }
          break;
        }
      }
    }
  }

  const cwLineSorter = lineSorter(uniqueVertices, true);

  // re-triangulate loops with descendents, using their outlines as holes
  for (const loop of triangulations) {
    if (loop.descendentBuckets.length === 0) continue;

    for (const bucket of loop.descendentBuckets) {
      if (bucket.outline.length === 0) {
        const uniqueLines = bucket.triangulations
          .flatMap(({ loop: { lines } }) => lines)
          .filter((v, i, a) => a.indexOf(v) === i)
          .sort(cwLineSorter);
        bucket.outline = findLoops(uniqueLines, true).pop()?.indices ?? [];
      }
    }

    const holes = loop.descendentBuckets.map(({ outline }) => outline);
    loop.meshIndices = triangulateFace(flatVertices, loop.loop.indices, holes);
  }
};

/**
 * @param {Readonly<number[]>} vertices
 * @param {Readonly<number[]>} lineIndices A-B,B-C,C-D,...
 * @returns {Face[]}
 */
export default (vertices, lineIndices) => {
  const lines = /** @type {Line[]} */ ([]);
  const uniquePoints = /** @type {PlainVec2[]} */ ([]);

  // remove duplicate and zero-length lines and duplicate vertices
  for (let i = 1; i < lineIndices.length; i += 2) {
    const x1 = vertices[lineIndices[i - 1] * 2];
    const y1 = vertices[lineIndices[i - 1] * 2 + 1];
    const x2 = vertices[lineIndices[i] * 2];
    const y2 = vertices[lineIndices[i] * 2 + 1];

    let i1 = uniquePoints.findIndex(([x, y]) => equals(x, x1) && equals(y, y1));
    if (i1 === -1) {
      i1 = uniquePoints.length;
      uniquePoints.push([x1, y1]);
    }

    let i2 = uniquePoints.findIndex(([x, y]) => equals(x, x2) && equals(y, y2));
    if (i2 === -1) {
      i2 = uniquePoints.length;
      uniquePoints.push([x2, y2]);
    }

    if (i1 === i2) continue;
    const [xx1, yy1] = uniquePoints[i1];
    const [xx2, yy2] = uniquePoints[i2];

    const low = xx1 < xx2 || (xx1 === xx2 && yy1 > yy2) ? i1 : i2;
    const high = low === i1 ? i2 : i1;
    if (lines.some(line => line[0] === low && line[1] === high)) continue;

    const x = uniquePoints[high][0] - uniquePoints[low][0];
    const y = uniquePoints[high][1] - uniquePoints[low][1];
    const angle = Math.atan(y / x);
    lines.push([low, high, angle + (angle < 0 ? twoPI : 0)]);
  }

  intersect(lines, uniquePoints);

  lines.sort(lineSorter(uniquePoints));

  const loops = findLoops(lines);

  const triangulations = /** @type {Triangulation[]} */ ([]);

  const flatVertices = uniquePoints.flat();
  for (const loop of loops) {
    triangulations.push({
      meshIndices: triangulateFace(flatVertices, loop.indices),
      loop,
      descendentBuckets: [],
    });
  }

  setHoles(triangulations, uniquePoints);

  const faces = /** @type {Face[]} */ ([]);
  let startingIndex = 0;
  for (const { meshIndices } of triangulations) {
    const face = /** @type {Face} */ ([[], []]);
    const indexMap = /** @type {number[]} */ ([]);
    for (const index of meshIndices) {
      let newIndex = indexMap.indexOf(index);
      if (newIndex === -1) {
        newIndex = indexMap.length;
        indexMap.push(index);
        face[1].push(...uniquePoints[index]);
      }
      face[0].push(newIndex + startingIndex);
    }
    faces.push(face);
    startingIndex += indexMap.length;
  }

  return faces;
};
