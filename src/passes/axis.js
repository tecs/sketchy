import Sketch from '../engine/cad/sketch.js';

const { mat4, vec3 } = glMatrix;

/** @type {RenderingPass} */
export default (engine) => {
  const {
    driver: { ctx, makeProgram, vert, frag, buffer },
    camera,
    editor,
    scene,
  } = engine;

  const program = makeProgram(
    vert`#version 300 es
      precision mediump float;

      in vec4 a_position;
      in vec3 a_color;

      uniform mat4 u_matrix;
      uniform float u_hovered;

      out vec3 v_color;
      out float v_distance;

      void main() {
        gl_Position = u_matrix * a_position;
        gl_PointSize = 5.0 + u_hovered * 5.0;

        v_color = a_color;
        v_distance = a_position.x + a_position.y + a_position.z;
      }
    `,
    frag`#version 300 es
      precision mediump float;

      in vec3 v_color;
      in float v_distance;

      uniform vec3 u_origin;
      uniform float u_hovered;

      out vec4 outColor;

      void main() {
        vec2 centeredCoord = gl_FragCoord.xy - u_origin.xy;
        float isSolid = step(0.0, v_distance);
        float field = sin(length(centeredCoord));
        float dotField = step(0.0, field) * smoothstep(0.0, 0.1, field) * 0.8;
        outColor = mix(vec4(v_color, isSolid + (1.0 - isSolid) * dotField), vec4(1.0), u_hovered);
      }
    `,
  );

  const positionBuffer = buffer(new Float32Array([
    -1, 0, 0, 0, 0, 0,
    0, -1, 0, 0, 0, 0,
    0, 0, -1, 0, 0, 0,
    0, 0, 0, 1, 0, 0,
    0, 0, 0, 0, 1, 0,
    0, 0, 0, 0, 0, 1,
    0, 0, 0, 0, 0, 0,
  ]));

  const colorBuffer = buffer(new Float32Array([
    1, 0, 0, 1, 0, 0,
    0, 1, 0, 0, 1, 0,
    0, 0, 1, 0, 0, 1,
    1, 0, 0, 1, 0, 0,
    0, 1, 0, 0, 1, 0,
    0, 0, 1, 0, 0, 1,
    0, 0, 0, 1, 0, 1,
  ]));

  // cached structures
  const mvp = mat4.create();
  const origin = vec3.create();
  const vec3zero = vec3.create();
  const halfRes = vec3.create();
  const farPlaneV3 = vec3.fromValues(camera.farPlane, camera.farPlane, camera.farPlane);

  const setting = engine.config.createBoolean('display.axis', 'Show axis', 'toggle', true);
  engine.on('settingchange', (changed) => {
    if (changed === setting) engine.emit('scenechange');
  });
  engine.on('viewportresize', (current) => vec3.scale(halfRes, current, 0.5));

  return {
    program,
    render() {
      if (!setting.value) return;

      const selectedAxes = editor.selection.getByType('axis').map(({ id }) => id);

      ctx.enable(ctx.BLEND);

      ctx.bindBuffer(ctx.ARRAY_BUFFER, positionBuffer);
      ctx.enableVertexAttribArray(program.aLoc.a_position);
      ctx.vertexAttribPointer(program.aLoc.a_position, 3, ctx.FLOAT, false, 0, 0);

      ctx.bindBuffer(ctx.ARRAY_BUFFER, colorBuffer);
      ctx.enableVertexAttribArray(program.aLoc.a_color);
      ctx.vertexAttribPointer(program.aLoc.a_color, 3, ctx.FLOAT, false, 0, 0);

      const { trs } = scene.currentInstance.Placement;

      mat4.getScaling(origin, trs);
      vec3.inverse(origin, origin);
      mat4.scale(mvp, trs, origin);

      vec3.transformMat4(origin, vec3zero, trs);
      vec3.transformMat4(origin, origin, camera.viewProjection);
      vec3.multiply(origin, origin, halfRes);
      vec3.add(origin, origin, halfRes);
      ctx.uniform3fv(program.uLoc.u_origin, origin);

      mat4.multiply(mvp, camera.viewProjection, mvp);
      mat4.scale(mvp, mvp, farPlaneV3);
      ctx.uniformMatrix4fv(program.uLoc.u_matrix, false, mvp);

      if (scene.hoveredAxisId) {
        ctx.uniform1f(program.uLoc.u_hovered, 1);
        ctx.lineWidth(5);
        ctx.drawArrays(ctx.LINES, scene.hoveredAxisId * 2 - 2, 2);
        ctx.drawArrays(ctx.LINES, scene.hoveredAxisId * 2 + 4, 2);
        ctx.uniform1f(program.uLoc.u_hovered, 0);
      }

      for (const selectedAxis of selectedAxes) {
        if (selectedAxis > 0) {
          ctx.lineWidth(3);
          ctx.drawArrays(ctx.LINES, selectedAxis * 2 - 2, 2);
          ctx.drawArrays(ctx.LINES, selectedAxis * 2 + 4, 2);
        }
      }

      ctx.lineWidth(1);
      ctx.drawArrays(ctx.LINES, 0, 12);

      if (scene.currentStep instanceof Sketch) {
        if (scene.hoveredAxisId === 0) {
          ctx.uniform1f(program.uLoc.u_hovered, 1);
          ctx.drawArrays(ctx.POINTS, 12, 1);
          ctx.uniform1f(program.uLoc.u_hovered, 0);
        }
        ctx.drawArrays(ctx.POINTS, selectedAxes.includes(0) ? 13 : 12, 1);
      }

      ctx.disable(ctx.BLEND);
    },
  };
};
