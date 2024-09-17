import Body from '../engine/cad/body.js';
import SubInstance from '../engine/cad/subinstance.js';

/** @type {RenderingPass} */
export default (engine) => {
  const {
    driver: { ctx, makeProgram, vert, frag, UintIndexArray, UNSIGNED_INDEX_TYPE, UNSIGNED_INDEX_SIZE },
    camera,
    editor: { selection },
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
      uniform float u_isHovered;

      varying vec4 v_color;

      void main() {
        gl_Position = u_viewProjection * u_trs * a_position;
        v_color = vec4(0.0, 0.0, u_isSelected, 1.0);

        // Darken non-selected instance
        v_color.rgb *= max(1.0 - u_isInShadow, 0.2);
        v_color.rgb += u_isInShadow * 0.3 + u_isHovered;

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
    render() {
      const { enteredInstance, hoveredInstance, hoveredLineIndex } = scene;
      const selectedLines = selection.getByType('line');
      const selectedInstances = selection.getByType('instance').map(({ instance }) => instance);

      const bodies = entities.values(Body);
      for (const { currentModel: model, instances } of bodies) {
        if (!model) continue;

        ctx.bindBuffer(ctx.ELEMENT_ARRAY_BUFFER, model.buffer.lineIndex);

        ctx.bindBuffer(ctx.ARRAY_BUFFER, model.buffer.vertex);
        ctx.enableVertexAttribArray(program.aLoc.a_position);
        ctx.vertexAttribPointer(program.aLoc.a_position, 3, ctx.FLOAT, false, 0, 0);

        ctx.uniformMatrix4fv(program.uLoc.u_viewProjection, false, camera.viewProjection);

        for (const instance of instances) {
          const isSelected = selectedInstances.some(inst => SubInstance.belongsTo(instance, inst)) ? 1 : 0;
          const isInShadow = !isSelected && !SubInstance.belongsTo(instance, enteredInstance) ? 1 : 0;
          const hoveredIndex = enteredInstance === instance && hoveredInstance === instance ? hoveredLineIndex : null;

          ctx.uniformMatrix4fv(program.uLoc.u_trs, false, instance.Placement.trs);
          ctx.uniform1f(program.uLoc.u_isSelected, isSelected);
          ctx.uniform1f(program.uLoc.u_isInShadow, isInShadow);

          if (hoveredIndex !== null) {
            ctx.uniform1f(program.uLoc.u_isHovered, 1);
            ctx.lineWidth(5);
            ctx.drawElements(ctx.LINES, 2, UNSIGNED_INDEX_TYPE, hoveredIndex * UNSIGNED_INDEX_SIZE);
            ctx.uniform1f(program.uLoc.u_isHovered, 0);
          }

          ctx.lineWidth(1 + isSelected);
          ctx.drawElements(ctx.LINES, model.data.lineIndex.length, UNSIGNED_INDEX_TYPE, 0);

          const instanceLines = selectedLines.filter(el => el.instance === instance);
          if (instanceLines.length) {
            ctx.uniform1f(program.uLoc.u_isSelected, 1);
            ctx.lineWidth(2);
            for (const selectedLine of instanceLines) {
              ctx.drawElements(ctx.LINES, 2, UNSIGNED_INDEX_TYPE, selectedLine.index * UNSIGNED_INDEX_SIZE);
            }
          }
        }
      }

      // Draw bounding box of selected instances
      for (const selectedInstance of selectedInstances) {
        if (selectedInstance.body.currentModel) {
          const { body, Placement: { trs } } = selectedInstance;

          ctx.bindBuffer(ctx.ELEMENT_ARRAY_BUFFER, boundingBoxIndexBuffer);

          ctx.bindBuffer(ctx.ARRAY_BUFFER, boundingBoxVertexBuffer);
          ctx.bufferData(ctx.ARRAY_BUFFER, body.BoundingBox.data, ctx.DYNAMIC_DRAW);
          ctx.enableVertexAttribArray(program.aLoc.a_position);
          ctx.vertexAttribPointer(program.aLoc.a_position, 3, ctx.FLOAT, false, 0, 0);

          ctx.uniformMatrix4fv(program.uLoc.u_trs, false, trs);
          ctx.uniform1f(program.uLoc.u_isSelected, 1);
          ctx.uniform1f(program.uLoc.u_isInShadow, 0);
          ctx.uniform1f(program.uLoc.u_isHovered, 0);

          ctx.lineWidth(2);
          ctx.drawElements(ctx.LINES, 24, UNSIGNED_INDEX_TYPE, 0);
          ctx.lineWidth(1);
        }
      }
    },
  };
};
