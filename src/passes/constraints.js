import Sketch from '../engine/cad/sketch.js';
import Id from '../engine/general/id.js';
import { DEG_TO_RAD, Properties, RAD_TO_DEG, TAU } from '../engine/general/properties.js';
import WebGLFont from './webgl-font.js';

const { vec2, vec3, vec4, mat4 } = glMatrix;

/**
 * @typedef Label
 * @property {string} text
 * @property {string} [icon]
 * @property {vec2} coord
 * @property {vec4} labelColor
 * @property {ReadonlyVec4} id
 * @property {number} [scale]
 * @property {Label} [attachedTo]
 */

// cached structures
const temp1Vec2 = vec2.create();
const temp2Vec2 = vec2.create();
const vec2Zero = vec2.create();
const tempVec3 = vec3.create();
const color = vec4.fromValues(0.25, 0.25, 0.25, 1);
const hoveredColor = vec4.fromValues(0.5, 0.5, 0.5, 1);
const selectedColor = vec4.fromValues(0.25, 0.25, 0.75, 1);
const mvp = mat4.create();
const trs = mat4.create();

const COINCIDENT_CHAR = '\x00';
const HORIZONTAL_CHAR = '\x01';
const VERTICAL_CHAR = '\x02';
const PARALLEL_CHAR = '\x03';
const PERPENDICULAR_CHAR = '\x04';

/**
 * @param {vec2} out
 * @param {ReadonlyVec2} p1
 * @param {ReadonlyVec2} p2
 * @param {0 | 1 | 2 | 3} direction 0 = top, 1 = left, 2 = right, 3 = bottom
 * @returns {vec2}
 */
const perpendicular = (out, p1, p2, direction) => {
  vec2.subtract(out, p1, p2);
  vec2.normalize(out, out);
  vec2.rotate(out, out, vec2Zero, Math.PI * 0.5);

  switch (direction) {
    case 0: if (out[1] < 0) vec2.negate(out, out); break;
    case 1: if (out[0] > 0) vec2.negate(out, out); break;
    case 2: if (out[0] < 0) vec2.negate(out, out); break;
    case 3: if (out[1] > 0) vec2.negate(out, out); break;
  }

  return out;
};

/**
 * @param {vec2} out
 * @param {ReadonlyVec2} p1
 * @param {ReadonlyVec2} p2
 * @param {...ReadonlyVec2} ps
 * @returns {vec2}
 */
const midpoint = (out, p1, p2, ...ps) => {
  vec2.add(out, p1, p2);
  for (const p of ps) vec2.add(out, out, p);
  vec2.scale(out, out, 1 / (2 + ps.length));
  return out;
};

/**
 * @param {Float32Array} out Float32Array(20)
 * @param {0 | 10} offset
 * @param {number} length
 * @param {number} arrowSize
 */
const calculateMarkerArrow = (out, offset, length, arrowSize) => {
  const to = /** @type {vec2} */ (out.subarray(offset + 2, offset + 4));
  const fromDirection = /** @type {vec2} */ (out.subarray(12 - offset, 14 - offset));

  vec2.subtract(temp2Vec2, fromDirection, to);
  vec2.normalize(temp2Vec2, temp2Vec2);
  vec2.scale(temp1Vec2, temp2Vec2, length);
  vec2.add(temp1Vec2, to, temp1Vec2);
  out.set(temp1Vec2, offset + 4);

  vec2.scale(temp1Vec2, temp2Vec2, arrowSize);
  vec2.add(temp1Vec2, to, temp1Vec2);
  vec2.rotate(temp1Vec2, temp1Vec2, to, 0.3);
  out.set(temp1Vec2, offset + 6);
  vec2.rotate(temp1Vec2, temp1Vec2, to, -0.6);
  out.set(temp1Vec2, offset + 8);
};

/**
 * @param {Float32Array} out Float32Array(20)
 * @param {number} charWidth
 * @param {number} textLength
 */
const calculateMarkerArrows = (out, charWidth, textLength) => {
  const gap = textLength * charWidth;

  const left = /** @type {ReadonlyVec2} */ (out.subarray(2, 4));
  const right = /** @type {ReadonlyVec2} */ (out.subarray(12, 14));

  const distance = (vec2.distance(left, right) - gap) * 0.5;

  calculateMarkerArrow(out, 0, distance, charWidth);
  calculateMarkerArrow(out, 10, distance, charWidth);
};

/**
 * @param {Float32Array} out Float32Array(20)
 * @param {ReadonlyVec2} p1
 * @param {ReadonlyVec2} p2
 * @param {number} charWidth
 * @param {0 | 1 | 2} direction 0 = horizontal, 1 = vertical, 2 = perpendicular
 * @returns {ReadonlyVec2}
 */
const calculateMarkerBounds = (out, p1, p2, charWidth, direction) => {
  const offset = 2 * charWidth;

  out.set(p1);
  out.set(p2, 10);

  switch (direction) {
    case 0:
      temp1Vec2[0] = p1[0];
      temp1Vec2[1] = Math.min(p1[1], p2[1]) - offset;
      out.set(temp1Vec2, 2);
      temp1Vec2[0] = p2[0];
      out.set(temp1Vec2, 12);
      break;
    case 1:
      temp1Vec2[1] = p1[1];
      temp1Vec2[0] = Math.max(p1[0], p2[0]) + offset;
      out.set(temp1Vec2, 2);
      temp1Vec2[1] = p2[1];
      out.set(temp1Vec2, 12);
      break;
    case 2:
      perpendicular(temp2Vec2, p1, p2, 2);
      vec2.scale(temp2Vec2, temp2Vec2, offset);

      vec2.add(temp1Vec2, temp2Vec2, p1);
      out.set(temp1Vec2, 2);
      vec2.add(temp1Vec2, temp2Vec2, p2);
      out.set(temp1Vec2, 12);
      break;
  }

  const left = /** @type {ReadonlyVec2} */ (out.subarray(2, 4));
  const right = /** @type {ReadonlyVec2} */ (out.subarray(12, 14));
  return vec2.clone(midpoint(temp1Vec2, left, right));
};

/**
 * @param {Label} label
 * @param {Label[]} labels
 * @returns {Label[]}
 */
const findLabelChain = (label, labels) => {
  const chain = /** @type {Label[]} */ ([label]);

  while (chain[0].attachedTo) chain.unshift(chain[0].attachedTo);
  while (true) {
    const next = labels.find(({ attachedTo }) => attachedTo === label);
    if (!next) break;
    chain.push(next);
    label = next;
  }

  return chain;
};

/** @type {RenderingPass} */
export default (engine) => {
  const {driver, camera, scene, editor: { selection } } = engine;

  const { ctx, makeProgram, vert, frag, buffer, framebuffer } = driver;

  const program = makeProgram(
    vert`#version 300 es
      in vec4 a_position;

      uniform mat4 u_mvp;

      void main() {
        gl_Position = u_mvp * a_position;

        // offset the coord a tiny bit towards the camera
        // so that lines at concave edges render in front
        // of the object's faces
        gl_Position.z -= 0.00001;
      }
    `,
    frag`#version 300 es
      precision mediump float;

      uniform vec4 u_color;

      out vec4 outColor;

      void main() {
        outColor = u_color;
      }
    `,
  );

  const font = new WebGLFont(18, driver);
  font.setCharsFromTypeface(WebGLFont.PRINTABLE_ASCII_EXTENDED, 'monospace');

  font.setChar(COINCIDENT_CHAR, (ctx2d, { halfChar, threeQuartersChar, quarterChar }) => {
    const dot = new Path2D();
    dot.arc(0, 0, 2, 0, TAU, false);

    const halfCircle = new Path2D();
    halfCircle.arc(0, 0, quarterChar, 0, TAU, false);

    const quarterLine = new Path2D('M0 0');
    quarterLine.lineTo(quarterChar, 0);

    const quarterBar = new Path2D('M0 0');
    quarterBar.lineTo(0, quarterChar);

    ctx2d.setTransform(1, 0, 0, 1, halfChar, halfChar);
    ctx2d.fill(dot);
    ctx2d.stroke(halfCircle);

    ctx2d.setTransform(1, 0, 0, 1, 1, halfChar);
    ctx2d.stroke(quarterLine);

    ctx2d.setTransform(1, 0, 0, 1, 1 + threeQuartersChar, halfChar);
    ctx2d.stroke(quarterLine);

    ctx2d.setTransform(1, 0, 0, 1, halfChar, 0);
    ctx2d.stroke(quarterBar);

    ctx2d.setTransform(1, 0, 0, 1, halfChar, threeQuartersChar);
    ctx2d.stroke(quarterBar);
  });

  font.setChar(HORIZONTAL_CHAR, (ctx2d, { charSize, halfChar }) => {
    const line = new Path2D('M0 0');
    line.lineTo(charSize, 0);

    ctx2d.setTransform(1, 0, 0, 1, 0, halfChar);
    ctx2d.stroke(line);
  });

  font.setChar(VERTICAL_CHAR, (ctx2d, { halfChar, charSize }) => {
    const bar = new Path2D('M0 0');
    bar.lineTo(0, charSize);

    ctx2d.setTransform(1, 0, 0, 1, halfChar, 0);
    ctx2d.stroke(bar);
  });

  font.setChar(PARALLEL_CHAR, (ctx2d, { threeQuartersChar, halfChar, charSize }) => {
    const line = new Path2D('M0 0');
    line.lineTo(charSize * Math.cos(-Math.PI * 0.08), charSize * Math.sin(-Math.PI * 0.08));

    ctx2d.setTransform(1, 0, 0, 1, 0, halfChar);
    ctx2d.stroke(line);
    ctx2d.setTransform(1, 0, 0, 1, 0, threeQuartersChar);
    ctx2d.stroke(line);
  });

  font.setChar(PERPENDICULAR_CHAR, (ctx2d, { threeQuartersChar, halfChar, charSize }) => {
    const bar = new Path2D('M0 0');
    bar.lineTo(halfChar * Math.cos(-Math.PI * 0.58), halfChar * Math.sin(-Math.PI * 0.58));
    ctx2d.setTransform(1, 0, 0, 1, halfChar, halfChar - halfChar * Math.cos(-Math.PI * 0.58));
    ctx2d.stroke(bar);

    const line = new Path2D('M0 0');
    line.lineTo(charSize * Math.cos(-Math.PI * 0.08), charSize * Math.sin(-Math.PI * 0.08));
    ctx2d.setTransform(1, 0, 0, 1, 0, threeQuartersChar);
    ctx2d.stroke(line);
  });

  const fb = framebuffer(ctx.UNSIGNED_BYTE);

  const indexBuffer = buffer(new Uint32Array([0, 1, 1, 2, 1, 3, 1, 4, 5, 6, 6, 7, 6, 8, 6, 9]));
  const vertex = new Float32Array(20);
  const unitArc = new Float32Array(2 * 2 * 360);
  for (let i = 0; i < 2 * 360; ++i) {
    unitArc[i * 2] = Math.cos(i * DEG_TO_RAD);
    unitArc[i * 2 + 1] = Math.sin(i * DEG_TO_RAD);
  }
  const arcVertex = new Float32Array(4 * 360 + 8);
  const vertexBuffer = ctx.createBuffer();

  const readData = new Uint8Array(4);

  /**
   * @param {ReadonlyVec2} coord2D
   * @returns {[text: number, arrows: number]}
   */
  const distanceToSketchElement = ([x, y]) => {
    if (camera.orthographic) {
      const textScaling = -camera.fovTan / Math.max(camera.scale, 1);
      const arrowScaling = camera.fovTan * 5 / camera.scale;
      return [textScaling, arrowScaling];
    }
    vec3.set(tempVec3, x, y, 0);
    vec3.transformMat4(tempVec3, tempVec3, trs);
    const scaling = camera.fovTan * vec3.distance(tempVec3, camera.eye);
    return [scaling, scaling];
  };

  return {
    program,
    render() {
      const { currentStep: sketch, currentInstance, hoveredConstraintIndex } = scene;
      if (!(sketch instanceof Sketch)) return;

      const constraints = sketch.listConstraints();
      if (constraints.length === 0) return;

      const selected = selection.getByType('constraint').map(({ id }) => id);

      mat4.multiply(trs, currentInstance.Placement.trs, sketch.fromSketch);
      mat4.multiply(mvp, camera.viewProjection, trs);

      ctx.uniformMatrix4fv(program.uLoc.u_mvp, false, mvp);
      ctx.bindBuffer(ctx.ELEMENT_ARRAY_BUFFER, indexBuffer);

      ctx.bindBuffer(ctx.ARRAY_BUFFER, vertexBuffer);
      ctx.enableVertexAttribArray(program.aLoc.a_position);
      ctx.vertexAttribPointer(program.aLoc.a_position, 2, ctx.FLOAT, false, 0, 0);

      const charWidth = font.charSize * camera.pixelToScreen[0];
      const charHeight = font.charSize * camera.pixelToScreen[1];

      /** @type {Label[]} */
      const labels = [];

      for (let i = 0; i < constraints.length; ++i) {
        const constraint = constraints[i];
        const points = constraint.indices.map(index => sketch.getPointInfo(index)).filter(p => p !== null);
        if (points.length !== constraint.indices.length) continue;
        const id = Id.intToVec4(i + 1);

        let labelColor = color;
        if (selected.includes(i)) labelColor = selectedColor;
        else if (i === hoveredConstraintIndex) labelColor = hoveredColor;
        ctx.uniform4fv(program.uLoc.u_color, labelColor);

        switch (constraint.type) {
          case 'width': {
            const text = Properties.stringifyDistance(constraint.data);
            const coord = calculateMarkerBounds(vertex, points[0].vec2, points[1].vec2, charWidth, 0);
            const [scale, arrowScaling] = distanceToSketchElement(coord);
            calculateMarkerArrows(vertex, arrowScaling * charWidth, text.length);
            labels.push({ text, coord, labelColor, id, scale });

            ctx.bufferData(ctx.ARRAY_BUFFER, vertex, ctx.DYNAMIC_DRAW);
            ctx.drawElements(ctx.LINES, 16, ctx.UNSIGNED_INT, 0);
            break;
          }
          case 'height': {
            const text = Properties.stringifyDistance(constraint.data);
            const coord = calculateMarkerBounds(vertex, points[0].vec2, points[1].vec2, charWidth, 1);
            const [scale, arrowScaling] = distanceToSketchElement(coord);
            calculateMarkerArrows(vertex, arrowScaling * charWidth, 1);
            labels.push({ text, coord, labelColor, id, scale });

            ctx.bufferData(ctx.ARRAY_BUFFER, vertex, ctx.DYNAMIC_DRAW);
            ctx.drawElements(ctx.LINES, 16, ctx.UNSIGNED_INT, 0);
            break;
          }
          case 'distance': {
            const text = Properties.stringifyDistance(constraint.data);
            const coord = calculateMarkerBounds(vertex, points[0].vec2, points[1].vec2, charWidth, 2);
            const [scale, arrowScaling] = distanceToSketchElement(coord);
            calculateMarkerArrows(vertex, arrowScaling * charWidth, text.length);
            labels.push({ text, coord, labelColor, id, scale });

            ctx.bufferData(ctx.ARRAY_BUFFER, vertex, ctx.DYNAMIC_DRAW);
            ctx.drawElements(ctx.LINES, 16, ctx.UNSIGNED_INT, 0);
            break;
          }
          case 'equal': {
            const text = `${i + 1}`;

            perpendicular(temp1Vec2, points[0].vec2, points[1].vec2, 2);
            vec2.scale(temp1Vec2, temp1Vec2, 2 * charWidth);
            midpoint(temp2Vec2, points[0].vec2, points[1].vec2);
            vec2.add(temp2Vec2, temp1Vec2, temp2Vec2);
            temp2Vec2[0] += text.length * charWidth + charWidth;
            labels.push({ text, icon: '=', coord: vec2.clone(temp2Vec2), labelColor, id });

            perpendicular(temp1Vec2, points[2].vec2, points[3].vec2, 2);
            vec2.scale(temp1Vec2, temp1Vec2, 2 * charWidth);
            midpoint(temp2Vec2, points[2].vec2, points[3].vec2);
            vec2.add(temp2Vec2, temp1Vec2, temp2Vec2);
            temp2Vec2[0] += text.length * charWidth + charWidth;
            labels.push({ text, icon: '=', coord: vec2.clone(temp2Vec2), labelColor, id });
            break;
          }
          case 'horizontal':
            midpoint(temp1Vec2, points[0].vec2, points[1].vec2);
            temp1Vec2[1] += 2 * charHeight;
            labels.push({ text: `${i + 1}`, icon: HORIZONTAL_CHAR, coord: vec2.clone(temp1Vec2), labelColor, id });
            break;
          case 'vertical': {
            const text = `${i + 1}`;
            midpoint(temp1Vec2, points[0].vec2, points[1].vec2);
            temp1Vec2[0] += (text.length + 1) * charWidth + charWidth;
            labels.push({ text, icon: VERTICAL_CHAR, coord: vec2.clone(temp1Vec2), labelColor, id });
            break;
          }
          case 'coincident':
            vec2.copy(temp1Vec2, points[0].vec2);
            temp1Vec2[1] += 2 * charHeight;
            labels.push({ text: `${i + 1}`, icon: COINCIDENT_CHAR, coord: vec2.clone(temp1Vec2), labelColor, id });
            break;
          case 'angle': {
            const text = Properties.stringifyAngle(constraint.data);
            const diffX1 = points[0].vec2[0] - points[1].vec2[0];
            const diffY1 = points[0].vec2[1] - points[1].vec2[1];
            const diffX2 = points[2].vec2[0] - points[3].vec2[0];
            const diffY2 = points[2].vec2[1] - points[3].vec2[1];
            const den = diffX1 * diffY2 - diffY1 * diffX2;

            const isPerpendicular = Math.abs(den) < 0.001;

            const axisPoint = (points[0].id < 0 ? 0 : null) ?? (points[2].id < 0 ? 2 : null);
            if (!isPerpendicular) {
              const cross1 = (points[0].vec2[0] * points[1].vec2[1] - points[0].vec2[1] * points[1].vec2[0]);
              const cross2 = (points[2].vec2[0] * points[3].vec2[1] - points[2].vec2[1] * points[3].vec2[0]);
              vec2.set(temp2Vec2, (cross1 * diffX2 - cross2 * diffX1) / den, (cross1 * diffY2 - cross2 * diffY1) / den);
            } else if (axisPoint !== null) {
              midpoint(temp2Vec2, points[2 - axisPoint].vec2, points[3 - axisPoint].vec2);
              temp2Vec2[points[axisPoint].vec2[0] === 0 ? 0 : 1] *= 0.5;
            } else {
              midpoint(temp2Vec2, points[0].vec2, points[1].vec2, points[2].vec2, points[3].vec2);
            }

            const radius = (Math.hypot(diffX1, diffY1) + Math.hypot(diffX2, diffY2)) * 0.5;
            const degrees = Math.floor(constraint.data * RAD_TO_DEG);

            let angleStart = Math.atan2(-diffY1, -diffX1);
            if (angleStart < 0) angleStart += TAU;

            const coord = vec2.clone(temp2Vec2);
            coord[0] += text.length * charWidth * 0.5;
            coord[1] -= charHeight * 0.5;
            coord[0] += Math.cos(angleStart + constraint.data * 0.5) * (radius + text.length * charWidth * 2);
            coord[1] += Math.sin(angleStart + constraint.data * 0.5) * (radius - charHeight * 2);
            labels.push({ text, coord, labelColor, id });

            temp1Vec2[0] = Math.cos(angleStart) * radius + temp2Vec2[0];
            temp1Vec2[1] = Math.sin(angleStart) * radius + temp2Vec2[1];
            arcVertex.set(temp1Vec2, 2);
            const d1 = Math.abs(diffX1) > Math.abs(diffY1)
              ? -(temp1Vec2[0] - points[0].vec2[0]) / diffX1
              : -(temp1Vec2[1] - points[0].vec2[1]) / diffY1;

            if (isPerpendicular) {
              temp1Vec2[0] = Math.cos(angleStart) * radius * 0.9 + temp2Vec2[0];
              temp1Vec2[1] = Math.sin(angleStart) * radius * 0.9 + temp2Vec2[1];
            }
            else if (axisPoint !== 0 && d1 < 0) vec2.copy(temp1Vec2, points[0].vec2);
            else if (axisPoint !== 0 && d1 > 1) vec2.copy(temp1Vec2, points[1].vec2);

            arcVertex.set(temp1Vec2);
            vec2.set(temp1Vec2, arcVertex[2], arcVertex[3]);

            arcVertex.set(temp1Vec2, 4);
            angleStart = Math.ceil(angleStart * RAD_TO_DEG);
            const idx1 = 2 * angleStart;
            temp1Vec2[0] = unitArc[idx1] * radius + temp2Vec2[0];
            temp1Vec2[1] = unitArc[idx1 + 1] * radius + temp2Vec2[1];
            arcVertex.set(temp1Vec2, 6);

            for (let k = 1; k < degrees - 1; ++k) {
              arcVertex.set(temp1Vec2, k * 4 + 4);

              const idx2 = 2 * (k + angleStart);
              temp1Vec2[0] = unitArc[idx2] * radius + temp2Vec2[0];
              temp1Vec2[1] = unitArc[idx2 + 1] * radius + temp2Vec2[1];
              arcVertex.set(temp1Vec2, k * 4 + 6);
            }

            arcVertex.set(temp1Vec2, degrees * 4);
            const angleEnd = Math.atan2(-diffY2, -diffX2);
            temp1Vec2[0] = Math.cos(angleEnd) * radius + temp2Vec2[0];
            temp1Vec2[1] = Math.sin(angleEnd) * radius + temp2Vec2[1];
            arcVertex.set(temp1Vec2, degrees * 4 + 2);

            arcVertex.set(temp1Vec2, degrees * 4 + 4);
            const d2 = Math.abs(diffX2) > Math.abs(diffY2)
              ? -(temp1Vec2[0] - points[2].vec2[0]) / diffX2
              : -(temp1Vec2[1] - points[2].vec2[1]) / diffY2;
            if (isPerpendicular) {
              temp1Vec2[0] = Math.cos(angleEnd) * radius * 0.9 + temp2Vec2[0];
              temp1Vec2[1] = Math.sin(angleEnd) * radius * 0.9 + temp2Vec2[1];
            }
            else if (axisPoint !== 2 && d2 < 0) vec2.copy(temp1Vec2, points[2].vec2);
            else if (axisPoint !== 2 && d2 > 1) vec2.copy(temp1Vec2, points[3].vec2);
            arcVertex.set(temp1Vec2, degrees * 4 + 6);

            ctx.bufferData(ctx.ARRAY_BUFFER, arcVertex, ctx.DYNAMIC_DRAW);
            ctx.drawArrays(ctx.LINES, 0, degrees * 2 + 4);
            break;
          }
          case 'parallel':
          case 'perpendicular': {
            const text = `${i + 1}`;
            const icon = `${constraint.type === 'parallel' ? PARALLEL_CHAR : PERPENDICULAR_CHAR}`;

            if (points[0].id >= 0) {
              perpendicular(temp1Vec2, points[0].vec2, points[1].vec2, 2);
              vec2.scale(temp1Vec2, temp1Vec2, 2 * charWidth);
              midpoint(temp2Vec2, points[0].vec2, points[1].vec2);
              vec2.add(temp2Vec2, temp1Vec2, temp2Vec2);
              temp2Vec2[0] += text.length * charWidth + charWidth;
              labels.push({ text, icon, coord: vec2.clone(temp2Vec2), labelColor, id });
            }

            if (points[2].id >= 1) {
              perpendicular(temp1Vec2, points[2].vec2, points[3].vec2, 2);
              vec2.scale(temp1Vec2, temp1Vec2, 2 * charWidth);
              midpoint(temp2Vec2, points[2].vec2, points[3].vec2);
              vec2.add(temp2Vec2, temp1Vec2, temp2Vec2);
              temp2Vec2[0] += text.length * charWidth + charWidth;
              labels.push({ text, icon, coord: vec2.clone(temp2Vec2), labelColor, id });
            }
            break;
          }
        }
      }

      vec2.set(temp1Vec2, 0, 1);
      vec2.transformMat4(temp1Vec2, temp1Vec2, mvp);
      vec2.transformMat4(temp2Vec2, vec2Zero, mvp);
      const minDistance =  (camera.orthographic ? 0.08 : 0.3) / vec2.distance(temp1Vec2, temp2Vec2);
      const generalScaling = (camera.orthographic ? -5 : 1) * distanceToSketchElement(vec2Zero)[0];

      for (let maxIterations = 5; maxIterations > 0; --maxIterations) {
        let clean = true;

        for (const label of labels) {
          if (label.icon === undefined) continue;
          const chain = findLabelChain(label, labels);
          let conflictingLabel = labels.findLast(other =>
            !chain.includes(other) && other.icon !== undefined && vec2.distance(other.coord, label.coord) < minDistance,
          );
          if (!conflictingLabel) continue;

          const conflictingChain = findLabelChain(conflictingLabel, labels);
          if (conflictingLabel.icon !== label.icon) {
            const deltaY = (label.coord[1] > conflictingLabel.coord[1] ? 1 : -1) * minDistance * 0.5;
            chain.forEach(({ coord }) => void(coord[1] += deltaY));
            conflictingChain.forEach(({ coord }) => void(coord[1] -= deltaY));
            clean = false;
            break;
          }

          let labelTip = chain[chain.length - 1];
          conflictingChain[0].attachedTo = labelTip;
          conflictingChain[0].text = ',' + conflictingChain[0].text;

          for (conflictingLabel of conflictingChain) {
            const offset = labelTip === chain[0] && conflictingLabel === conflictingChain[0] ? 1 : 0;
            vec2.copy(conflictingLabel.coord, labelTip.coord);
            conflictingLabel.coord[0] += (labelTip.text.length + offset) * charWidth * generalScaling;
            labelTip = conflictingLabel;
          }

          clean = false;
          break;
        }

        if (clean) break;
      }

      ctx.enable(ctx.BLEND);
      ctx.pixelStorei(ctx.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      ctx.blendFunc(ctx.ONE, ctx.ONE_MINUS_SRC_ALPHA);
      ctx.depthMask(false);

      vec2.set(temp1Vec2, camera.pixelToScreen[0], -camera.pixelToScreen[1]);
      if (camera.orthographic) vec2.negate(temp1Vec2, temp1Vec2);

      font.enable(mvp, temp1Vec2);

      for (const { text, icon, coord, labelColor, scale, attachedTo } of labels) {
        font.renderText(`${attachedTo ? '' : icon ?? ''}${text}`, coord, labelColor, scale);
      }

      ctx.disable(ctx.BLEND);
      ctx.depthMask(true);
      ctx.pixelStorei(ctx.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      ctx.blendFunc(ctx.SRC_ALPHA, ctx.ONE_MINUS_SRC_ALPHA);

      ctx.bindFramebuffer(ctx.FRAMEBUFFER, fb);
      ctx.clear(ctx.COLOR_BUFFER_BIT | ctx.DEPTH_BUFFER_BIT);

      font.enable(camera.frustum, temp1Vec2, 0);

      for (const { text, icon, coord, id, scale, attachedTo } of labels) {
        font.renderText(`${attachedTo ? '' : icon ?? ''}${text}`, coord, id, scale);
      }

      ctx.readPixels(0, 0, 1, 1, ctx.RGBA, ctx.UNSIGNED_BYTE, readData);
      scene.hoverConstraint(readData);
    },
  };
};
