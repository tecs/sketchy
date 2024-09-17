/** @type {RenderingPass} */
export default (engine) => {
  const {
    driver: { ctx, makeProgram, vert, frag },
    camera,
    editor: { selection },
    scene,
  } = engine;

  const program = makeProgram(
    vert`
      attribute vec4 a_position;

      uniform mat4 u_trs;
      uniform mat4 u_viewProjection;
      uniform float u_isSelected;
      uniform float u_isHovered;

      varying vec4 v_color;

      void main() {
        gl_Position = u_viewProjection * u_trs * a_position;
        v_color = vec4(0.0, 0.0, u_isSelected, 1.0);
        v_color.rgb += u_isHovered;

        // offset the coord a tiny bit towards the camera
        // so that lines at concave edges render in front
        // of the object's faces
        gl_Position.z -= 0.00002;
        gl_PointSize = 5.0 + u_isHovered * 5.0;
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
    render() {
      const { enteredInstance, hoveredInstance, hoveredPointIndex } = scene;
      const pointIsHovered = hoveredPointIndex !== null && enteredInstance === hoveredInstance;

      const selectedPointIndices = selection.getByType('point').map(({ index }) => index);
      if (!selectedPointIndices.length && !pointIsHovered) return;

      const model = enteredInstance?.body.currentModel;
      if (!model) return;

      ctx.bindBuffer(ctx.ARRAY_BUFFER, model.buffer.vertex);
      ctx.enableVertexAttribArray(program.aLoc.a_position);
      ctx.vertexAttribPointer(program.aLoc.a_position, 3, ctx.FLOAT, false, 0, 0);

      ctx.uniformMatrix4fv(program.uLoc.u_viewProjection, false, camera.viewProjection);

      ctx.uniformMatrix4fv(program.uLoc.u_trs, false, enteredInstance.Placement.trs);

      if (pointIsHovered) {
        ctx.uniform1f(program.uLoc.u_isSelected, 0);
        ctx.uniform1f(program.uLoc.u_isHovered, 1);
        ctx.drawArrays(ctx.POINTS, hoveredPointIndex, 1);
        ctx.uniform1f(program.uLoc.u_isHovered, 0);
        ctx.drawArrays(ctx.POINTS, hoveredPointIndex, 1);
      }
      if (selectedPointIndices.length) {
        ctx.uniform1f(program.uLoc.u_isSelected, 1);
        ctx.uniform1f(program.uLoc.u_isHovered, 0);
        for (const selectedPointIndex of selectedPointIndices) {
          ctx.drawArrays(ctx.POINTS, selectedPointIndex, 1);
        }
      }
    },
  };
};
