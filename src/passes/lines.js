import Body from '../engine/cad/body.js';
import SubInstance from '../engine/cad/subinstance.js';

/** @type {RenderingPass} */
export default (engine) => {
  const {
    driver: { ctx, makeProgram, vert, frag, UintIndexArray, UNSIGNED_INDEX_TYPE, UNSIGNED_INDEX_SIZE },
    camera,
    entities,
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

  const boundingBoxIndex = new UintIndexArray([
    // Bottom
    0, 1, // BFL - BRL
    1, 2, // BRL - BRR
    2, 3, // BRR - BBL
    3, 0, // BFR - BFL
    // Top
    4, 5, // TFL - TRL
    5, 6, // TRL - TRR
    6, 7, // TRR - TFR
    7, 4, // TFR - TFL
    // Side
    0, 4, // BFL - TFL
    1, 5, // BRL - TRL
    2, 6, // BRR - TRR
    3, 7, // BFR - TFR
  ]);
  const boundingBoxVertexBuffer = ctx.createBuffer();
  const boundingBoxIndexBuffer = ctx.createBuffer();
  ctx.bindBuffer(ctx.ELEMENT_ARRAY_BUFFER, boundingBoxIndexBuffer);
  ctx.bufferData(ctx.ELEMENT_ARRAY_BUFFER, boundingBoxIndex, ctx.STATIC_DRAW);

  return {
    program,
    render(draw) {
      if (!draw) return;

      const bodies = entities.values(Body);
      for (const { currentModel: model, instances } of bodies) {
        if (!model) continue;

        ctx.bindBuffer(ctx.ELEMENT_ARRAY_BUFFER, model.buffer.lineIndex);

        ctx.bindBuffer(ctx.ARRAY_BUFFER, model.buffer.vertex);
        ctx.enableVertexAttribArray(program.aLoc.a_position);
        ctx.vertexAttribPointer(program.aLoc.a_position, 3, ctx.FLOAT, false, 0, 0);

        ctx.uniformMatrix4fv(program.uLoc.u_viewProjection, false, camera.viewProjection);

        for (const instance of instances) {
          const isSelected = scene.selectedInstance && SubInstance.belongsTo(instance, scene.selectedInstance) ? 1 : 0;
          const isInShadow = !isSelected && !SubInstance.belongsTo(instance, scene.enteredInstance) ? 1 : 0;
          const selectedIndex = scene.enteredInstance === instance ? scene.selectedLineIndex : 0;

          ctx.uniformMatrix4fv(program.uLoc.u_trs, false, instance.Placement.trs);
          ctx.uniform1f(program.uLoc.u_isSelected, isSelected);
          ctx.uniform1f(program.uLoc.u_isInShadow, isInShadow);

          if (isSelected) ctx.lineWidth(2);

          ctx.drawElements(ctx.LINES, model.data.lineIndex.length, UNSIGNED_INDEX_TYPE, 0);
          if (selectedIndex) {
            ctx.uniform1f(program.uLoc.u_isSelected, 1);
            ctx.lineWidth(2);
            ctx.drawElements(ctx.LINES, 2, UNSIGNED_INDEX_TYPE, (selectedIndex - 1) * UNSIGNED_INDEX_SIZE);
          }
          ctx.lineWidth(1);
        }
      }

      // Draw bounding box of selected instance
      if (scene.selectedInstance?.body.currentModel) {
        const { body, Placement: { trs } } = scene.selectedInstance;

        ctx.bindBuffer(ctx.ELEMENT_ARRAY_BUFFER, boundingBoxIndexBuffer);

        ctx.bindBuffer(ctx.ARRAY_BUFFER, boundingBoxVertexBuffer);
        ctx.bufferData(ctx.ARRAY_BUFFER, body.BoundingBox.data, ctx.DYNAMIC_DRAW);
        ctx.enableVertexAttribArray(program.aLoc.a_position);
        ctx.vertexAttribPointer(program.aLoc.a_position, 3, ctx.FLOAT, false, 0, 0);

        ctx.uniformMatrix4fv(program.uLoc.u_trs, false, trs);
        ctx.uniform1f(program.uLoc.u_isSelected, 1);
        ctx.uniform1f(program.uLoc.u_isInShadow, 0);

        ctx.lineWidth(2);
        ctx.drawElements(ctx.LINES, 24, UNSIGNED_INDEX_TYPE, 0);
        ctx.lineWidth(1);
      }
    },
  };
};
