const { mat4 } = glMatrix;

/** @type {RenderingPass} */
export default ({ driver: { ctx, buffer, makeProgram, vert, frag }, camera }) => {
  const program = makeProgram(
    vert`#version 300 es
      in vec4 a_position;
      in vec4 a_color;

      uniform mat4 u_mvp;

      out vec4 v_color;

      void main() {
        gl_Position = u_mvp * a_position;
        v_color = a_color;
      }
    `,
    frag`#version 300 es
      precision mediump float;

      in vec4 v_color;

      out vec4 outColor;

      void main() {
        outColor = v_color;
      }
    `,
  );

  const indices = new Uint32Array([
    0, 1, 2,
    1, 3, 2,
    1, 4, 3,
    3, 4, 5,
    6, 8, 7,
    7, 8, 9,
    7, 9, 10,
    9, 11, 10,
  ]);

  const positionBuffer = buffer(new Float32Array([
    /* eslint-disable no-multi-spaces,indent */
    -1,  0, -1, //  0 FL
    -1, -1,  0, //  1 BL
     1,  0, -1, //  2 FR
     1, -1,  0, //  3 BR
    -1,  0,  1, //  4 RL
     1,  0,  1, //  5 RR
    -1,  0, -1, //  6 FL
    -1,  1,  0, //  7 TL
     1,  0, -1, //  8 FR
     1,  1,  0, //  9 TR
    -1,  0,  1, // 10 RL
     1,  0,  1, // 11 RR
    /* eslint-enable no-multi-spaces,indent */
  ]));

  const colorBuffer = buffer(new Uint8Array([
    178, 178, 178,
    178, 178, 178,
    178, 178, 178,
    178, 178, 178,
    178, 178, 178,
    178, 178, 178,
    216, 230, 255,
    216, 230, 255,
    216, 230, 255,
    216, 230, 255,
    216, 230, 255,
    216, 230, 255,
  ]));

  const indexBuffer = buffer(indices);

  // cached structures
  const mvp = mat4.create();

  return {
    program,
    render() {
      ctx.disable(ctx.DEPTH_TEST);

      ctx.bindBuffer(ctx.ARRAY_BUFFER, positionBuffer);
      ctx.enableVertexAttribArray(program.aLoc.a_position);
      ctx.vertexAttribPointer(program.aLoc.a_position, 3, ctx.FLOAT, false, 0, 0);

      ctx.bindBuffer(ctx.ARRAY_BUFFER, colorBuffer);
      ctx.enableVertexAttribArray(program.aLoc.a_color);
      ctx.vertexAttribPointer(program.aLoc.a_color, 3, ctx.UNSIGNED_BYTE, true, 0, 0);

      mat4.rotateX(mvp, camera.projection, camera.pitch);
      mat4.scale(mvp, mvp, camera.inverseFovScaling);

      ctx.uniformMatrix4fv(program.uLoc.u_mvp, false, mvp);

      ctx.bindBuffer(ctx.ELEMENT_ARRAY_BUFFER, indexBuffer);
      ctx.drawElements(ctx.TRIANGLES, indices.length, ctx.UNSIGNED_INT, 0);
      ctx.enable(ctx.DEPTH_TEST);
    },
  };
};
