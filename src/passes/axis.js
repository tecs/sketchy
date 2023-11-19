/** @type {RenderingPass} */
export default (engine) => {
  const { math: {mat4, vec3, vec4}, driver: {ctx, makeProgram, vert, frag}, camera, scene } = engine;

  const program = makeProgram(
    vert`
      precision mediump float;

      attribute vec4 a_position;
      attribute vec3 a_color;

      uniform mat4 u_matrix;

      varying vec3 v_color;
      varying float v_distance;

      void main() {
        gl_Position = u_matrix * a_position;

        v_color = a_color;
        v_distance = a_position.x + a_position.y - a_position.z;
      }
    `,
    frag`
      precision mediump float;

      varying vec3 v_color;
      varying float v_distance;

      uniform vec3 u_origin;

      void main() {
        vec2 centeredCoord = gl_FragCoord.xy - u_origin.xy;
        float isSolid = step(0.0, v_distance);
        float field = sin(length(centeredCoord));
        float dotField = step(0.0, field) * smoothstep(0.0, 0.1, field) * 0.8;
        gl_FragColor = vec4(v_color, isSolid + (1.0 - isSolid) * dotField);
      }
    `,
  );

  const positionBuffer = ctx.createBuffer();
  const positions = new Float32Array([
    -1, 0, 0, 0, 0, 0,
    0, -1, 0, 0, 0, 0,
    0, 0, -1, 0, 0, 0,
    0, 0, 0, 1, 0, 0,
    0, 0, 0, 0, 1, 0,
    0, 0, 0, 0, 0, 1,
  ]);
  ctx.bindBuffer(ctx.ARRAY_BUFFER, positionBuffer);
  ctx.bufferData(ctx.ARRAY_BUFFER, positions, ctx.STATIC_DRAW);

  const colorBuffer = ctx.createBuffer();
  const colors = new Float32Array([
    1, 0, 0, 1, 0, 0,
    0, 1, 0, 0, 1, 0,
    0, 0, 1, 0, 0, 1,
    1, 0, 0, 1, 0, 0,
    0, 1, 0, 0, 1, 0,
    0, 0, 1, 0, 0, 1,
  ]);
  ctx.bindBuffer(ctx.ARRAY_BUFFER, colorBuffer);
  ctx.bufferData(ctx.ARRAY_BUFFER, colors, ctx.STATIC_DRAW);

  const mvp = mat4.create();
  const origin = vec3.create();
  const vec3zero = vec3.create();

  const halfRes = vec3.create();
  engine.on('viewportresize', (current) => vec3.scale(halfRes, current, 0.5));

  const farPlaneV3 = vec3.fromValues(camera.farPlane, camera.farPlane, camera.farPlane);

  return {
    program,
    render() {
      ctx.enable(ctx.BLEND);

      ctx.bindBuffer(ctx.ARRAY_BUFFER, positionBuffer);
      ctx.enableVertexAttribArray(program.aLoc.a_position);
      ctx.vertexAttribPointer(program.aLoc.a_position, 3, ctx.FLOAT, false, 0, 0);

      ctx.bindBuffer(ctx.ARRAY_BUFFER, colorBuffer);
      ctx.enableVertexAttribArray(program.aLoc.a_color);
      ctx.vertexAttribPointer(program.aLoc.a_color, 3, ctx.FLOAT, false, 0, 0);

      mat4.getScaling(origin, scene.currentInstance.globalTrs);
      vec3.inverse(origin, origin);
      mat4.scale(mvp, scene.currentInstance.globalTrs, origin);

      vec3.transformMat4(origin, vec3zero, scene.currentInstance.globalTrs);
      vec3.transformMat4(origin, origin, camera.mvp);
      vec3.multiply(origin, origin, halfRes)
      vec3.add(origin, origin, halfRes);
      ctx.uniform3fv(program.uLoc.u_origin, origin);

      mat4.multiply(mvp, camera.mvp, mvp);
      mat4.scale(mvp, mvp, farPlaneV3);
      ctx.uniformMatrix4fv(program.uLoc.u_matrix, false, mvp);

      ctx.drawArrays(ctx.LINES, 0, 12);

      ctx.disable(ctx.BLEND);
    },
  };
};
