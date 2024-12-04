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

  const grid = [...Array(99)].flatMap((_, i) => [0, 1, 2].flatMap(c => [1, -1].map(s => [i + 1, c, (c || 2) - 1, s])));
  const positions = new Float32Array(
    [0.02, 0.08, 0.4, 2].flatMap((gradation, p, gs) => {
      const spacing = Math.pow(10, p - 1);
      return grid.flatMap(([n, c1, c2, sign]) => [0, 0, 0, 0, 0, 0]
        .with(c1, spacing * n * sign)
        .with(c1 + 3, spacing * n * sign)
        .with(c2 + 3, n % 10 ? gradation : gs[p + 1] ?? gradation),
      );
    }),
  );
  const indices = new Uint32Array(positions.length / 3).map((_, i) => i);

  const positionBuffer = buffer(positions);
  const indicesBuffer = buffer(indices);

  // cached structures
  const mvp = mat4.create();

  const setting = engine.config.createBoolean('display.grid', 'Show grid', 'toggle', true);
  engine.on('settingchange', (changed) => {
    if (changed === setting) engine.emit('scenechange');
  });

  return {
    program,
    render() {
      if (!setting.value) return;

      ctx.bindBuffer(ctx.ELEMENT_ARRAY_BUFFER, indicesBuffer);

      ctx.bindBuffer(ctx.ARRAY_BUFFER, positionBuffer);
      ctx.enableVertexAttribArray(program.aLoc.a_position);
      ctx.vertexAttribPointer(program.aLoc.a_position, 3, ctx.FLOAT, false, 0, 0);

      const { trs } = scene.currentInstance.Placement;

      mat4.multiply(mvp, camera.viewProjection, trs);
      ctx.uniformMatrix4fv(program.uLoc.u_matrix, false, mvp);

      ctx.lineWidth(1);
      ctx.drawElements(ctx.LINES, indices.length, ctx.UNSIGNED_INT, 0);
    },
  };
};
