import Body from '../engine/cad/body.js';
import Sketch from '../engine/cad/sketch.js';
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
      in vec4 a_startingCoord;
      in float a_isSupport;

      uniform mat4 u_trs;
      uniform mat4 u_viewProjection;
      uniform vec3 u_baseColor;
      uniform vec2 u_screenSize;
      uniform float u_isSelected;
      uniform float u_isInShadow;
      uniform float u_isHovered;
      uniform float u_isEntered;

      out float v_distance;
      out vec4 v_color;

      vec2 calculateFragmentPosition(vec4 vertex) {
        return u_screenSize * (1.0 + vertex.xy / vertex.w) * 0.5;
      }

      void main() {
        gl_Position = u_viewProjection * u_trs * a_position;
        v_color = vec4(u_baseColor, 1.0);
        v_color.b += u_isSelected;
        v_color.g += a_isSupport * 0.5 - u_isSelected;

        // Darken non-selected instance
        v_color.rgb *= max(1.0 - u_isInShadow, 0.2);
        v_color.rgb += u_isInShadow * 0.3 + u_isHovered;

        // offset the coord a tiny bit towards the camera
        // so that lines at concave edges render in front
        // of the object's faces
        gl_Position.z -= 0.00001;

        vec2 vertexFragment = calculateFragmentPosition(gl_Position);
        vec2 originFragment = calculateFragmentPosition(u_viewProjection * u_trs * a_startingCoord);

        v_distance = mix(distance(vertexFragment, originFragment) * 0.5, 1.5, max(a_isSupport - u_isEntered, 0.0));
        v_distance *= 1.0 - u_isHovered;
      }
    `,
    frag`#version 300 es
      precision mediump float;

      in float v_distance;
      in vec4 v_color;

      out vec4 outColor;

      void main() {
        float field = sin(v_distance);
        float dotField = step(0.0, field) * smoothstep(0.0, 0.1, field) * 0.8;

        if (dotField > 0.5) discard;

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

  const boundingBoxSupportBuffer = buffer(new Float32Array(24));

  const baseColor = vec3.create();

  const boundingBoxVertexBuffer = ctx.createBuffer();

  return {
    program,
    render() {
      const { enteredInstance, hoveredInstance, hoveredLineId, currentStep } = scene;
      const selectedLines = selection.getByType('line');
      const selectedInstances = selection.getByType('instance').map(({ instance }) => instance);

      const drawnLine = tools.isActive('line') ? edited.getByType('line').pop() : undefined;

      const currentlySketching = currentStep instanceof Sketch;

      const screenSize = camera.screenResolution.subarray(0, 2);
      ctx.uniform2fv(program.uLoc.u_screenSize, screenSize);

      const bodies = entities.values(Body);
      for (const { currentModel: model, instances } of bodies) {
        if (!model) continue;

        ctx.bindBuffer(ctx.ELEMENT_ARRAY_BUFFER, model.buffer.lineIndex);

        ctx.bindBuffer(ctx.ARRAY_BUFFER, model.buffer.lineVertex);
        ctx.enableVertexAttribArray(program.aLoc.a_position);
        ctx.vertexAttribPointer(program.aLoc.a_position, 3, ctx.FLOAT, false, 0, 0);

        ctx.bindBuffer(ctx.ARRAY_BUFFER, model.buffer.startingVertex);
        ctx.enableVertexAttribArray(program.aLoc.a_startingCoord);
        ctx.vertexAttribPointer(program.aLoc.a_startingCoord, 3, ctx.FLOAT, false, 0, 0);

        ctx.bindBuffer(ctx.ARRAY_BUFFER, model.buffer.lineSupports);
        ctx.enableVertexAttribArray(program.aLoc.a_isSupport);
        ctx.vertexAttribPointer(program.aLoc.a_isSupport, 1, ctx.FLOAT, false, 0, 0);

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
          ctx.uniform1f(program.uLoc.u_isEntered, currentlySketching && enteredInstance === instance ? 1 : 0);

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
          const isVisible = scene.isVisible(selectedInstance);

          ctx.bindBuffer(ctx.ELEMENT_ARRAY_BUFFER, boundingBoxIndexBuffer);

          ctx.bindBuffer(ctx.ARRAY_BUFFER, boundingBoxVertexBuffer);
          ctx.bufferData(ctx.ARRAY_BUFFER, body.BoundingBox.data, ctx.DYNAMIC_DRAW);
          ctx.enableVertexAttribArray(program.aLoc.a_position);
          ctx.vertexAttribPointer(program.aLoc.a_position, 3, ctx.FLOAT, false, 0, 0);

          ctx.enableVertexAttribArray(program.aLoc.a_startingCoord);
          ctx.vertexAttribPointer(program.aLoc.a_startingCoord, 3, ctx.FLOAT, false, 0, 0);

          ctx.bindBuffer(ctx.ARRAY_BUFFER, boundingBoxSupportBuffer);
          ctx.enableVertexAttribArray(program.aLoc.a_isSupport);
          ctx.vertexAttribPointer(program.aLoc.a_isSupport, 1, ctx.FLOAT, false, 0, 0);

          ctx.uniformMatrix4fv(program.uLoc.u_trs, false, trs);
          ctx.uniform1f(program.uLoc.u_isSelected, 1);
          ctx.uniform1f(program.uLoc.u_isInShadow, isVisible ? 0 : 1);
          ctx.uniform1f(program.uLoc.u_isHovered, 0);

          ctx.lineWidth(2);
          ctx.drawElements(ctx.LINES, 24, ctx.UNSIGNED_INT, 0);
          ctx.lineWidth(1);
        }
      }
    },
  };
};
