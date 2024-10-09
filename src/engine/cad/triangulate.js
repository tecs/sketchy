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
 * @param {Readonly<number[]>} indices
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
 * @param {number[]} loop
 * @param {number[][]} loops
 */
const addLoop = (loop, loops) => {
  for (const existingLoop of loops) {
    if (existingLoop.length !== loop.length) continue;
    if (loop === existingLoop) return;
    let matches = true;
    for (let i = 0; matches && i < existingLoop.length; ++i) {
      matches = loop[i] !== existingLoop[i];
    }
    if (matches) return;
  }
  loops.push(loop);
};

/**
 * @param {Readonly<Line[]>} lines
 * @returns {number[][]}
 */
const findLoops = (lines) => {
  const remaining = lines.slice();
  const closedLoops = /** @type {number[][]} */ ([]);

  while (remaining.length) {
    const current = [remaining[0]];
    let open = true;
    let nextIndex = remaining[0][1];
    let skipLine = /** @type {Line?} */ (null);

    while (open) {
      const currentLine = current[current.length - 1];
      let currentLineAngle = currentLine[2];
      if (currentLine[1] === nextIndex) {
        currentLineAngle += currentLineAngle < Math.PI ? Math.PI : -Math.PI;
      }

      const candidates = /** @type {[line: Line, diff: number][]} */ ([]);

      for (const line of lines) {
        const connectedIdx = line[0] === nextIndex ? 0 : 1;
        if (line[connectedIdx] !== nextIndex || current.includes(line)) continue;

        let angle = line[2];
        if (connectedIdx === 1) {
          angle += angle < Math.PI ? Math.PI : -Math.PI;
        }
        const diff = (angle >= currentLineAngle ? angle : twoPI - angle) - currentLineAngle;
        candidates.push([line, diff]);
      }

      const sortedCandidates = candidates.sort(([, a], [, b]) => a - b);
      const nextCandidateIndex = sortedCandidates.findIndex(([line]) => line === skipLine) + 1;
      const [nextLine] = sortedCandidates.at(nextCandidateIndex) ?? [];

      if (!nextLine) {
        current.pop();
        if (current.length === 0) {
          remaining.splice(remaining.indexOf(currentLine), 1);
          break;
        }

        skipLine = currentLine;
        continue;
      }

      current.push(nextLine);
      skipLine = null;

      nextIndex = nextLine[0] === nextIndex ? nextLine[1] : nextLine[0];
      const connectedIndex = current.slice(0, -2).findIndex(([i1, i2]) => i1 === nextIndex || i2 === nextIndex);

      if (connectedIndex === -1) continue;

      const closed = [nextIndex];
      for (let i = connectedIndex; i < current.length; ++i) {
        const line = current[i];
        remaining.splice(remaining.indexOf(line), 1);

        const index = closed[closed.length - 1] === line[0] ? line[1] : line[0];
        if (index !== nextIndex) closed.push(index);
      }
      closedLoops.push(closed);
      open = false;
    }
  }

  return closedLoops;
};

/**
 * @param {Readonly<number[]>} vertices
 * @param {Readonly<number[]>} lineIndices A-B,B-C,C-D,...
 * @returns {number[]} Polygon indices
 */
export default (vertices, lineIndices) => {
  // remove duplicate and zero-length lines
  const lines = /** @type {Line[]} */ ([]);
  for (let i = 1; i < lineIndices.length; i += 2) {
    const low = lineIndices[i - 1] < lineIndices[i] ? lineIndices[i - 1] : lineIndices[i];
    const high = lineIndices[i] > lineIndices[i - 1] ? lineIndices[i] : lineIndices[i - 1];
    const valid = low !== high && lines.every(line => line[0] !== low || line[1] !== high);

    if (valid) {
      const x = vertices[high * 2] - vertices[low * 2];
      const y = vertices[high * 2 - 1] - vertices[low * 2 - 1];
      let angle = Math.atan(y / x);
      if (x < 0) angle += Math.PI;
      else if (y < 0) angle += twoPI;
      lines.push([low, high, angle]);
    }
  }

  const loops = findLoops(lines);

  const meshIndices = /** @type {number[]} */ ([]);
  for (const loop of loops) {
    meshIndices.push(...triangulateFace(vertices, loop));
  }

  return meshIndices;
};
