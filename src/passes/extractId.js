import Body from '../engine/cad/body.js';
import SubInstance from '../engine/cad/subinstance.js';
import Id from '../engine/general/id.js';
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
    driver: { ctx, makeProgram, vert, frag, framebuffer },
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

      void main() {
        gl_Position = u_viewProjection * u_trs * a_position;
        gl_Position.z -= u_offset * 0.00001;
        gl_PointSize = 10.0;
      }
    `,
    frag`#version 300 es
      precision mediump float;

      uniform vec4 u_instanceId;

      out vec4 outId;

      void main() {
        outId = u_instanceId;
      }
    `,
  );

  /** @type {Set<number>} */
  const selectedIds = new Set();

  /** @type {typeof editor["temp"]["elements"]} */
  const selection = [];

  let fb = framebuffer(ctx.UNSIGNED_BYTE);
  let readData = new Uint8ClampedArray(4);
  let frustum = camera.frustum;

  let left = 0;
  let top = 0;
  let width = 1;
  let height = 1;
  let bufferSize = readData.length;

  engine.on('viewportresize', ([w, h]) => {
    const size = w * h * 4;
    if (size > readData.length) {
      fb = framebuffer(ctx.UNSIGNED_BYTE, w, h);
      readData = new Uint8ClampedArray(w * h * 4);
    }
  });

  return {
    program,
    render(extract) {
      if (!extract || tools.isActive('orbit')) return;

      const { position: [x1, y1], lastClickedPosition: [x2, y2]} = input;
      const lasso = input.leftButton && tools.selected?.type === 'select' && x1 !== x2 && y1 !== y2;
      if (lasso) {
        left = Math.min(x1, x2);
        top = camera.screenResolution[1] - Math.max(y1, y2) - 1;
        width = Math.abs(x1 - x2);
        height = Math.abs(y1 - y2);
        bufferSize = width * height * 4;
        frustum = camera.viewProjection;
        selectedIds.clear();
        selection.splice(0);
      } else {
        left = 0;
        top = 0;
        width = 1;
        height = 1;
        frustum = camera.frustum;
      }

      ctx.bindFramebuffer(ctx.FRAMEBUFFER, fb);
      ctx.clear(ctx.COLOR_BUFFER_BIT | ctx.DEPTH_BUFFER_BIT);

      const activeInstances = editor.edited.getByType('instance').map(({ instance }) => instance);
      populateChildren(activeInstances);

      const bodies = entities.values(Body);
      for (const { currentModel: model, instances } of bodies) {
        if (!model) continue;

        ctx.bindBuffer(ctx.ELEMENT_ARRAY_BUFFER, model.buffer.index);

        ctx.bindBuffer(ctx.ARRAY_BUFFER, model.buffer.vertex);
        ctx.enableVertexAttribArray(program.aLoc.a_position);
        ctx.vertexAttribPointer(program.aLoc.a_position, 3, ctx.FLOAT, false, 0, 0);

        ctx.uniformMatrix4fv(program.uLoc.u_viewProjection, false, frustum);

        // Geometry
        ctx.uniform1f(program.uLoc.u_offset, 0);
        for (const instance of instances) {
          // Prevent self-picking when editing
          if (activeInstances.includes(instance)) continue;

          ctx.uniformMatrix4fv(program.uLoc.u_trs, false, instance.Placement.trs);
          ctx.uniform4fv(program.uLoc.u_instanceId, instance.Id.vec4);

          ctx.drawElements(ctx.TRIANGLES, model.data.index.length, ctx.UNSIGNED_INT, 0);
        }

        // Lines
        ctx.bindBuffer(ctx.ARRAY_BUFFER, model.buffer.lineVertex);
        ctx.enableVertexAttribArray(program.aLoc.a_position);
        ctx.vertexAttribPointer(program.aLoc.a_position, 3, ctx.FLOAT, false, 0, 0);

        ctx.uniform1f(program.uLoc.u_offset, 1);
        ctx.bindBuffer(ctx.ELEMENT_ARRAY_BUFFER, model.buffer.lineIndex);
        ctx.lineWidth(5);
        for (const instance of instances) {
          // Prevent self-picking when editing
          if (activeInstances.includes(instance)) continue;

          ctx.uniformMatrix4fv(program.uLoc.u_trs, false, instance.Placement.trs);
          ctx.uniform4fv(program.uLoc.u_instanceId, instance.Id.vec4);

          ctx.drawElements(ctx.LINES, model.data.lineIndex.length, ctx.UNSIGNED_INT, 0);
        }
        ctx.lineWidth(1);

        // Points
        ctx.uniform1f(program.uLoc.u_offset, 2);
        for (const instance of instances) {
          // Prevent self-picking when editing
          if (activeInstances.includes(instance)) continue;

          ctx.uniformMatrix4fv(program.uLoc.u_trs, false, instance.Placement.trs);
          ctx.uniform4fv(program.uLoc.u_instanceId, instance.Id.vec4);

          ctx.drawArrays(ctx.POINTS, 0, model.data.lineVertex.length / 3);
        }
      }

      ctx.readPixels(left, top, width, height, ctx.RGBA, ctx.UNSIGNED_BYTE, readData);

      const { enteredInstance } = scene;

      if (lasso) {
        for (let i = 0; i < bufferSize; i += 4) {
          const id = Id.uuuuToInt(readData.subarray(i, i + 4));
          if (!id || selectedIds.has(id)) continue;

          let instance = entities.getFirstByTypeAndIntId(Instance, id);
          if (!instance) continue;

          let parent = SubInstance.getParent(instance);
          while (parent && parent.instance !== enteredInstance) {
            instance = parent.instance;
            parent = SubInstance.getParent(instance);
          }
          if ((parent?.instance ?? null) === enteredInstance && !selectedIds.has(instance.Id.int)) {
            selectedIds.add(id);
            selectedIds.add(instance.Id.int);
            selection.push({ type: 'instance', index: instance.Id.int, instance });
          }
        }
        editor.temp.set(selection);
        if (selection.length) return;
      } else {
        scene.hoverOver(readData);
      }

      const model = enteredInstance?.body.currentModel;
      if (!model) return;

      const activePoints = editor.edited.getByType('point')
        .filter(el => el.instance === enteredInstance)
        .map(({ index }) => index);

      ctx.clear(ctx.COLOR_BUFFER_BIT | ctx.DEPTH_BUFFER_BIT);

      ctx.uniformMatrix4fv(program.uLoc.u_viewProjection, false, frustum);
      ctx.uniformMatrix4fv(program.uLoc.u_trs, false, enteredInstance.Placement.trs);

      // Geometry
      ctx.bindBuffer(ctx.ARRAY_BUFFER, model.buffer.vertex);
      ctx.enableVertexAttribArray(program.aLoc.a_position);
      ctx.vertexAttribPointer(program.aLoc.a_position, 3, ctx.FLOAT, false, 0, 0);

      ctx.uniform1f(program.uLoc.u_offset, 0);

      ctx.bindBuffer(ctx.ELEMENT_ARRAY_BUFFER, model.buffer.index);
      ctx.uniform4fv(program.uLoc.u_instanceId, Id.intToVec4(0));

      ctx.drawElements(ctx.TRIANGLES, model.data.index.length, ctx.UNSIGNED_INT, 0);

      // Lines
      ctx.bindBuffer(ctx.ARRAY_BUFFER, model.buffer.lineVertex);
      ctx.enableVertexAttribArray(program.aLoc.a_position);
      ctx.vertexAttribPointer(program.aLoc.a_position, 3, ctx.FLOAT, false, 0, 0);

      ctx.uniform1f(program.uLoc.u_offset, 1);

      ctx.bindBuffer(ctx.ELEMENT_ARRAY_BUFFER, model.buffer.lineIndex);

      ctx.lineWidth(5);
      ctx.drawElements(ctx.LINES, model.data.lineIndex.length, ctx.UNSIGNED_INT, 0);
      ctx.lineWidth(1);

      // Points
      ctx.uniform1f(program.uLoc.u_offset, 2);

      for (let i = 0; i < model.data.lineVertex.length / 3; ++i) {
        // Prevent self-picking when editing
        if (!activePoints.includes(i)) {
          ctx.uniform4fv(program.uLoc.u_instanceId, Id.intToVec4(i + 1));
          ctx.drawArrays(ctx.POINTS, i, 1);
        }
      }

      ctx.readPixels(left, top, width, height, ctx.RGBA, ctx.UNSIGNED_BYTE, readData);
      if (lasso) {
        for (let i = 0; i < bufferSize; i += 4) {
          const id = Id.uuuuToInt(readData.subarray(i, i + 4)) - 1;
          if (id < 0 || selectedIds.has(id)) continue;
          selectedIds.add(id);
          selection.push({ type: 'point', index: id, instance: enteredInstance });
        }
      } else {
        scene.hoverPoint(readData);
        if (scene.hoveredPointIndex !== null) return;
      }

      const activeLines = editor.edited.getByType('line')
        .filter(el => el.instance === enteredInstance)
        .map(({ index }) => index);

      ctx.clear(ctx.COLOR_BUFFER_BIT | ctx.DEPTH_BUFFER_BIT);

      // Geometry
      ctx.uniform1f(program.uLoc.u_offset, 0);

      ctx.bindBuffer(ctx.ELEMENT_ARRAY_BUFFER, model.buffer.index);
      ctx.uniform4fv(program.uLoc.u_instanceId, Id.intToVec4(0));

      ctx.drawElements(ctx.TRIANGLES, model.data.index.length, ctx.UNSIGNED_INT, 0);

      // Lines
      ctx.uniform1f(program.uLoc.u_offset, 1);

      ctx.bindBuffer(ctx.ELEMENT_ARRAY_BUFFER, model.buffer.lineIndex);

      ctx.lineWidth(5);
      for (let i = 0; i < model.data.lineIndex.length / 2; ++i) {
        // Prevent self-picking when editing
        if (!activeLines.includes(i)) {
          ctx.uniform4fv(program.uLoc.u_instanceId, Id.intToVec4(i + 1));
          ctx.drawElements(ctx.LINES, 2, ctx.UNSIGNED_INT, i * 8);
        }
      }
      ctx.lineWidth(1);

      ctx.readPixels(left, top, width, height, ctx.RGBA, ctx.UNSIGNED_BYTE, readData);
      if (lasso) {
        selectedIds.clear();
        for (let i = 0; i < bufferSize; i += 4) {
          const id = Id.uuuuToInt(readData.subarray(i, i + 4)) - 1;
          if (id < 0 || selectedIds.has(id)) continue;
          selectedIds.add(id);
          selection.push({ type: 'line', index: id, instance: enteredInstance });
        }
        editor.temp.set(selection);
      } else {
        scene.hoverLine(readData);
      }
    },
  };
};
