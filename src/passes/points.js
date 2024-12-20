import Sketch from '../engine/cad/sketch.js';

/** @type {RenderingPass} */
export default (engine) => {
  const {
    driver: { ctx, makeProgram, vert, frag },
    camera,
    editor: { selection },
    scene,
  } = engine;

  const program = makeProgram(
    vert`#version 300 es
      in vec4 a_position;

      uniform mat4 u_trs;
      uniform mat4 u_viewProjection;
      uniform float u_isSelected;
      uniform float u_isHovered;

      out vec4 v_color;

      void main() {
        gl_Position = u_viewProjection * u_trs * a_position;
        v_color = vec4(0.0, 0.0, u_isSelected, 1.0);
        v_color.rgb += u_isHovered;

        // offset the coord a tiny bit towards the camera
        // so that lines at concave edges render in front
        // of the object's faces
        gl_Position.z -= 0.00002;
        gl_PointSize = 5.0 + u_isHovered * 5.0;
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

  return {
    program,
    render() {
      const { enteredInstance, hoveredInstance, hoveredPointId } = scene;
      const pointIsHovered = hoveredPointId !== null && enteredInstance === hoveredInstance;
      const sketch = scene.currentStep;

      const selectedPointIds = selection.getByType('point').map(({ id }) => id);
      if (!selectedPointIds.length && !pointIsHovered && !(sketch instanceof Sketch)) return;

      const model = enteredInstance?.body.currentModel;
      if (!model) return;

      ctx.bindBuffer(ctx.ARRAY_BUFFER, model.buffer.lineVertex);
      ctx.enableVertexAttribArray(program.aLoc.a_position);
      ctx.vertexAttribPointer(program.aLoc.a_position, 3, ctx.FLOAT, false, 0, 0);

      ctx.uniformMatrix4fv(program.uLoc.u_viewProjection, false, camera.viewProjection);

      ctx.uniformMatrix4fv(program.uLoc.u_trs, false, enteredInstance.Placement.trs);

      if (pointIsHovered) {
        const index = model.bufferData.pointIds.indexOf(hoveredPointId);
        ctx.uniform1f(program.uLoc.u_isSelected, 0);
        ctx.uniform1f(program.uLoc.u_isHovered, 1);
        ctx.drawArrays(ctx.POINTS, index, 1);
        ctx.uniform1f(program.uLoc.u_isHovered, 0);
        ctx.drawArrays(ctx.POINTS, index, 1);
      }
      if (sketch instanceof Sketch) {
        ctx.uniform1f(program.uLoc.u_isSelected, 0);
        ctx.uniform1f(program.uLoc.u_isHovered, 0);
        ctx.drawArrays(ctx.POINTS, 0, model.bufferData.lineVertex.length / 3);
      }
      if (selectedPointIds.length) {
        ctx.uniform1f(program.uLoc.u_isSelected, 1);
        ctx.uniform1f(program.uLoc.u_isHovered, 0);
        for (const pointId of selectedPointIds) {
          const index = model.bufferData.pointIds.indexOf(pointId);
          ctx.drawArrays(ctx.POINTS, index, 1);
        }
      }
    },
  };
};
