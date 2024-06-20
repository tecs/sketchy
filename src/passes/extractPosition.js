const { vec3 } = glMatrix;

/** @type {RenderingPass} */
export default (engine) => {
  const {
    driver: { ctx, makeProgram, vert, frag, UNSIGNED_INDEX_TYPE },
    camera,
    scene,
    tools,
  } = engine;

  const program = makeProgram(
    vert`
      attribute vec4 a_position;

      uniform mat4 u_trs;
      uniform mat4 u_viewProjection;
      uniform mat4 u_frustum;

      varying vec4 v_coord;

      void main() {
        v_coord = u_trs * a_position;
        gl_Position = u_frustum * v_coord;
      }
    `,
    frag`
      precision mediump float;

      varying vec4 v_coord;

      void main() {
        gl_FragColor = v_coord;
      }
    `,
  );

  const texture = ctx.createTexture();
  ctx.bindTexture(ctx.TEXTURE_2D, texture);
  ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_MIN_FILTER, ctx.LINEAR);
  ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_WRAP_S, ctx.CLAMP_TO_EDGE);
  ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_WRAP_T, ctx.CLAMP_TO_EDGE);

  const renderbuffer = ctx.createRenderbuffer();
  ctx.bindRenderbuffer(ctx.RENDERBUFFER, renderbuffer);

  const framebuffer = ctx.createFramebuffer();
  ctx.bindFramebuffer(ctx.FRAMEBUFFER, framebuffer);

  ctx.framebufferTexture2D(ctx.FRAMEBUFFER, ctx.COLOR_ATTACHMENT0, ctx.TEXTURE_2D, texture, 0);
  ctx.framebufferRenderbuffer(ctx.FRAMEBUFFER, ctx.DEPTH_ATTACHMENT, ctx.RENDERBUFFER, renderbuffer);

  ctx.bindTexture(ctx.TEXTURE_2D, texture);
  ctx.texImage2D(ctx.TEXTURE_2D, 0, ctx.RGBA, 1, 1, 0, ctx.RGBA, ctx.FLOAT, null);
  ctx.bindRenderbuffer(ctx.RENDERBUFFER, renderbuffer);
  ctx.renderbufferStorage(ctx.RENDERBUFFER, ctx.DEPTH_COMPONENT16, 1, 1);

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

  return {
    program,
    render(_, extract) {
      if (!extract || tools.isActive('orbit')) return;

      if (!scene.hoveredInstance) {

        let dot = 0;
        let normal = scene.axisNormal;
        for (const plane of planes) {
          const planeDot = vec3.dot(camera.eyeNormal, plane);
          if (dot >= planeDot) continue;
          dot = planeDot;
          normal = plane;
        }
        scene.setAxis(normal);

        const distanceToPlane = -vec3.dot(normal, camera.eye) / dot;
        vec3.scaleAndAdd(coords, camera.eye, camera.eyeNormal, distanceToPlane);
        scene.hover(coords);
        return;
      }

      ctx.bindFramebuffer(ctx.FRAMEBUFFER, framebuffer);
      ctx.clear(ctx.COLOR_BUFFER_BIT | ctx.DEPTH_BUFFER_BIT);

      ctx.enableVertexAttribArray(program.aLoc.a_position);
      ctx.uniformMatrix4fv(program.uLoc.u_trs, false, scene.hoveredInstance.globalTrs);
      ctx.uniformMatrix4fv(program.uLoc.u_viewProjection, false, camera.viewProjection);
      ctx.uniformMatrix4fv(program.uLoc.u_frustum, false, camera.frustum);

      const { model } = scene.hoveredInstance;
      ctx.bindBuffer(ctx.ARRAY_BUFFER, model.buffer.vertex);
      ctx.vertexAttribPointer(program.aLoc.a_position, 3, ctx.FLOAT, false, 0, 0);
      ctx.bindBuffer(ctx.ELEMENT_ARRAY_BUFFER, model.buffer.index);
      ctx.drawElements(ctx.TRIANGLES, model.data.index.length, UNSIGNED_INDEX_TYPE, 0);

      ctx.bindBuffer(ctx.ARRAY_BUFFER, model.buffer.lineVertex);
      ctx.vertexAttribPointer(program.aLoc.a_position, 3, ctx.FLOAT, false, 0, 0);
      ctx.bindBuffer(ctx.ELEMENT_ARRAY_BUFFER, model.buffer.lineIndex);
      ctx.lineWidth(5);
      ctx.drawElements(ctx.LINES, model.data.lineIndex.length, UNSIGNED_INDEX_TYPE, 0);
      ctx.lineWidth(1);

      // requires OES_texture_float
      ctx.readPixels(0, 0, 1, 1, ctx.RGBA, ctx.FLOAT, coords);

      scene.hover(coords);
    },
  };
};
