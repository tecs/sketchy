/**
 * @typedef {(engine: Engine) => RenderingPassRenderer} RenderingPass
 *
 * @typedef RenderingPassRenderer
 * @property {Readonly<Program>} program
 * @property {(draw: boolean, extract: boolean) => void} render
 */

export default class Renderer {
  /** @type {Engine} */
  #engine;

  #pendingTypes = { draw: false, extract: false };
  #pendingRenders = 0;

  /** @type {RenderingPassRenderer[]} */
  pipeline = [];

  /**
   * @param {Engine} engine
   */
  constructor(engine) {
    this.#engine = engine;

    engine.on('mousemove', () => this.render(false, true));
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
   * @param {boolean} draw
   * @param {boolean} extract
   */
  render(draw = true, extract = false) {
    this.#pendingTypes.draw ||= draw;
    this.#pendingTypes.extract ||= extract;

    if (this.#pendingRenders++) return;

    draw ||= this.#pendingTypes.draw;
    extract ||= this.#pendingTypes.extract;

    this.#pendingTypes.draw = false;
    this.#pendingTypes.extract = false;

    requestAnimationFrame(() => {
      const { ctx } = this.#engine.driver;

      if (draw) {
        ctx.clearColor(0, 0, 0, 0);
        ctx.clearDepth(1);
        ctx.clear(ctx.COLOR_BUFFER_BIT | ctx.DEPTH_BUFFER_BIT);
      }
      ctx.enable(ctx.DEPTH_TEST);
      ctx.depthFunc(ctx.LEQUAL);
      ctx.blendFunc(ctx.SRC_ALPHA, ctx.ONE_MINUS_SRC_ALPHA);
      for (const renderingPass of this.pipeline) {
        renderingPass.program.use();
        ctx.bindFramebuffer(ctx.FRAMEBUFFER, null);
        try {
          renderingPass.render(draw, extract);
        } catch (e) {
          this.#engine.emit('error', 'Caught during render pass:', e);
        }
      }

      if (--this.#pendingRenders) {
        this.#pendingRenders = 0;
        this.render(false, false);
      }
    });
  }
}
