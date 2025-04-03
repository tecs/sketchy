import Body from '../engine/cad/body.js';
import Sketch from '../engine/cad/sketch.js';
import SubInstance from '../engine/cad/subinstance.js';
import Instance from '../engine/scene/instance.js';

const { mat4, vec3 } = glMatrix;

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
    driver: { ctx, makeProgram, vert, frag, buffer, framebuffer, renderbuffer, texture },
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
      in uint a_faceId;
      in uint a_lineId;
      in uint a_pointId;
      in float a_isSupport;

      uniform mat4 u_trs;
      uniform mat4 u_viewProjection;
      uniform float u_offset;
      uniform float u_isLine;
      uniform float u_isPoint;
      uniform float u_isEntered;

      out float v_faceId;
      out float v_lineId;
      out float v_pointId;
      out float v_skipPicking;

      void main() {
        gl_Position = u_viewProjection * u_trs * a_position;
        gl_Position.z -= u_offset * 0.00001;
        gl_PointSize = 10.0;
        v_faceId = float(a_faceId) * (1.0 - u_isLine) * (1.0 - u_isPoint);
        v_lineId = float(a_lineId) * u_isLine;
        v_pointId = float(a_pointId) * u_isPoint;

        v_skipPicking = (u_isLine + u_isPoint) * a_isSupport - u_isEntered;
      }
    `,
    frag`#version 300 es
      precision mediump float;

      in float v_faceId;
      in float v_lineId;
      in float v_pointId;
      in float v_skipPicking;

      uniform uint u_instanceId;

      out uvec4 outIds;

      void main() {
        if (v_skipPicking > 0.0) discard;
        outIds = uvec4(u_instanceId, v_faceId, v_lineId, v_pointId);
      }
    `,
  );

  const axisBuffer = buffer(new Float32Array([
    -1, 0, 0, 1, 0, 0,
    0, -1, 0, 0, 1, 0,
    0, 0, -1, 0, 0, 1,
    0, 0, 0,
  ]));

  const axisIdBuffer = buffer(new Uint32Array([1, 1, 2, 2, 3, 3, 4]), undefined, false);

  // cached structures
  const maxId =  Math.pow(2, 32) - 1;
  const mvp = mat4.create();
  const origin = vec3.create();
  const farPlaneV3 = vec3.fromValues(camera.farPlane, camera.farPlane, camera.farPlane);

  /** @type {Set<number>} */
  const selectedInstanceIds = new Set();

  /** @type {Set<number>} */
  const selectedFaceIds = new Set();

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

      const { enteredInstance, currentStep } = scene;

      const { position: [x1, y1], lastClickedPosition: [x2, y2]} = input;
      const lasso = input.leftButton && tools.selected?.type === 'select' && x1 !== x2 && y1 !== y2;

      ctx.bindFramebuffer(ctx.FRAMEBUFFER, fb);
      ctx.clearBufferuiv(ctx.COLOR, 0, [0, 0, 0, 0]);
      ctx.clear(ctx.DEPTH_BUFFER_BIT);

      const activeInstances = editor.edited.getByType('instance').map(({ instance }) => instance);
      populateChildren(activeInstances);

      ctx.uniformMatrix4fv(program.uLoc.u_viewProjection, false, lasso ? camera.viewProjection : camera.frustum);

      const currentlySketching = currentStep instanceof Sketch;

      const bodies = entities.values(Body);
      for (const { currentModel: model, instances } of bodies) {
        if (!model) continue;

        ctx.bindBuffer(ctx.ELEMENT_ARRAY_BUFFER, model.buffer.index);

        ctx.bindBuffer(ctx.ARRAY_BUFFER, model.buffer.vertex);
        ctx.enableVertexAttribArray(program.aLoc.a_position);
        ctx.vertexAttribPointer(program.aLoc.a_position, 3, ctx.FLOAT, false, 0, 0);

        ctx.bindBuffer(ctx.ARRAY_BUFFER, model.buffer.faceIds);
        ctx.enableVertexAttribArray(program.aLoc.a_faceId);
        ctx.vertexAttribIPointer(program.aLoc.a_faceId, 1, ctx.UNSIGNED_INT, 0, 0);

        ctx.bindBuffer(ctx.ARRAY_BUFFER, model.buffer.lineIds);
        ctx.enableVertexAttribArray(program.aLoc.a_lineId);
        ctx.vertexAttribIPointer(program.aLoc.a_lineId, 1, ctx.UNSIGNED_INT, 0, 0);

        ctx.bindBuffer(ctx.ARRAY_BUFFER, model.buffer.pointIds);
        ctx.enableVertexAttribArray(program.aLoc.a_pointId);
        ctx.vertexAttribIPointer(program.aLoc.a_pointId, 1, ctx.UNSIGNED_INT, 0, 0);

        // Geometry
        ctx.uniform1f(program.uLoc.u_offset, 0);
        ctx.uniform1f(program.uLoc.u_isLine, 0);
        ctx.uniform1f(program.uLoc.u_isPoint, 0);
        for (const instance of instances) {
          // Prevent self-picking when editing
          if (activeInstances.includes(instance) || !scene.isVisible(instance)) continue;

          ctx.uniformMatrix4fv(program.uLoc.u_trs, false, instance.Placement.trs);
          ctx.uniform1ui(program.uLoc.u_instanceId, instance.Id.int);

          ctx.drawElements(ctx.TRIANGLES, model.bufferData.index.length, ctx.UNSIGNED_INT, 0);
        }

        if (!enteredInstance) continue;

        // Lines
        ctx.bindBuffer(ctx.ARRAY_BUFFER, model.buffer.lineVertex);
        ctx.enableVertexAttribArray(program.aLoc.a_position);
        ctx.vertexAttribPointer(program.aLoc.a_position, 3, ctx.FLOAT, false, 0, 0);

        ctx.bindBuffer(ctx.ARRAY_BUFFER, model.buffer.lineSupports);
        ctx.enableVertexAttribArray(program.aLoc.a_isSupport);
        ctx.vertexAttribPointer(program.aLoc.a_isSupport, 1, ctx.FLOAT, false, 0, 0);

        ctx.uniform1f(program.uLoc.u_offset, 1);
        ctx.uniform1f(program.uLoc.u_isLine, 1);
        ctx.uniform1f(program.uLoc.u_isPoint, 0);
        ctx.bindBuffer(ctx.ELEMENT_ARRAY_BUFFER, model.buffer.lineIndex);
        ctx.lineWidth(5);
        for (const instance of instances) {
          // Prevent self-picking when editing
          if (activeInstances.includes(instance) || instance !== enteredInstance) continue;

          ctx.uniformMatrix4fv(program.uLoc.u_trs, false, instance.Placement.trs);
          ctx.uniform1ui(program.uLoc.u_instanceId, instance.Id.int);
          ctx.uniform1f(program.uLoc.u_isEntered, currentlySketching && enteredInstance === instance ? 1 : 0);

          ctx.drawElements(ctx.LINES, model.bufferData.lineIndex.length, ctx.UNSIGNED_INT, 0);
        }
        ctx.lineWidth(1);

        // Points
        ctx.uniform1f(program.uLoc.u_offset, 2);
        ctx.uniform1f(program.uLoc.u_isLine, 0);
        ctx.uniform1f(program.uLoc.u_isPoint, 1);
        for (const instance of instances) {
          // Prevent self-picking when editing
          if (activeInstances.includes(instance) || instance !== enteredInstance) continue;

          ctx.uniformMatrix4fv(program.uLoc.u_trs, false, instance.Placement.trs);
          ctx.uniform1ui(program.uLoc.u_instanceId, instance.Id.int);
          ctx.uniform1f(program.uLoc.u_isEntered, currentlySketching && enteredInstance === instance ? 1 : 0);

          ctx.drawElements(ctx.POINTS, model.bufferData.lineIndex.length, ctx.UNSIGNED_INT, 0);
        }

        ctx.disableVertexAttribArray(program.aLoc.a_isSupport);
      }

      if (lasso) {
        const left = Math.min(x1, x2);
        const top = camera.screenResolution[1] - Math.max(y1, y2) - 1;
        const width = Math.abs(x1 - x2);
        const height = Math.abs(y1 - y2);
        const bufferSize = width * height * 4;

        selectedInstanceIds.clear();
        selectedFaceIds.clear();
        selectedLineIds.clear();
        selectedPointIds.clear();
        selection.splice(0);

        ctx.readPixels(left, top, width, height, ctx.RGBA_INTEGER, ctx.UNSIGNED_INT, readData);

        for (let i = 0; i < bufferSize; i += 4) {
          const [instanceId, faceId, lineId, pointId] = readData.subarray(i, i + 4);
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
            selection.push({ type: 'instance', id: instance.Id.int, instance });
          }

          if (enteredInstance !== instance) continue;

          if (lineId > 0 && !selectedLineIds.has(lineId)) {
            selectedLineIds.add(lineId);
            selection.push({ type: 'line', id: lineId, instance });
          }

          if (faceId > 0 && !selectedFaceIds.has(faceId)) {
            selectedFaceIds.add(faceId);
            selection.push({ type: 'face', id: faceId, instance });
          }

          if (pointId > 0 && !selectedPointIds.has(pointId)) {
            selectedPointIds.add(pointId);
            selection.push({ type: 'point', id: pointId, instance });
          }
        }
        editor.temp.set(selection);
        return;
      }

      ctx.readPixels(0, 0, 1, 1, ctx.RGBA_INTEGER, ctx.UNSIGNED_INT, readData);

      if (readData[0] && readData[1]) {
        for (const { instance, id } of editor.edited.getByType('face')) {
          if (instance.Id.int === readData[0] && id === readData[1]) {
            readData[1] = 0;
            break;
          }
        }
      }

      if (readData[0] && readData[2]) {
        for (const { instance, id } of editor.edited.getByType('line')) {
          if (instance.Id.int === readData[0] && id === readData[2]) {
            readData[2] = 0;
            break;
          }
        }
      }

      if (readData[0] && readData[3]) {
        for (const { instance, id } of editor.edited.getByType('point')) {
          if (instance.Id.int === readData[0] && id === readData[3]) {
            readData[3] = 0;
            break;
          }
        }
      }

      if (scene.currentStep instanceof Sketch) {
        const { trs } = scene.currentInstance.Placement;

        mat4.getScaling(origin, trs);
        vec3.inverse(origin, origin);
        mat4.scale(mvp, trs, origin);
        mat4.scale(mvp, mvp, farPlaneV3);

        ctx.uniformMatrix4fv(program.uLoc.u_trs, false, mvp);
        ctx.uniform1ui(program.uLoc.u_instanceId, maxId);

        ctx.bindBuffer(ctx.ARRAY_BUFFER, axisBuffer);
        ctx.enableVertexAttribArray(program.aLoc.a_position);
        ctx.vertexAttribPointer(program.aLoc.a_position, 3, ctx.FLOAT, false, 0, 0);

        ctx.bindBuffer(ctx.ARRAY_BUFFER, axisIdBuffer);
        ctx.enableVertexAttribArray(program.aLoc.a_lineId);
        ctx.vertexAttribIPointer(program.aLoc.a_lineId, 1, ctx.UNSIGNED_INT, 0, 0);

        ctx.enableVertexAttribArray(program.aLoc.a_pointId);
        ctx.vertexAttribIPointer(program.aLoc.a_pointId, 1, ctx.UNSIGNED_INT, 0, 0);

        // Axes
        ctx.uniform1f(program.uLoc.u_offset, 1);
        ctx.uniform1f(program.uLoc.u_isLine, 1);
        ctx.uniform1f(program.uLoc.u_isPoint, 0);
        ctx.lineWidth(5);

        ctx.drawArrays(ctx.LINES, 0, 6);
        ctx.lineWidth(1);

        // Origin
        ctx.uniform1f(program.uLoc.u_offset, 2);
        ctx.uniform1f(program.uLoc.u_isLine, 0);
        ctx.uniform1f(program.uLoc.u_isPoint, 1);

        ctx.drawArrays(ctx.POINTS, 6, 1);
        const sub = readData.subarray(4, 8);
        ctx.readPixels(0, 0, 1, 1, ctx.RGBA_INTEGER, ctx.UNSIGNED_INT, sub);

        if (sub[0] === maxId) {
          if (sub[3] === 4) scene.hoverAxis(0);
          else switch (sub[2]) {
            case 1:
            case 2:
            case 3:
              scene.hoverAxis(sub[2]);
              break;
          }
          return;
        }
      }

      scene.hoverOver(readData);
    },
  };
};
