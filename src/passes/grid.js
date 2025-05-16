import Sketch from '../engine/cad/sketch.js';

const { mat4 } = glMatrix;

/** @type {RenderingPass} */
export default (engine) => {
  const {
    driver: { ctx, makeProgram, vert, frag, buffer },
    camera,
    scene,
  } = engine;

  const program = makeProgram(
    vert`#version 300 es
      precision mediump float;

      in vec4 a_position;

      uniform mat4 u_matrix;

      void main() {
        gl_Position = u_matrix * a_position;
      }
    `,
    frag`#version 300 es
      precision mediump float;

      out vec4 outColor;

      void main() {
        outColor = vec4(0, 0, 0, 1);
      }
    `,
  );

  const axisGradationsElements = 99;
  const gradationLevels = [0.02, 0.08, 0.4, 2].map((gradation, p) => [gradation, Math.pow(10, p - 1)]);
  const grid = [...Array(axisGradationsElements)]
    .flatMap((_, i) => [0, 1, 2].flatMap(c => [1, -1].map(s => [i + 1, c, (c || 2) - 1, s])))
    .sort(([, a], [, b]) => a - b);

  const positions = new Float32Array(
    grid.flatMap(([n, c1, c2, sign]) => gradationLevels.flatMap(([gradation, spacing], p, gs) => [0, 0, 0, 0, 0, 0]
      .with(c1, spacing * n * sign)
      .with(c1 + 3, spacing * n * sign)
      .with(c2 + 3, n % 10 ? gradation : gs[p + 1]?.[0] ?? gradation),
    )),
  );
  const indices = new Uint32Array(grid.length * gradationLevels.length * 2).map((_, i) => i);

  const positionBuffer = buffer(positions);
  const indicesBuffer = buffer(indices);

  const xyLength = axisGradationsElements * 2 * 2 * 2 * gradationLevels.length;

  // cached structures
  const mvp = mat4.create();
  const trs = mat4.create();

  const setting = engine.config.createBoolean('display.gradations', 'Show axis gradations', 'toggle', true);
  engine.on('settingchange', (changed) => {
    if (changed === setting) engine.emit('scenechange');
  });

  return {
    program,
    render() {
      if (!setting.value) return;

      const isSketch = scene.currentStep instanceof Sketch;

      ctx.bindBuffer(ctx.ELEMENT_ARRAY_BUFFER, indicesBuffer);

      ctx.bindBuffer(ctx.ARRAY_BUFFER, positionBuffer);
      ctx.enableVertexAttribArray(program.aLoc.a_position);
      ctx.vertexAttribPointer(program.aLoc.a_position, 3, ctx.FLOAT, false, 0, 0);

      mat4.copy(trs, scene.currentInstance.Placement.trs);
      if (isSketch) mat4.multiply(trs, trs, scene.currentStep.fromSketch);

      mat4.multiply(mvp, camera.viewProjection, trs);
      ctx.uniformMatrix4fv(program.uLoc.u_matrix, false, mvp);

      ctx.lineWidth(1);
      ctx.drawElements(ctx.LINES, isSketch ? xyLength : indices.length, ctx.UNSIGNED_INT, 0);
    },
  };
};
