/** @typedef {(engine: Engine) => RenderingPassRenderer} RenderingPass */

/**
 * @typedef RenderingPassRenderer
 * @property {Readonly<Program>} program
 * @property {(extract: boolean) => void} render
 */

export default class Renderer {
  /** @type {Engine} */
  #engine;

  #pendingExtract = false;
  #pendingRenders = 0;

  /** @type {RenderingPassRenderer[]} */
  pipeline = [];

  /**
   * @param {Engine} engine
   */
  constructor(engine) {
    this.#engine = engine;

    engine.on('mousemove', () => this.render(true));
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

  /**
   * @param {boolean} extract
   */
  render(extract = false) {
    this.#pendingExtract ||= extract;

    if (this.#pendingRenders++) return;

    extract ||= this.#pendingExtract;

    this.#pendingExtract = false;

    requestAnimationFrame(() => {
      const { ctx } = this.#engine.driver;

      ctx.clearColor(0, 0, 0, 0);
      ctx.clearDepth(1);
      ctx.clear(ctx.COLOR_BUFFER_BIT | ctx.DEPTH_BUFFER_BIT);
      ctx.enable(ctx.DEPTH_TEST);
      ctx.depthFunc(ctx.LEQUAL);
      ctx.blendFunc(ctx.SRC_ALPHA, ctx.ONE_MINUS_SRC_ALPHA);
      for (const renderingPass of this.pipeline) {
        renderingPass.program.use();
        ctx.bindFramebuffer(ctx.FRAMEBUFFER, null);
        try {
          renderingPass.render(extract);
        } catch (e) {
          this.#engine.emit('error', 'Caught during render pass:', e);
        }
      }

      if (--this.#pendingRenders) {
        this.#pendingRenders = 0;
        this.render();
      }
    });
  }
}
