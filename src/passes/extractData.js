/** @type {RenderingPass} */
export default (engine) => {
  const {math: {mat4, vec3, vec4, quat}, driver: { ctx, makeProgram, vert, frag, UNSIGNED_INDEX_TYPE }, camera, input, scene} = engine;

  const program = makeProgram(
    vert`
      attribute vec4 a_position;
  
      uniform mat4 u_mvp;
      
      varying vec4 v_coord;
      
      void main() {
        v_coord = gl_Position = u_mvp * a_position;
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

  const setupFramebufferTexture = () => {
    ctx.bindTexture(ctx.TEXTURE_2D, texture);
    // requires OES_texture_float
    ctx.texImage2D(ctx.TEXTURE_2D, 0, ctx.RGBA, ctx.canvas.width, ctx.canvas.height, 0, ctx.RGBA, ctx.FLOAT, null);
    ctx.bindRenderbuffer(ctx.RENDERBUFFER, renderbuffer);
    ctx.renderbufferStorage(ctx.RENDERBUFFER, ctx.DEPTH_COMPONENT16, ctx.canvas.width, ctx.canvas.height);
  };
  setupFramebufferTexture();

  engine.on('viewportresize', setupFramebufferTexture);

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
      if (!scene.hoveredInstance.id.int) {
        mat4.getTranslation(translation, engine.camera.world);
        vec3.rotateX(negativeEye, translation, v3zero, -engine.camera.pitch);
        vec3.rotateY(negativeEye, negativeEye, v3zero, -engine.camera.yaw);

        vec3.scale(eye, negativeEye, -1);

        vec3.set(eyeNormal, 2 * input.position[0] / ctx.canvas.width - 1, 1 - 2 * input.position[1] / ctx.canvas.height, -1);
        vec3.multiply(eyeNormal, eyeNormal, camera.inverseFovScaling);
        vec3.rotateX(eyeNormal, eyeNormal, v3zero, -engine.camera.pitch);
        vec3.rotateY(eyeNormal, eyeNormal, v3zero, -engine.camera.yaw);
        vec3.normalize(eyeNormal, eyeNormal);
        
        let dot = 0, normal = scene.axisNormal;
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

      const model_trs = mat4.clone(scene.hoveredInstance.globalTrs);
      const mvp = mat4.clone(camera.mvp);
      mat4.multiply(mvp, mvp, model_trs);

      ctx.enableVertexAttribArray(program.aLoc.a_position);
      ctx.vertexAttribPointer(program.aLoc.a_position, 3, ctx.FLOAT, false, 0, 0);
      ctx.uniformMatrix4fv(program.uLoc.u_mvp, false, mvp);

      ctx.bindBuffer(ctx.ELEMENT_ARRAY_BUFFER, scene.hoveredInstance.model.buffer.index);
      ctx.drawElements(ctx.TRIANGLES, scene.hoveredInstance.model.data.index.length, UNSIGNED_INDEX_TYPE, 0);
      // requires OES_texture_float
      ctx.readPixels(input.position[0], ctx.canvas.height - input.position[1] - 1, 1, 1, ctx.RGBA, ctx.FLOAT, coords);

      scene.hover(coords);
    },
  };
};
