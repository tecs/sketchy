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
 * @param {Readonly<number[]>} lines
 * @returns {number[][]}
 */
const findLoops = (lines) => {
  const nLines = lines.length / 2;

  const closedLoops = /** @type {number[][]} */ ([]);
  const tempLoops = /** @type {number[][]} */ ([]);

  for (let i = 0; i < nLines; ++i) {
    const idxL1 = lines[i * 2];
    const idxL2 = lines[i * 2 + 1];

    let found = false;

    for (let k = 0; k < tempLoops.length; ++k) {
      const tmpLoop = tempLoops[k];
      const lastIndex = tmpLoop.length - 1;

      const i1 = tmpLoop.indexOf(idxL1);
      const i2 = tmpLoop.indexOf(idxL2);

      if (i1 === -1 && i2 === -1) continue;
      found = true;

      if (i1 !== -1 && i2 !== -1) {
        const iLow = i1 < i2 ? i1 : i2;
        const iHigh = i1 < i2 ? i2 : i1;

        // ignore overlapping lines
        if (iHigh - iLow === 1) continue;

        if (iLow !== 0 || iHigh !== lastIndex) {
          const newLoop = [tmpLoop[iLow], tmpLoop[iHigh]].concat(tmpLoop.splice(iHigh + 1));
          newLoop.unshift(...tmpLoop.splice(0, iLow));
          tempLoops.push(newLoop);
        }

        tempLoops.splice(k, 1);
        closedLoops.push(tmpLoop);
        k--;
        continue;
      }

      const iMatch = i1 !== -1 ? i1 : i2;
      const idxOther = i1 !== -1 ? idxL2 : idxL1;

      if (iMatch === lastIndex) {
        tmpLoop.push(idxOther);
      } else if (iMatch === 0) {
        tmpLoop.unshift(idxOther);
      } else {
        const newLoop1 = tmpLoop.slice(0, iMatch + 1).concat(idxOther);
        const newLoop2 = [idxOther, ...tmpLoop.slice(iMatch)];
        tempLoops.push(newLoop1, newLoop2);
      }
    }

    if (!found) {
      tempLoops.push([idxL1, idxL2]);
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
  const sanitizedIndices = /** @type {number[]} */ ([]);
  for (let i = 1; i < lineIndices.length; i += 2) {
    const low = lineIndices[i - 1] < lineIndices[i] ? lineIndices[i - 1] : lineIndices[i];
    const high = lineIndices[i] > lineIndices[i - 1] ? lineIndices[i] : lineIndices[i - 1];
    let invalid = low === high;

    for (let k = 1; k < sanitizedIndices.length && !invalid; k += 2) {
      if (sanitizedIndices[k - 1] === low && sanitizedIndices[k] === high) {
        invalid = true;
      }
    }

    if (!invalid) {
      sanitizedIndices.push(low, high);
    }
  }

  const loops = findLoops(sanitizedIndices);

  const meshIndices = /** @type {number[]} */ ([]);
  for (const loop of loops) {
    meshIndices.push(...triangulateFace(vertices, loop));
  }

  return meshIndices;
};
