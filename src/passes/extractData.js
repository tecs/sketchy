/** @type {RenderingPass} */
export default (engine) => {
  const {
    math: { mat4, vec3 },
    driver: { ctx, makeProgram, vert, frag, UNSIGNED_INDEX_TYPE },
    camera,
    input,
    scene,
  } = engine;

  const program = makeProgram(
    vert`
      attribute vec4 a_position;

      uniform mat4 u_trs;
      uniform mat4 u_viewProjection;
      uniform mat4 u_frustum;

      varying vec4 v_coord;

      void main() {
        vec4 worldPosition = u_trs * a_position;
        gl_Position = u_frustum * worldPosition;
        v_coord = u_viewProjection * worldPosition;
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
  const coords = new Float32Array(4);
  const planes = [
    vec3.fromValues(1, 0, 0),
    vec3.fromValues(0, 1, 0),
    vec3.fromValues(0, 0, 1),
    vec3.fromValues(-1, 0, 0),
    vec3.fromValues(0, -1, 0),
    vec3.fromValues(0, 0, -1),
  ];

  const translation = vec3.create();
  const eye = vec3.create();
  const negativeEye = vec3.create();
  const eyeNormal = vec3.create();
  const v3zero = vec3.create();

  return {
    program,
    render() {
      if (!scene.hoveredInstance) {
        mat4.getTranslation(translation, engine.camera.world);
        vec3.rotateX(negativeEye, translation, v3zero, -engine.camera.pitch);
        vec3.rotateY(negativeEye, negativeEye, v3zero, -engine.camera.yaw);

        vec3.scale(eye, negativeEye, -1);

        const x = (2 * input.position[0]) / ctx.canvas.width - 1;
        const y = 1 - (2 * input.position[1]) / ctx.canvas.height;
        vec3.set(eyeNormal, x, y, -1);
        vec3.multiply(eyeNormal, eyeNormal, camera.inverseFovScaling);
        vec3.rotateX(eyeNormal, eyeNormal, v3zero, -engine.camera.pitch);
        vec3.rotateY(eyeNormal, eyeNormal, v3zero, -engine.camera.yaw);
        vec3.normalize(eyeNormal, eyeNormal);

        let dot = 0;
        let normal = scene.axisNormal;
        for (const plane of planes) {
          const planeDot = vec3.dot(eyeNormal, plane);
          if (dot >= planeDot) continue;
          dot = planeDot;
          normal = plane;
        }
        scene.setAxis(normal);

        const s = vec3.dot(normal, negativeEye) / dot;
        vec3.scaleAndAdd(coords, eye, eyeNormal, s);
        coords[3] = 1;

        scene.hoverGlobal(coords);
        return;
      }

      ctx.bindFramebuffer(ctx.FRAMEBUFFER, framebuffer);
      ctx.clear(ctx.COLOR_BUFFER_BIT | ctx.DEPTH_BUFFER_BIT);

      ctx.bindBuffer(ctx.ARRAY_BUFFER, scene.hoveredInstance.model.buffer.vertex);

      ctx.enableVertexAttribArray(program.aLoc.a_position);
      ctx.vertexAttribPointer(program.aLoc.a_position, 3, ctx.FLOAT, false, 0, 0);
      ctx.uniformMatrix4fv(program.uLoc.u_trs, false, scene.hoveredInstance.globalTrs);
      ctx.uniformMatrix4fv(program.uLoc.u_viewProjection, false, camera.viewProjection);
      ctx.uniformMatrix4fv(program.uLoc.u_frustum, false, camera.frustum);

      ctx.bindBuffer(ctx.ELEMENT_ARRAY_BUFFER, scene.hoveredInstance.model.buffer.index);
      ctx.drawElements(ctx.TRIANGLES, scene.hoveredInstance.model.data.index.length, UNSIGNED_INDEX_TYPE, 0);

      // requires OES_texture_float
      ctx.readPixels(0, 0, 1, 1, ctx.RGBA, ctx.FLOAT, coords);

      scene.hover(coords);
    },
  };
};
