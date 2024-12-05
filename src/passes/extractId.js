import Body from '../engine/cad/body.js';
import SubInstance from '../engine/cad/subinstance.js';
import Instance from '../engine/scene/instance.js';

/**
 * @param {Instance[]} instances
 * @param {Instance[]} [instancesToFindChildrenOf]
 */
const populateChildren = (instances, instancesToFindChildrenOf = instances) => {
  const children = [];
  for (const instance of instancesToFindChildrenOf) {
    children.push(...SubInstance.getChildren(instance));
  }

  if (children.length) {
    instances.push(...children);
    populateChildren(instances, children);
  }
};

/** @type {RenderingPass} */
export default (engine) => {
  const {
    driver: { ctx, makeProgram, vert, frag, framebuffer, renderbuffer, texture },
    camera,
    editor,
    entities,
    input,
    scene,
    tools,
  } = engine;

  const program = makeProgram(
    vert`#version 300 es
      in vec4 a_position;

      uniform mat4 u_trs;
      uniform mat4 u_viewProjection;
      uniform float u_offset;
      uniform float u_isLine;
      uniform float u_isPoint;

      out float v_lineId;
      out float v_pointId;

      void main() {
        gl_Position = u_viewProjection * u_trs * a_position;
        gl_Position.z -= u_offset * 0.00001;
        gl_PointSize = 10.0;
        v_lineId = float(gl_VertexID + 2) * u_isLine * 0.5;
        v_pointId = float(gl_VertexID + 1) * u_isPoint;
      }
    `,
    frag`#version 300 es
      precision mediump float;

      in float v_lineId;
      in float v_pointId;

      uniform uint u_instanceId;

      out uvec4 outIds;

      void main() {
        outIds = uvec4(u_instanceId, v_lineId, v_pointId, 0);
      }
    `,
  );

  /** @type {Set<number>} */
  const selectedInstanceIds = new Set();

  /** @type {Set<number>} */
  const selectedLineIds = new Set();

  /** @type {Set<number>} */
  const selectedPointIds = new Set();

  /** @type {typeof editor["temp"]["elements"]} */
  const selection = [];

  const fb = framebuffer(ctx.UNSIGNED_INT);
  let readData = new Uint32Array(4);

  engine.on('viewportresize', ([w, h]) => {
    const size = w * h * 4;

    const newTexture = texture(ctx.UNSIGNED_INT, w, h);
    const newRenderbuffer = renderbuffer(w, h);

    ctx.bindFramebuffer(ctx.FRAMEBUFFER, fb);
    ctx.framebufferTexture2D(ctx.FRAMEBUFFER, ctx.COLOR_ATTACHMENT0, ctx.TEXTURE_2D, newTexture, 0);
    ctx.framebufferRenderbuffer(ctx.FRAMEBUFFER, ctx.DEPTH_ATTACHMENT, ctx.RENDERBUFFER, newRenderbuffer);

    if (size > readData.length) {
      readData = new Uint32Array(w * h * 4);
    }
  });

  return {
    program,
    render(extract) {
      if (!extract || tools.isActive('orbit')) return;

      const { position: [x1, y1], lastClickedPosition: [x2, y2]} = input;
      const lasso = input.leftButton && tools.selected?.type === 'select' && x1 !== x2 && y1 !== y2;

      ctx.bindFramebuffer(ctx.FRAMEBUFFER, fb);
      ctx.clearBufferuiv(ctx.COLOR, 0, [0, 0, 0, 0]);
      ctx.clear(ctx.DEPTH_BUFFER_BIT);

      const activeInstances = editor.edited.getByType('instance').map(({ instance }) => instance);
      populateChildren(activeInstances);

      ctx.uniformMatrix4fv(program.uLoc.u_viewProjection, false, lasso ? camera.viewProjection : camera.frustum);

      const bodies = entities.values(Body);
      for (const { currentModel: model, instances } of bodies) {
        if (!model) continue;

        ctx.bindBuffer(ctx.ELEMENT_ARRAY_BUFFER, model.buffer.index);

        ctx.bindBuffer(ctx.ARRAY_BUFFER, model.buffer.vertex);
        ctx.enableVertexAttribArray(program.aLoc.a_position);
        ctx.vertexAttribPointer(program.aLoc.a_position, 3, ctx.FLOAT, false, 0, 0);

        // Geometry
        ctx.uniform1f(program.uLoc.u_offset, 0);
        ctx.uniform1f(program.uLoc.u_isLine, 0);
        ctx.uniform1f(program.uLoc.u_isPoint, 0);
        for (const instance of instances) {
          // Prevent self-picking when editing
          if (activeInstances.includes(instance)) continue;

          ctx.uniformMatrix4fv(program.uLoc.u_trs, false, instance.Placement.trs);
          ctx.uniform1ui(program.uLoc.u_instanceId, instance.Id.int);

          ctx.drawElements(ctx.TRIANGLES, model.data.index.length, ctx.UNSIGNED_INT, 0);
        }

        // Lines
        ctx.bindBuffer(ctx.ARRAY_BUFFER, model.buffer.lineVertex);
        ctx.enableVertexAttribArray(program.aLoc.a_position);
        ctx.vertexAttribPointer(program.aLoc.a_position, 3, ctx.FLOAT, false, 0, 0);

        ctx.uniform1f(program.uLoc.u_offset, 1);
        ctx.uniform1f(program.uLoc.u_isLine, 1);
        ctx.uniform1f(program.uLoc.u_isPoint, 0);
        ctx.bindBuffer(ctx.ELEMENT_ARRAY_BUFFER, model.buffer.lineIndex);
        ctx.lineWidth(5);
        for (const instance of instances) {
          // Prevent self-picking when editing
          if (activeInstances.includes(instance)) continue;

          ctx.uniformMatrix4fv(program.uLoc.u_trs, false, instance.Placement.trs);
          ctx.uniform1ui(program.uLoc.u_instanceId, instance.Id.int);

          ctx.drawElements(ctx.LINES, model.data.lineIndex.length, ctx.UNSIGNED_INT, 0);
        }
        ctx.lineWidth(1);

        // Points
        ctx.uniform1f(program.uLoc.u_offset, 2);
        ctx.uniform1f(program.uLoc.u_isLine, 0);
        ctx.uniform1f(program.uLoc.u_isPoint, 1);
        for (const instance of instances) {
          // Prevent self-picking when editing
          if (activeInstances.includes(instance)) continue;

          ctx.uniformMatrix4fv(program.uLoc.u_trs, false, instance.Placement.trs);
          ctx.uniform1ui(program.uLoc.u_instanceId, instance.Id.int);

          ctx.drawArrays(ctx.POINTS, 0, model.data.lineVertex.length / 3);
        }
      }

      if (lasso) {
        const left = Math.min(x1, x2);
        const top = camera.screenResolution[1] - Math.max(y1, y2) - 1;
        const width = Math.abs(x1 - x2);
        const height = Math.abs(y1 - y2);
        const bufferSize = width * height * 4;

        const { enteredInstance } = scene;

        selectedInstanceIds.clear();
        selectedLineIds.clear();
        selectedPointIds.clear();
        selection.splice(0);

        ctx.readPixels(left, top, width, height, ctx.RGBA_INTEGER, ctx.UNSIGNED_INT, readData);

        for (let i = 0; i < bufferSize; i += 4) {
          const [instanceId, lineId, pointId] = readData.subarray(i, i + 3);
          if (!instanceId || selectedInstanceIds.has(instanceId)) continue;

          let instance = entities.getFirstByTypeAndIntId(Instance, instanceId);
          if (!instance) continue;

          let parent = SubInstance.getParent(instance);
          while (parent && parent.instance !== enteredInstance) {
            instance = parent.instance;
            parent = SubInstance.getParent(instance);
          }

          if ((parent?.instance ?? null) === enteredInstance && !selectedInstanceIds.has(instance.Id.int)) {
            selectedInstanceIds.add(instanceId);
            selectedInstanceIds.add(instance.Id.int);
            selection.push({ type: 'instance', index: instance.Id.int, instance });
          }

          if (enteredInstance !== instance) continue;

          if (lineId > 0 && !selectedLineIds.has(lineId)) {
            selectedLineIds.add(lineId);
            selection.push({ type: 'line', index: lineId - 1, instance });
          }

          if (pointId > 0 && !selectedPointIds.has(pointId)) {
            selectedPointIds.add(pointId);
            selection.push({ type: 'point', index: pointId - 1, instance });
          }
        }
        editor.temp.set(selection);
        return;
      }

      ctx.readPixels(0, 0, 1, 1, ctx.RGBA_INTEGER, ctx.UNSIGNED_INT, readData);

      if (readData[0] && readData[1]) {
        for (const { instance, index } of editor.edited.getByType('line')) {
          if (instance.Id.int === readData[0] && index === readData[1] - 1) {
            readData[1] = 0;
            break;
          }
        }
      }

      if (readData[0] && readData[2]) {
        for (const { instance, index } of editor.edited.getByType('point')) {
          if (instance.Id.int === readData[0] && index === readData[2] - 1) {
            readData[2] = 0;
            break;
          }
        }
      }

      scene.hoverOver(readData);
    },
  };
};
