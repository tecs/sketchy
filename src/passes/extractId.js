import Body from '../engine/cad/body.js';
import Id from '../engine/general/id.js';

/** @type {RenderingPass} */
export default (engine) => {
  const {
    driver: { ctx, makeProgram, vert, frag, UNSIGNED_INDEX_TYPE, UNSIGNED_INDEX_SIZE },
    camera,
    entities,
    scene,
    tools,
  } = engine;

  const program = makeProgram(
    vert`
      attribute vec4 a_position;

      uniform mat4 u_trs;
      uniform mat4 u_viewProjection;
      uniform float u_offset;

      void main() {
        gl_Position = u_viewProjection * u_trs * a_position;
        gl_Position.z -= u_offset * 0.00001;
        gl_PointSize = 10.0;
      }
    `,
    frag`
      precision mediump float;

      uniform vec4 u_instanceId;

      void main() {
        gl_FragColor = u_instanceId;
      }
    `,
  );

  const texture = ctx.createTexture();
  ctx.bindTexture(ctx.TEXTURE_2D, texture);
  ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_MIN_FILTER, ctx.LINEAR);
  ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_WRAP_S, ctx.CLAMP_TO_EDGE);
  ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_WRAP_T, ctx.CLAMP_TO_EDGE);
  ctx.texImage2D(ctx.TEXTURE_2D, 0, ctx.RGBA, 1, 1, 0, ctx.RGBA, ctx.UNSIGNED_BYTE, null);

  const renderbuffer = ctx.createRenderbuffer();
  ctx.bindRenderbuffer(ctx.RENDERBUFFER, renderbuffer);
  ctx.renderbufferStorage(ctx.RENDERBUFFER, ctx.DEPTH_COMPONENT16, 1, 1);

  const framebuffer = ctx.createFramebuffer();
  ctx.bindFramebuffer(ctx.FRAMEBUFFER, framebuffer);
  ctx.framebufferTexture2D(ctx.FRAMEBUFFER, ctx.COLOR_ATTACHMENT0, ctx.TEXTURE_2D, texture, 0);
  ctx.framebufferRenderbuffer(ctx.FRAMEBUFFER, ctx.DEPTH_ATTACHMENT, ctx.RENDERBUFFER, renderbuffer);

  const readData = new Uint8Array(4);

  return {
    program,
    render(_, extract) {
      if (!extract || tools.isActive('orbit')) return;

      ctx.bindFramebuffer(ctx.FRAMEBUFFER, framebuffer);
      ctx.clear(ctx.COLOR_BUFFER_BIT | ctx.DEPTH_BUFFER_BIT);

      const drawing = tools.isActive('line', 'rectangle', 'move');

      const bodies = entities.values(Body);
      for (const { currentModel: model, instances } of bodies) {
        // Prevent self-picking when editing
        if (!model || (drawing && scene.currentInstance.body.currentModel === model)) continue;

        ctx.bindBuffer(ctx.ELEMENT_ARRAY_BUFFER, model.buffer.index);

        ctx.bindBuffer(ctx.ARRAY_BUFFER, model.buffer.vertex);
        ctx.enableVertexAttribArray(program.aLoc.a_position);
        ctx.vertexAttribPointer(program.aLoc.a_position, 3, ctx.FLOAT, false, 0, 0);

        ctx.uniformMatrix4fv(program.uLoc.u_viewProjection, false, camera.frustum);

        // Geometry
        ctx.uniform1f(program.uLoc.u_offset, 0);
        for (const instance of instances) {
          ctx.uniformMatrix4fv(program.uLoc.u_trs, false, instance.Placement.trs);
          ctx.uniform4fv(program.uLoc.u_instanceId, instance.Id.vec4);

          ctx.drawElements(ctx.TRIANGLES, model.data.index.length, UNSIGNED_INDEX_TYPE, 0);
        }

        // Lines
        ctx.uniform1f(program.uLoc.u_offset, 1);
        ctx.bindBuffer(ctx.ELEMENT_ARRAY_BUFFER, model.buffer.lineIndex);
        ctx.lineWidth(5);
        for (const instance of instances) {
          ctx.uniformMatrix4fv(program.uLoc.u_trs, false, instance.Placement.trs);
          ctx.uniform4fv(program.uLoc.u_instanceId, instance.Id.vec4);

          ctx.drawElements(ctx.LINES, model.data.lineIndex.length, UNSIGNED_INDEX_TYPE, 0);
        }
        ctx.lineWidth(1);

        // Points
        ctx.uniform1f(program.uLoc.u_offset, 2);
        for (const instance of instances) {
          ctx.uniformMatrix4fv(program.uLoc.u_trs, false, instance.Placement.trs);
          ctx.uniform4fv(program.uLoc.u_instanceId, instance.Id.vec4);

          ctx.drawArrays(ctx.POINTS, 0, model.data.vertex.length / 3);
        }
      }

      ctx.readPixels(0, 0, 1, 1, ctx.RGBA, ctx.UNSIGNED_BYTE, readData);
      scene.hoverOver(readData);

      const instance = scene.hoveredInstance;
      const model = instance?.body.currentModel;
      if (!model || drawing) return;

      ctx.clear(ctx.COLOR_BUFFER_BIT | ctx.DEPTH_BUFFER_BIT);

      ctx.uniformMatrix4fv(program.uLoc.u_viewProjection, false, camera.frustum);
      ctx.uniformMatrix4fv(program.uLoc.u_trs, false, instance.Placement.trs);

      ctx.bindBuffer(ctx.ARRAY_BUFFER, model.buffer.vertex);
      ctx.enableVertexAttribArray(program.aLoc.a_position);
      ctx.vertexAttribPointer(program.aLoc.a_position, 3, ctx.FLOAT, false, 0, 0);

      // Geometry
      ctx.uniform1f(program.uLoc.u_offset, 0);

      ctx.bindBuffer(ctx.ELEMENT_ARRAY_BUFFER, model.buffer.index);
      ctx.uniform4fv(program.uLoc.u_instanceId, Id.intToVec4(0));

      ctx.drawElements(ctx.TRIANGLES, model.data.index.length, UNSIGNED_INDEX_TYPE, 0);

      // Lines
      ctx.uniform1f(program.uLoc.u_offset, 1);

      ctx.bindBuffer(ctx.ELEMENT_ARRAY_BUFFER, model.buffer.lineIndex);

      ctx.lineWidth(5);
      ctx.drawElements(ctx.LINES, model.data.lineIndex.length, UNSIGNED_INDEX_TYPE, 0);
      ctx.lineWidth(1);

      // Points
      ctx.uniform1f(program.uLoc.u_offset, 2);

      for (let i = 0; i < model.data.vertex.length / 3; ++i) {
        ctx.uniform4fv(program.uLoc.u_instanceId, Id.intToVec4(i + 1));
        ctx.drawArrays(ctx.POINTS, i, 1);
      }

      ctx.readPixels(0, 0, 1, 1, ctx.RGBA, ctx.UNSIGNED_BYTE, readData);
      scene.hoverPoint(readData);
      if (scene.hoveredPointIndex) return;

      ctx.clear(ctx.COLOR_BUFFER_BIT | ctx.DEPTH_BUFFER_BIT);

      // Geometry
      ctx.uniform1f(program.uLoc.u_offset, 0);

      ctx.bindBuffer(ctx.ELEMENT_ARRAY_BUFFER, model.buffer.index);
      ctx.uniform4fv(program.uLoc.u_instanceId, Id.intToVec4(0));

      ctx.drawElements(ctx.TRIANGLES, model.data.index.length, UNSIGNED_INDEX_TYPE, 0);

      // Lines
      ctx.uniform1f(program.uLoc.u_offset, 1);

      ctx.bindBuffer(ctx.ELEMENT_ARRAY_BUFFER, model.buffer.lineIndex);

      ctx.lineWidth(5);
      for (let i = 0; i < model.data.lineIndex.length / 2; ++i) {
        ctx.uniform4fv(program.uLoc.u_instanceId, Id.intToVec4(i + 1));
        ctx.drawElements(ctx.LINES, 2, UNSIGNED_INDEX_TYPE, i * UNSIGNED_INDEX_SIZE);
      }
      ctx.lineWidth(1);

      ctx.readPixels(0, 0, 1, 1, ctx.RGBA, ctx.UNSIGNED_BYTE, readData);
      scene.hoverLine(readData);
    },
  };
};
