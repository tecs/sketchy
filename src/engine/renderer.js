/**
 * @typedef {(engine: Engine) => RenderingPassRenderer} RenderingPass
 *
 * @typedef RenderingPassRenderer
 * @property {Readonly<Program>} program
 * @property {() => void} render
 */

export default class Renderer {
  /** @type {Engine} */
  #engine;

  /** @type {RenderingPassRenderer[]} */
  pipeline = [];

  #pendingRenders = 0;

  /**
   * @param {Engine} engine
   */
  constructor(engine) {
    this.#engine = engine;

    engine.on('mousemove', () => this.render());
    engine.on('camerachange', () => this.render());
    engine.on('selectionchange', () => this.render());
    engine.on('currentchange', () => this.render());
    engine.on('scenechange', () => this.render());
  }

  /**
   * @param {RenderingPass} makePass
   */
  addToPipeline(makePass) {
    this.pipeline.push(makePass(this.#engine));
  }

  render() {
    if (this.#pendingRenders++) return;

    requestAnimationFrame(() => {
      const { ctx } = this.#engine.driver;

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
          console.error('Caught during render pass:', e);
        }
      }

      if (--this.#pendingRenders) {
        this.#pendingRenders = 0;
        this.render();
      }
    });
  }
}
