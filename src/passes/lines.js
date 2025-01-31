import Body from '../engine/cad/body.js';
import SubInstance from '../engine/cad/subinstance.js';

const { vec3 } = glMatrix;

/** @type {RenderingPass} */
export default (engine) => {
  const {
    driver: { ctx, makeProgram, vert, frag, buffer },
    camera,
    editor: { selection, edited },
    entities,
    scene,
    tools,
  } = engine;

  const program = makeProgram(
    vert`#version 300 es
      in vec4 a_position;

      uniform mat4 u_trs;
      uniform mat4 u_viewProjection;
      uniform vec3 u_baseColor;
      uniform float u_isSelected;
      uniform float u_isInShadow;
      uniform float u_isHovered;

      out vec4 v_color;

      void main() {
        gl_Position = u_viewProjection * u_trs * a_position;
        v_color = vec4(u_baseColor, 1.0);
        v_color.b += u_isSelected;

        // Darken non-selected instance
        v_color.rgb *= max(1.0 - u_isInShadow, 0.2);
        v_color.rgb += u_isInShadow * 0.3 + u_isHovered;

        // offset the coord a tiny bit towards the camera
        // so that lines at concave edges render in front
        // of the object's faces
        gl_Position.z -= 0.00001;
      }
    `,
    frag`#version 300 es
      precision mediump float;

      in vec4 v_color;
      out vec4 outColor;

      void main() {
        outColor = v_color;
      }
    `,
  );

  const boundingBoxIndexBuffer = buffer(new Uint32Array([
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
  ]));

  const baseColor = vec3.create();

  const boundingBoxVertexBuffer = ctx.createBuffer();

  return {
    program,
    render() {
      const { enteredInstance, hoveredInstance, hoveredLineId } = scene;
      const selectedLines = selection.getByType('line');
      const selectedInstances = selection.getByType('instance').map(({ instance }) => instance);

      const drawnLine = tools.isActive('line') ? edited.getByType('line').pop() : undefined;

      const bodies = entities.values(Body);
      for (const { currentModel: model, instances } of bodies) {
        if (!model) continue;

        ctx.bindBuffer(ctx.ELEMENT_ARRAY_BUFFER, model.buffer.lineIndex);

        ctx.bindBuffer(ctx.ARRAY_BUFFER, model.buffer.lineVertex);
        ctx.enableVertexAttribArray(program.aLoc.a_position);
        ctx.vertexAttribPointer(program.aLoc.a_position, 3, ctx.FLOAT, false, 0, 0);

        ctx.uniformMatrix4fv(program.uLoc.u_viewProjection, false, camera.viewProjection);

        ctx.uniform3fv(program.uLoc.u_baseColor, baseColor);

        for (const instance of instances) {
          if (!scene.isVisible(instance)) continue;

          const isSelected = selectedInstances.some(inst => SubInstance.belongsTo(instance, inst)) ? 1 : 0;
          const isInShadow = !isSelected && !SubInstance.belongsTo(instance, enteredInstance) ? 1 : 0;
          const hoveredIndex = enteredInstance === instance && hoveredInstance === instance ? hoveredLineId : null;

          ctx.uniformMatrix4fv(program.uLoc.u_trs, false, instance.Placement.trs);
          ctx.uniform1f(program.uLoc.u_isSelected, isSelected);
          ctx.uniform1f(program.uLoc.u_isInShadow, isInShadow);

          if (hoveredIndex !== null) {
            ctx.uniform1f(program.uLoc.u_isHovered, 1);
            ctx.lineWidth(5);
            ctx.drawElements(ctx.LINES, 2, ctx.UNSIGNED_INT, (hoveredIndex - 1) * 8);
            ctx.uniform1f(program.uLoc.u_isHovered, 0);
          }
          if (drawnLine?.instance === instance && scene.axisAlignedNormal) {
            ctx.uniform3fv(program.uLoc.u_baseColor, scene.axisAlignedNormal);
            ctx.lineWidth(5);
            ctx.drawElements(ctx.LINES, 2, ctx.UNSIGNED_INT, (drawnLine.id - 1) * 8);
            ctx.uniform3fv(program.uLoc.u_baseColor, baseColor);
          }

          ctx.lineWidth(1 + isSelected);
          ctx.drawElements(ctx.LINES, model.bufferData.lineIndex.length, ctx.UNSIGNED_INT, 0);

          const instanceLines = selectedLines.filter(el => el.instance === instance);
          if (instanceLines.length) {
            ctx.uniform1f(program.uLoc.u_isSelected, 1);
            ctx.lineWidth(2);
            for (const selectedLine of instanceLines) {
              ctx.drawElements(ctx.LINES, 2, ctx.UNSIGNED_INT, (selectedLine.id - 1) * 8);
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
          ctx.uniform1f(program.uLoc.u_isInShadow, selectedInstance.State.visibility ? 0 : 1);
          ctx.uniform1f(program.uLoc.u_isHovered, 0);

          ctx.lineWidth(2);
          ctx.drawElements(ctx.LINES, 24, ctx.UNSIGNED_INT, 0);
          ctx.lineWidth(1);
        }
      }
    },
  };
};
