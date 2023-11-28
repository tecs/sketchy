/** @type {RenderingPass} */
export default (engine) => {
  const {
    math: { mat4 },
    driver: { ctx, makeProgram, vert, frag, UNSIGNED_INDEX_TYPE },
    camera,
    scene,
  } = engine;

  const program = makeProgram(
    vert`
      attribute vec4 a_position;
      attribute vec4 a_normal;
      attribute vec3 a_color;

      uniform mat4 u_trs;
      uniform mat4 u_viewProjection;
      uniform mat4 u_normalMvp;
      uniform float u_isSelected;
      uniform float u_isInShadow;

      varying vec4 v_color;

      void main() {
        gl_Position = u_viewProjection * u_trs * a_position;

        vec3 normal = normalize(vec3(u_normalMvp * a_normal));
        float lightAngle = abs(dot(normal, vec3(0, 0, 1)));
        float lightIntensity = 0.4 + smoothstep(0.3, 0.8, lightAngle) * 0.6;

        v_color = vec4(a_color, 1.0);

        // Darken non-selected instance
        v_color.rgb *= max(1.0 - u_isInShadow, 0.2);
        v_color.rgb += u_isInShadow * 0.4;

        // Shading
        v_color.rgb *= lightIntensity;

        // Highlight selected instance
        v_color.rgb += vec3(0.1 * u_isSelected);
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

  // cached structures
  const normalMvp = mat4.create();

  return {
    program,
    render(draw) {
      if (!draw) return;

      for (const model of scene.models) {
        ctx.bindBuffer(ctx.ELEMENT_ARRAY_BUFFER, model.buffer.index);

        ctx.bindBuffer(ctx.ARRAY_BUFFER, model.buffer.vertex);
        ctx.enableVertexAttribArray(program.aLoc.a_position);
        ctx.vertexAttribPointer(program.aLoc.a_position, 3, ctx.FLOAT, false, 0, 0);

        ctx.bindBuffer(ctx.ARRAY_BUFFER, model.buffer.normal);
        ctx.enableVertexAttribArray(program.aLoc.a_normal);
        ctx.vertexAttribPointer(program.aLoc.a_normal, 3, ctx.FLOAT, false, 0, 0);

        ctx.bindBuffer(ctx.ARRAY_BUFFER, model.buffer.color);
        ctx.enableVertexAttribArray(program.aLoc.a_color);
        ctx.vertexAttribPointer(program.aLoc.a_color, 3, ctx.UNSIGNED_BYTE, true, 0, 0);

        ctx.uniformMatrix4fv(program.uLoc.u_viewProjection, false, camera.viewProjection);

        for (const instance of model.instances) {
          const isSelected = scene.selectedInstance && instance.belongsTo(scene.selectedInstance) ? 1 : 0;
          const isInShadow = !isSelected && !instance.belongsTo(scene.currentInstance) ? 1 : 0;

          ctx.uniformMatrix4fv(program.uLoc.u_trs, false, instance.globalTrs);
          ctx.uniform1f(program.uLoc.u_isSelected, isSelected);
          ctx.uniform1f(program.uLoc.u_isInShadow, isInShadow);

          mat4.multiply(normalMvp, camera.world, instance.globalTrs);
          mat4.transpose(normalMvp, normalMvp);
          mat4.invert(normalMvp, normalMvp);
          ctx.uniformMatrix4fv(program.uLoc.u_normalMvp, false, normalMvp);

          ctx.drawElements(ctx.TRIANGLES, model.data.index.length, UNSIGNED_INDEX_TYPE, 0);
        }
      }
    },
  };
};
