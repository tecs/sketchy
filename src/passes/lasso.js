const { vec3 } = glMatrix;

/** @type {RenderingPass} */
export default ({ driver: { ctx, makeProgram, vert, frag, buffer }, input, camera, tools }) => {
  const program = makeProgram(
    vert`#version 300 es
      in vec4 a_position;

      void main() {
        gl_Position = a_position;
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

  // cached structures
  const vertex = vec3.create();
  // vec2 view of the above
  const vertex2 = vertex.subarray(0, 2);
  const oneOneZero = vec3.fromValues(1, -1, 0);

  const positions = new Float32Array(8);
  const indices = new Uint32Array([0, 1, 2, 0, 2, 3]);
  const lineIndices = new Uint32Array([0, 1, 1, 2, 2, 3, 3, 0]);

  const indexBuffer = buffer(indices);
  const lineIndexBuffer = buffer(lineIndices);

  const positionBuffer = ctx.createBuffer();

  return {
    program,
    render() {
      if (!input.leftButton || tools.selected?.type !== 'select') return;

      vec3.multiply(vertex, input.lastClickedPosition, camera.pixelToScreen);
      vec3.subtract(vertex, vertex, oneOneZero);
      positions.set(vertex2);
      positions[2] = vertex2[0];
      positions[7] = vertex2[1];

      vec3.multiply(vertex, input.position, camera.pixelToScreen);
      vec3.subtract(vertex, vertex, oneOneZero);
      positions.set(vertex2, 4);
      positions[3] = vertex2[1];
      positions[6] = vertex2[0];

      ctx.disable(ctx.DEPTH_TEST);
      ctx.enable(ctx.BLEND);

      ctx.bindBuffer(ctx.ARRAY_BUFFER, positionBuffer);
      ctx.bufferData(ctx.ARRAY_BUFFER, positions, ctx.STATIC_DRAW);
      ctx.enableVertexAttribArray(program.aLoc.a_position);
      ctx.vertexAttribPointer(program.aLoc.a_position, 2, ctx.FLOAT, false, 0, 0);

      ctx.uniform4f(program.uLoc.u_color, 0, 0, 0.3, 0.3);

      ctx.bindBuffer(ctx.ELEMENT_ARRAY_BUFFER, indexBuffer);
      ctx.drawElements(ctx.TRIANGLES, indices.length, ctx.UNSIGNED_INT, 0);

      ctx.lineWidth(2);
      ctx.uniform4f(program.uLoc.u_color, 0, 0, 0.3, 0.7);

      ctx.bindBuffer(ctx.ELEMENT_ARRAY_BUFFER, lineIndexBuffer);
      ctx.drawElements(ctx.LINES, lineIndices.length, ctx.UNSIGNED_INT, 0);

      ctx.disable(ctx.BLEND);
      ctx.enable(ctx.DEPTH_TEST);
    },
  };
};
