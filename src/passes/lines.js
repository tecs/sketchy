/** @type {RenderingPass} */
export default (engine) => {
  const {
    driver: { ctx, makeProgram, vert, frag, UNSIGNED_INDEX_TYPE },
    camera,
    scene,
  } = engine;

  const program = makeProgram(
    vert`
      attribute vec4 a_position;

      uniform mat4 u_trs;
      uniform mat4 u_viewProjection;
      uniform float u_isSelected;
      uniform float u_isInShadow;

      varying vec4 v_color;

      void main() {
        gl_Position = u_viewProjection * u_trs * a_position;
        v_color = vec4(0.0, 0.0, u_isSelected, 1.0);

        // Darken non-selected instance
        v_color.rgb *= max(1.0 - u_isInShadow, 0.2);
        v_color.rgb += u_isInShadow * 0.3;

        // offset the coord a tiny bit towards the camera
        // so that lines at concave edges render in front
        // of the object's faces
        gl_Position.z -= 0.00001;
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
      if (!draw) return;

      for (const model of scene.models) {
        ctx.bindBuffer(ctx.ELEMENT_ARRAY_BUFFER, model.buffer.lineIndex);

        ctx.bindBuffer(ctx.ARRAY_BUFFER, model.buffer.lineVertex);
        ctx.enableVertexAttribArray(program.aLoc.a_position);
        ctx.vertexAttribPointer(program.aLoc.a_position, 3, ctx.FLOAT, false, 0, 0);

        ctx.uniformMatrix4fv(program.uLoc.u_viewProjection, false, camera.viewProjection);

        for (const instance of model.instances) {
          const isSelected = scene.selectedInstance && instance.belongsTo(scene.selectedInstance) ? 1 : 0;
          const isInShadow = !isSelected && !instance.belongsTo(scene.currentInstance) ? 1 : 0;

          ctx.uniformMatrix4fv(program.uLoc.u_trs, false, instance.globalTrs);
          ctx.uniform1f(program.uLoc.u_isSelected, isSelected);
          ctx.uniform1f(program.uLoc.u_isInShadow, isInShadow);

          if (instance !== scene.rootInstance && isSelected) ctx.lineWidth(2);
          ctx.drawElements(ctx.LINES, model.data.lineIndex.length, UNSIGNED_INDEX_TYPE, 0);
          ctx.lineWidth(1);
        }
      }

      if (scene.selectedInstance) {
        const { model, globalTrs } = scene.selectedInstance;

        ctx.bindBuffer(ctx.ELEMENT_ARRAY_BUFFER, model.buffer.boundingBoxIndex);

        ctx.bindBuffer(ctx.ARRAY_BUFFER, model.buffer.boundingBoxVertex);
        ctx.enableVertexAttribArray(program.aLoc.a_position);
        ctx.vertexAttribPointer(program.aLoc.a_position, 3, ctx.FLOAT, false, 0, 0);

        ctx.uniformMatrix4fv(program.uLoc.u_trs, false, globalTrs);
        ctx.uniform1f(program.uLoc.u_isSelected, 1);
        ctx.uniform1f(program.uLoc.u_isInShadow, 0);

        ctx.lineWidth(2);
        ctx.drawElements(ctx.LINES, 24, UNSIGNED_INDEX_TYPE, 0);
        ctx.lineWidth(1);
      }
    },
  };
};
