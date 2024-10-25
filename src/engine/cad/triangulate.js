const { glMatrix: { equals }} = glMatrix;

/** @typedef {[i1: number, i2: number, angle: number]} Line */

const twoPI = Math.PI * 2;

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
 * @returns {number[]}
 */
const earClip = (vertices, sortedIndices, loop) => {
  const polygons = /** @type {number[]} */ ([]);

  /** @type {() => number[]} */
  const makeSortedIndices = () => sortedIndices.reduce((sorted, idx) => {
    const iLoop = loop.indexOf(idx);
    if (iLoop > -1) sorted.push(iLoop);
    return sorted;
  }, /** @type {number[]} */ ([]));

  let iSortedIndices = makeSortedIndices();

  main: while (loop.length > 3) {
    const iCurrent = iSortedIndices[0];

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
      const iTest = iSortedIndices[i];
      const test = loop[iTest];

      const xt = vertices[test * 2];
      if (test === prev || test === next) continue;
      if (xt > xp && xt > xn) break;

      const yt = vertices[test * 2 + 1];

      const s = (xc - xn) * (yt - yn) - (yc - yn) * (xt - xn);
      const t = (xp - xc) * (yt - yc) - (yp - yc) * (xt - xc);

      if ((s < 0) !== (t < 0) && s !== 0 && t !== 0) continue;

      const d = (xn - xp) * (yt - yp) - (yn - yp) * (xt - xp);

      if (d === 0 || (d < 0) === (s + t <= 0)) {
        const length = Math.abs(iTest - iCurrent);
        const iFrom = iTest > iCurrent ? iCurrent : iTest;

        const nonMonotoneLoop = loop.slice(iFrom, iFrom + length + 1);

        polygons.push(
          ...earClip(
            vertices,
            sortedIndices,
            nonMonotoneLoop,
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
 * @returns {number[]}
 */
const triangulateFace = (vertices, indices) => {
  const sortedIndices = [...indices].sort((a, b) => vertices[a * 2] - vertices[b * 2]);

  const loop = [sortedIndices[0]];

  const indexSplit = indices.indexOf(loop[0]);
  loop.push(
    ...indices.slice(indexSplit + 1, indices.length),
    ...indices.slice(0, indexSplit),
  );

  return earClip(vertices, sortedIndices, loop);
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
 * @param {Readonly<Line[]>} lines
 * @returns {number[][]}
 */
const findLoops = (lines) => {
  const remaining = lines.slice();
  const closedLoops = /** @type {number[][]} */ ([]);

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
      closedLoops.push(closed);

      break;
    }
  }

  return closedLoops;
};

/**
 * @param {Readonly<number[]>} vertices
 * @param {Readonly<number[]>} lineIndices A-B,B-C,C-D,...
 * @returns {[indices: number[], vertices: number[]]}
 */
export default (vertices, lineIndices) => {
  const lines = /** @type {Line[]} */ ([]);
  const uniqueVertices = /** @type {PlainVec2[]} */ ([]);

  // remove duplicate and zero-length lines and duplicate vertices
  for (let i = 1; i < lineIndices.length; i += 2) {
    const x1 = vertices[lineIndices[i - 1] * 2];
    const y1 = vertices[lineIndices[i - 1] * 2 + 1];
    const x2 = vertices[lineIndices[i] * 2];
    const y2 = vertices[lineIndices[i] * 2 + 1];

    let i1 = uniqueVertices.findIndex(([x, y]) => equals(x, x1) && equals(y, y1));
    if (i1 === -1) {
      i1 = uniqueVertices.length;
      uniqueVertices.push([x1, y1]);
    }

    let i2 = uniqueVertices.findIndex(([x, y]) => equals(x, x2) && equals(y, y2));
    if (i2 === -1) {
      i2 = uniqueVertices.length;
      uniqueVertices.push([x2, y2]);
    }

    if (i1 === i2) continue;
    const [xx1, yy1] = uniqueVertices[i1];
    const [xx2, yy2] = uniqueVertices[i2];

    const low = xx1 < xx2 || (xx1 === xx2 && yy1 > yy2) ? i1 : i2;
    const high = low === i1 ? i2 : i1;
    if (lines.some(line => line[0] === low && line[1] === high)) continue;

    const x = uniqueVertices[high][0] - uniqueVertices[low][0];
    const y = uniqueVertices[high][1] - uniqueVertices[low][1];
    const angle = Math.atan(y / x);
    lines.push([low, high, angle + (angle < 0 ? twoPI : 0)]);
  }

  lines.sort(([i1,, a1], [i2,, a2]) => {
    const [x1, y1] = uniqueVertices[i1];
    const [x2, y2] = uniqueVertices[i2];
    if (x1 !== x2) return x1 - x2;
    if (y1 !== y2) return y2 - y1;
    if ((a1 > Math.PI && a2 > Math.PI) || (a1 < Math.PI && a2 < Math.PI)) return a1 - a2;
    return a2 - a1;
  });

  const loops = findLoops(lines);

  const meshIndices = /** @type {number[]} */ ([]);

  const flatVertices = uniqueVertices.flat();
  for (const loop of loops) {
    meshIndices.push(...triangulateFace(flatVertices, loop));
  }

  return [meshIndices, flatVertices];
};
