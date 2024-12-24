import Base, { bindMethods } from './general/base.js';

const { vec3 } = glMatrix;

/** @typedef {[TemplateStringsArray, any[]?]} TaggedTemplateParams */
/** @typedef {Record<string, number>} AttributeLocationMap */
/** @typedef {Record<string, WebGLUniformLocation?>} UniformLocationMap */
/** @typedef {WebGLBuffer?} GLBuffer */

/**
 * @typedef Shader
 * @property {WebGLShader} shader
 * @property {["in" | "uniform", string, string][]} vars
 */

/**
 * @typedef Program
 * @property {WebGLProgram} program
 * @property {AttributeLocationMap} aLoc
 * @property {UniformLocationMap} uLoc
 * @property {() => void} use
 */

export default class Driver extends Base {
  /** @type {Engine} */
  #engine;

  /** @type {WebGL2RenderingContext} */
  ctx;

  /** @type {HTMLCanvasElement} */
  canvas;

  /**
   * @param {Engine} engine
   * @param {HTMLCanvasElement} canvas
   */
  constructor(engine, canvas) {
    super();

    bindMethods(this, 'vert', 'frag', 'makeProgram', 'resize', 'buffer', 'framebuffer', 'renderbuffer', 'texture');

    this.#engine = engine;
    this.canvas = canvas;

    const ctx = canvas.getContext('webgl2');
    if (!ctx) {
      throw new Error('WebGL2 not supported');
    }
    this.ctx = ctx;
    if (!ctx.getExtension('EXT_color_buffer_float')) {
      throw new Error('Floating point extension "EXT_color_buffer_float" is not supported');
    }
  }

  /**
   * @param {string} source
   * @param {35632 | 35633} type
   * @returns {Shader}
   */
  #compileShader(source, type) {
    const shader = this.ctx.createShader(type);
    if (!shader) {
      throw new Error('Cannot create a new shader.');
    }

    let cleanSource = '';
    let comment = 0;
    for (let c = 1; c <= source.length; ++c) {
      if (source[c - 1] === '\n' && comment === 1) {
        comment = 0;
      }

      switch (source[c - 1] + source[c]) {
        case '//':
          if (!comment) comment = 1;
          break;
        case '/*':
          if (!comment) comment = 2;
          break;
        case '*/':
          if (comment === 2) {
            comment = 0;
            ++c;
          }
          break;
        default:
          if (!comment) cleanSource += source[c - 1];
      }
    }

    const vars = /** @type {Shader["vars"]} */ (cleanSource.replace(/^#version.+/, '').replace(/\s+/g, ' ').trim().replace(/;\s+/g, ';').split(';')
      .map(row => row.split(' '))
      .filter(row => row.length === 3)
      .filter(([kind]) => kind === 'uniform' || (kind === 'in' && type === this.ctx.VERTEX_SHADER)));

    this.ctx.shaderSource(shader, source.trim());
    this.ctx.compileShader(shader);
    if (this.ctx.getShaderParameter(shader, this.ctx.COMPILE_STATUS)) {
      return { shader, vars };
    }

    const error = `Cannot compile shader - ${this.ctx.getShaderInfoLog(shader)}`;
    this.ctx.deleteShader(shader);
    throw new Error(error);
  }

  /**
   * @param  {...Shader} shaders
   * @returns {Program}
   */
  makeProgram(...shaders) {
    const program = this.ctx.createProgram();
    if (!program) {
      throw new Error('Cannot create a new program');
    }
    /** @type {Shader["vars"]} */
    const locs = [];
    for (const { shader, vars } of shaders) {
      this.ctx.attachShader(program, shader);
      vars.filter(v => !locs.find(l => l[2] === v[2])).forEach(v => locs.push(v));
    }
    this.ctx.linkProgram(program);

    const aLoc = /** @type {AttributeLocationMap} */ ({});
    const uLoc = /** @type {UniformLocationMap} */ ({});

    for (const [kind,, name] of locs) {
      switch (kind) {
        case 'in':
          aLoc[name] = this.ctx.getAttribLocation(program, name);
          break;
        case 'uniform':
          uLoc[name] = this.ctx.getUniformLocation(program, name);
          break;
      }
    }

    if (this.ctx.getProgramParameter(program, this.ctx.LINK_STATUS)) {
      return { program, use: () => this.ctx.useProgram(program), aLoc, uLoc };
    }

    const error = `Cannot initialize shader program - ${this.ctx.getProgramInfoLog(program)}`;
    this.ctx.deleteProgram(program);
    throw error;
  }

  /**
   * @param  {TaggedTemplateParams} args
   * @returns {Shader}
   */
  vert(...args) {
    return this.#compileShader(String.raw(...args), this.ctx.VERTEX_SHADER);
  }

  /**
   * @param  {TaggedTemplateParams} args
   * @returns {Shader}
   */
  frag(...args) {
    return this.#compileShader(String.raw(...args), this.ctx.FRAGMENT_SHADER);
  }

  /**
   * @param {Float32Array | Uint8Array | Uint32Array} data
   * @param {35040 | 35044 | 35048} usage
   * @param {boolean} [index]
   * @returns {WebGLBuffer | null}
   */
  buffer(data, usage = this.ctx.STATIC_DRAW, index = undefined) {
    const { ctx } = this;
    const type = (index ?? data instanceof Uint32Array) ? ctx.ELEMENT_ARRAY_BUFFER : ctx.ARRAY_BUFFER;

    const buffer = ctx.createBuffer();
    ctx.bindBuffer(type, buffer);
    ctx.bufferData(type, data, usage);
    return buffer;
  }

  /**
   * @param {5125 | 5126 | 5121} type
   * @param {number} [width]
   * @param {number} [height]
   * @returns {WebGLTexture | null}
   */
  texture(type, width = 1, height = 1) {
    const { ctx } = this;

    /** @type {number} */
    let internalFormat = ctx.RGBA;
    let format = internalFormat;
    switch (type) {
      case ctx.FLOAT:
        // RGBA32F requires EXT_color_buffer_float
        internalFormat = ctx.RGBA32F;
        break;
      case ctx.UNSIGNED_INT:
        internalFormat = ctx.RGBA32UI;
        format = ctx.RGBA_INTEGER;
        break;
    }

    const texture = ctx.createTexture();
    ctx.bindTexture(ctx.TEXTURE_2D, texture);
    ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_MIN_FILTER, ctx.LINEAR);
    ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_WRAP_S, ctx.CLAMP_TO_EDGE);
    ctx.texParameteri(ctx.TEXTURE_2D, ctx.TEXTURE_WRAP_T, ctx.CLAMP_TO_EDGE);
    ctx.texImage2D(ctx.TEXTURE_2D, 0, internalFormat, width, height, 0, format, type, null);

    return texture;
  }

  /**
   * @param {number} [width]
   * @param {number} [height]
   * @returns {WebGLRenderbuffer | null}
   */
  renderbuffer(width = 1, height = 1) {
    const { ctx } = this;

    const renderbuffer = ctx.createRenderbuffer();
    ctx.bindRenderbuffer(ctx.RENDERBUFFER, renderbuffer);
    ctx.renderbufferStorage(ctx.RENDERBUFFER, ctx.DEPTH_COMPONENT16, width, height);

    return renderbuffer;
  }

  /**
   * @param {Parameters<Driver["texture"]>} args
   * @returns {WebGLFramebuffer | null}
   */
  framebuffer(...args) {
    const { ctx } = this;

    const framebuffer = ctx.createFramebuffer();
    const texture = this.texture(...args);
    const renderbuffer = this.renderbuffer(args[1], args[2]);

    ctx.bindFramebuffer(ctx.FRAMEBUFFER, framebuffer);
    ctx.framebufferTexture2D(ctx.FRAMEBUFFER, ctx.COLOR_ATTACHMENT0, ctx.TEXTURE_2D, texture, 0);
    ctx.framebufferRenderbuffer(ctx.FRAMEBUFFER, ctx.DEPTH_ATTACHMENT, ctx.RENDERBUFFER, renderbuffer);

    return framebuffer;
  }

  resize() {
    const oldSize = vec3.fromValues(this.canvas.width, this.canvas.height, 0);
    const newSize = vec3.fromValues(this.canvas.clientWidth, this.canvas.clientHeight, 0);

    this.canvas.width = newSize[0];
    this.canvas.height = newSize[1];
    this.ctx.viewport(0, 0, newSize[0], newSize[1]);

    this.#engine.emit('viewportresize', newSize, oldSize);
  }
}
