/**
 * @typedef {(engine: Engine) => RenderingPassRenderer} RenderingPass
 * 
 * @typedef RenderingPassRenderer
 * @property {Readonly<Program>} program
 * @property {() => void} render
 *
 * @typedef Renderer
 * @property {RenderingPassRenderer[]} pipeline
 * @property {(makePass: RenderingPass) => void} addToPipeline
 * @property {() => void} render
 */

/**
 * @param {Engine} engine
 * @returns {Renderer}
 */
export default (engine) => {
  const { ctx } = engine.driver;

  let pendingRenders = 0;

  /** @type {Renderer} */
  const renderer = {
    pipeline: [],
    addToPipeline(makePass) {
      this.pipeline.push(makePass(engine));
    },
    render() {
      if (pendingRenders++) return;

      requestAnimationFrame(() => {
        ctx.clearColor(0, 0, 0, 0);
        ctx.clearDepth(1);
        ctx.enable(ctx.DEPTH_TEST);
        ctx.depthFunc(ctx.LEQUAL);
        ctx.blendFunc(ctx.SRC_ALPHA, ctx.ONE_MINUS_SRC_ALPHA);
        ctx.clear(ctx.COLOR_BUFFER_BIT | ctx.DEPTH_BUFFER_BIT);
        for (const renderingPass of this.pipeline) {
          renderingPass.program.use();
          ctx.bindFramebuffer(ctx.FRAMEBUFFER, null);
          try {
            renderingPass.render();
          } catch (e) {
            console.error("Caught during render pass:", e);
          }
        }

        if (--pendingRenders) {
          pendingRenders = 0;
          renderer.render();
        }
      });
    },
  };

  engine.on('mousemove', () => renderer.render());
  engine.on('camerachange', () => renderer.render());
  engine.on('selectionchange', () => renderer.render());
  engine.on('currentchange', () => renderer.render());
  engine.on('scenechange', () => renderer.render());

  return renderer;
};