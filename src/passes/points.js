/** @type {RenderingPass} */
export default (engine) => {
  const {
    driver: { ctx, makeProgram, vert, frag },
    camera,
    scene,
  } = engine;

  const program = makeProgram(
    vert`
      attribute vec4 a_position;

      uniform mat4 u_trs;
      uniform mat4 u_viewProjection;

      varying vec4 v_color;

      void main() {
        gl_Position = u_viewProjection * u_trs * a_position;
        v_color = vec4(0.0, 0.0, 1.0, 1.0);

        // offset the coord a tiny bit towards the camera
        // so that lines at concave edges render in front
        // of the object's faces
        gl_Position.z -= 0.00002;
        gl_PointSize = 5.0;
      }
    `,
    frag`
      precision mediump float;

      varying vec4 v_color;

      void main() {
        gl_FragColor = v_color;
      }
    `,
  );

  return {
    program,
    render(draw) {
      if (!draw || !scene.selectedPointIndex) return;

      const model = scene.enteredInstance?.body.currentModel;
      if (!model) return;

      ctx.bindBuffer(ctx.ARRAY_BUFFER, model.buffer.vertex);
      ctx.enableVertexAttribArray(program.aLoc.a_position);
      ctx.vertexAttribPointer(program.aLoc.a_position, 3, ctx.FLOAT, false, 0, 0);

      ctx.uniformMatrix4fv(program.uLoc.u_viewProjection, false, camera.viewProjection);

      ctx.uniformMatrix4fv(program.uLoc.u_trs, false, scene.enteredInstance.Placement.trs);

      ctx.drawArrays(ctx.POINTS, scene.selectedPointIndex - 1, 1);
    },
  };
};
