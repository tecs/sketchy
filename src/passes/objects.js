/** @type {RenderingPass} */
export default (engine) => {
  const {math: {mat4}, driver: { ctx, makeProgram, vert, frag, UNSIGNED_INDEX_TYPE }, camera, input, scene} = engine;

  const programs = {
    objects: makeProgram(
      vert`
        attribute vec4 a_position;
        attribute vec4 a_normal;
        attribute vec3 a_color;

        uniform mat4 u_mvp;
        uniform mat4 u_normalMvp;
        uniform vec4 u_instanceId;
        uniform vec4 u_selectedInstanceId;
        uniform float u_isInShadow;

        varying vec4 v_color;

        void main() {
          gl_Position = u_mvp * a_position;

          vec3 normal = normalize(vec3(u_normalMvp * a_normal));
          float lightAngle = abs(dot(normal, vec3(0, 0, 1)));
          float lightIntensity = 0.4 + smoothstep(0.3, 0.8, lightAngle) * 0.6;
          
          v_color = vec4(a_color, 1.0);
          
          if (u_isInShadow == 1.0) {
            v_color.rgb = v_color.rgb * 0.2 + 0.4;
          }

          v_color.rgb *= lightIntensity;

          // Highlight selected instance
          if (u_instanceId == u_selectedInstanceId && u_instanceId != vec4(0.0)) {
            v_color.rgb += vec3(0.1);
          }
        }
      `,
      frag`
        precision mediump float;

        varying vec4 v_color;

        void main() {
          gl_FragColor = v_color;
        }
      `,
    ),

    // Render lines
    lines: makeProgram(
      vert`
        attribute vec4 a_position;
    
        uniform mat4 u_mvp;
        uniform vec4 u_instanceId;
        uniform vec4 u_selectedInstanceId;
        uniform float u_isInShadow;

        varying vec4 v_color;
        
        void main() {
          gl_Position = u_mvp * a_position;
          v_color = vec4(0.0, 0.0, 0.0, 1.0);
          if (u_instanceId == u_selectedInstanceId && u_instanceId != vec4(0.0)) {
            v_color.b = 1.0;
          }

          if (u_isInShadow == 1.0) {
            v_color.rgb = v_color.rgb * 0.2 + 0.3;
          }

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
    ),

    // Object picking
    hover: makeProgram(
      vert`
        attribute vec4 a_position;
    
        uniform mat4 u_mvp;
        
        void main() {
          gl_Position = u_mvp * a_position;
        }
      `,
      frag`
        precision mediump float;
        
        uniform vec4 u_instanceId;
        
        void main() {
          gl_FragColor = u_instanceId;
        }
      `,
    ),
  };

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

  const readData = new Uint8Array(4);

  const setupFramebufferTexture = () => {
    ctx.bindTexture(ctx.TEXTURE_2D, texture);
    ctx.texImage2D(ctx.TEXTURE_2D, 0, ctx.RGBA, ctx.canvas.width, ctx.canvas.height, 0, ctx.RGBA, ctx.UNSIGNED_BYTE, null);
    ctx.bindRenderbuffer(ctx.RENDERBUFFER, renderbuffer);
    ctx.renderbufferStorage(ctx.RENDERBUFFER, ctx.DEPTH_COMPONENT16, ctx.canvas.width, ctx.canvas.height);
  };
  setupFramebufferTexture();

  engine.on('viewportresize', setupFramebufferTexture);

  /**
   * @param {"objects"|"lines"|"hover"} step 
  */
 const render = (step = 'objects') => {
    const program = programs[step];
    program.use();

    if (step === 'hover') {
      ctx.bindFramebuffer(ctx.FRAMEBUFFER, framebuffer);
      ctx.clear(ctx.COLOR_BUFFER_BIT | ctx.DEPTH_BUFFER_BIT);
    }

    for (const model of scene.models) {
      // Prevent self-picking when editing
      if (engine.state.drawing && step === 'hover' && scene.currentInstance.model === model) continue;
      
      if (step !== 'lines') {
        ctx.bindBuffer(ctx.ARRAY_BUFFER, model.buffer.vertex);
        ctx.enableVertexAttribArray(program.aLoc.a_position);
        ctx.vertexAttribPointer(program.aLoc.a_position, 3, ctx.FLOAT, false, 0, 0);
      }

      if (step === 'objects') {
        ctx.bindBuffer(ctx.ARRAY_BUFFER, model.buffer.normal);
        ctx.enableVertexAttribArray(program.aLoc.a_normal);
        ctx.vertexAttribPointer(program.aLoc.a_normal, 3, ctx.FLOAT, false, 0, 0);

        ctx.bindBuffer(ctx.ARRAY_BUFFER, model.buffer.color);
        ctx.enableVertexAttribArray(program.aLoc.a_color);
        ctx.vertexAttribPointer(program.aLoc.a_color, 3, ctx.UNSIGNED_BYTE, true, 0, 0);
      }

      for (const instance of scene.instancesByModel.get(model) ?? []) {
        const isInShadow = !instance.belongsTo(scene.currentInstance) ? 1 : 0;

        const model_trs = mat4.clone(instance.trs);
        const mvp = mat4.clone(camera.mvp);
        mat4.multiply(mvp, mvp, model_trs);
        ctx.uniformMatrix4fv(program.uLoc.u_mvp, false, mvp);

        ctx.uniform4fv(program.uLoc.u_instanceId, instance.id.vec4);

        if (step === 'objects') {
          const normalMvp = mat4.clone(camera.world);
          mat4.multiply(normalMvp, normalMvp, model_trs);
          mat4.transpose(normalMvp, normalMvp);
          mat4.invert(normalMvp, normalMvp);
          ctx.uniformMatrix4fv(program.uLoc.u_normalMvp, false, normalMvp);

          ctx.uniform1f(program.uLoc.u_isInShadow, isInShadow);
        }
        if (step !== 'hover') {
          ctx.uniform4fv(program.uLoc.u_selectedInstanceId, scene.selectedInstance.id.vec4);
        }

        if (step !== 'lines') {
          ctx.bindBuffer(ctx.ELEMENT_ARRAY_BUFFER, model.buffer.index);
          ctx.drawElements(ctx.TRIANGLES, model.data.index.length, UNSIGNED_INDEX_TYPE, 0);
        } else {
          if (instance !== scene.rootInstance && instance === scene.selectedInstance) {
            ctx.lineWidth(2);
            // Bounding box
            ctx.bindBuffer(ctx.ARRAY_BUFFER, model.buffer.boundingBoxVertex);
            ctx.enableVertexAttribArray(program.aLoc.a_position);
            ctx.vertexAttribPointer(program.aLoc.a_position, 3, ctx.FLOAT, false, 0, 0);
  
            ctx.bindBuffer(ctx.ELEMENT_ARRAY_BUFFER, model.buffer.boundingBoxIndex);
            ctx.drawElements(ctx.LINES, 24, UNSIGNED_INDEX_TYPE, 0);
          }

          ctx.uniform1f(program.uLoc.u_isInShadow, isInShadow);

          // Object lines
          ctx.bindBuffer(ctx.ARRAY_BUFFER, model.buffer.lineVertex);
          ctx.enableVertexAttribArray(program.aLoc.a_position);
          ctx.vertexAttribPointer(program.aLoc.a_position, 3, ctx.FLOAT, false, 0, 0);
          
          ctx.bindBuffer(ctx.ELEMENT_ARRAY_BUFFER, model.buffer.lineIndex);
          ctx.drawElements(ctx.LINES, model.data.lineIndex.length, UNSIGNED_INDEX_TYPE, 0);

          ctx.lineWidth(1);
        }
      }
    }

    switch (step) {
      case 'objects':
        render('lines'); // render lines
        break;

      case 'lines':
        render('hover'); // find hovered object
        break;

      case 'hover':
        ctx.readPixels(input.position[0], ctx.canvas.height - input.position[1] - 1, 1, 1, ctx.RGBA, ctx.UNSIGNED_BYTE, readData);
        scene.hoverOver(readData);
        break;
    }
  };

  return {
    program: programs.objects,
    render,
  };
};
