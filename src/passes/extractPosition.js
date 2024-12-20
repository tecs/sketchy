const { vec3 } = glMatrix;

/** @type {RenderingPass} */
export default (engine) => {
  const {
    driver: { ctx, makeProgram, vert, frag, framebuffer },
    camera,
    scene,
    tools,
  } = engine;

  const program = makeProgram(
    vert`#version 300 es
      in vec4 a_position;

      uniform mat4 u_trs;
      uniform mat4 u_viewProjection;
      uniform mat4 u_frustum;

      out vec4 v_coord;

      void main() {
        v_coord = u_trs * a_position;
        gl_Position = u_frustum * v_coord;
        gl_PointSize = 10.0;
      }
    `,
    frag`#version 300 es
      precision mediump float;

      in vec4 v_coord;

      out vec4 outCoords;

      void main() {
        outCoords = v_coord;
      }
    `,
  );

  const fb = framebuffer(ctx.FLOAT);

  // cached structures
  // this needs 1 extra component for the alpha channel when reading from the framebuffer,
  // which can safely be ignored in all vec3 operations
  const coords = /** @type {vec3} */ (new Float32Array(4));
  const planes = [
    vec3.fromValues(1, 0, 0),
    vec3.fromValues(0, 1, 0),
    vec3.fromValues(0, 0, 1),
    vec3.fromValues(-1, 0, 0),
    vec3.fromValues(0, -1, 0),
    vec3.fromValues(0, 0, -1),
  ];
  const tempNormal = vec3.create();

  return {
    program,
    render(extract) {
      if (!extract || tools.isActive('orbit')) return;

      const model = scene.hoveredInstance?.body.currentModel;

      if (!model) {
        const { axisNormal, currentInstance: { Placement: placement }} = scene;
        const { eye, eyeNormal } = camera;
        let dot = 0;
        let normal = axisNormal;
        vec3.transformQuat(tempNormal, camera.eyeNormal, placement.inverseRotation);
        for (const plane of planes) {
          const planeDot = vec3.dot(tempNormal, plane);
          if (planeDot >= dot) continue;
          dot = planeDot;
          normal = plane;
        }
        if (normal !== axisNormal) {
          vec3.transformQuat(tempNormal, normal, placement.rotation);
          scene.setAxis(tempNormal);
        }

        const offsetAlongPlaneNormal = vec3.dot(placement.translation, axisNormal);
        const distanceToPlane = -(vec3.dot(axisNormal, eye) - offsetAlongPlaneNormal) / dot;
        vec3.scaleAndAdd(coords, eye, eyeNormal, distanceToPlane);
        scene.hover(coords);
        return;
      }

      ctx.bindFramebuffer(ctx.FRAMEBUFFER, fb);
      ctx.clear(ctx.COLOR_BUFFER_BIT | ctx.DEPTH_BUFFER_BIT);

      ctx.uniformMatrix4fv(program.uLoc.u_trs, false, scene.hoveredInstance.Placement.trs);
      ctx.uniformMatrix4fv(program.uLoc.u_viewProjection, false, camera.viewProjection);
      ctx.uniformMatrix4fv(program.uLoc.u_frustum, false, camera.frustum);

      // Geometry
      ctx.enableVertexAttribArray(program.aLoc.a_position);
      ctx.bindBuffer(ctx.ARRAY_BUFFER, model.buffer.vertex);
      ctx.vertexAttribPointer(program.aLoc.a_position, 3, ctx.FLOAT, false, 0, 0);

      ctx.bindBuffer(ctx.ELEMENT_ARRAY_BUFFER, model.buffer.index);
      ctx.drawElements(ctx.TRIANGLES, model.bufferData.index.length, ctx.UNSIGNED_INT, 0);

      // Lines
      ctx.enableVertexAttribArray(program.aLoc.a_position);
      ctx.bindBuffer(ctx.ARRAY_BUFFER, model.buffer.lineVertex);
      ctx.vertexAttribPointer(program.aLoc.a_position, 3, ctx.FLOAT, false, 0, 0);

      ctx.bindBuffer(ctx.ELEMENT_ARRAY_BUFFER, model.buffer.lineIndex);
      ctx.lineWidth(5);
      ctx.drawElements(ctx.LINES, model.bufferData.lineIndex.length, ctx.UNSIGNED_INT, 0);
      ctx.lineWidth(1);

      // Points
      ctx.drawArrays(ctx.POINTS, 0, model.bufferData.lineVertex.length / 3);

      ctx.readPixels(0, 0, 1, 1, ctx.RGBA, ctx.FLOAT, coords);

      scene.hover(coords);
    },
  };
};
