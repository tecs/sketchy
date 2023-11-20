/**
 * @typedef {[TemplateStringsArray, any[]?]} TaggedTemplateParams
 *
 * @typedef {{[key: string]: number}} AttributeLocationMap
 * @typedef {{[key: string]: WebGLUniformLocation | null}} UniformLocationMap
 *
 * @typedef {WebGLBuffer | null} GLBuffer
 *
 * @typedef Shader
 * @property {WebGLShader} shader
 * @property {string[][]} vars
 *
 * @typedef Program
 * @property {WebGLProgram} program
 * @property {AttributeLocationMap} aLoc
 * @property {UniformLocationMap} uLoc
 * @property {() => void} use
 *
 * @typedef Driver
 * @property {WebGLRenderingContext} ctx
 * @property {HTMLCanvasElement} canvas
 * @property {boolean} supportsUIntIndexes
 * @property {Uint16ArrayConstructor|Uint32ArrayConstructor} UintIndexArray
 * @property {5125 | 5123} UNSIGNED_INDEX_TYPE
 * @property {() => vec3} getCanvasSize
 * @property {(...shaders: Shader[]) => Program} makeProgram
 * @property {(...args: TaggedTemplateParams) => Shader} vert
 * @property {(...args: TaggedTemplateParams) => Shader} frag
 */

/** @type {(canvas: HTMLCanvasElement) => Driver} */
export default (canvas) => {
  const ctx = canvas.getContext('webgl');
  if (!ctx) {
    throw new Error('WebGL not supported');
  }

  if (!ctx.getExtension('OES_texture_float')) {
    throw new Error('Floating point extension "OES_texture_float" is not supported');
  }

  const supportsUIntIndexes = !!ctx.getExtension('OES_element_index_uint');

  /**
   * @param {string} source
   * @param {number} type
   * @returns {Shader}
   */
  const compileShader = (source, type) => {
    const shader = ctx.createShader(type);
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

    const vars = cleanSource.replace(/\s+/g, ' ').trim().replace(/;\s+/g, ';').split(';')
      .map(row => row.split(' '))
      .filter(row => row.length === 3 && ['attribute', 'uniform'].includes(row[0]));

    ctx.shaderSource(shader, source.trim());
    ctx.compileShader(shader);
    if (ctx.getShaderParameter(shader, ctx.COMPILE_STATUS)) {
      return { shader, vars };
    }

    const error = `Cannot compile shader - ${ctx.getShaderInfoLog(shader)}`;
    ctx.deleteShader(shader);
    throw new Error(error);
  };

  /**
   * @param  {...Shader} shaders
   * @returns {Program}
   */
  const makeProgram = (...shaders) => {
    const program = ctx.createProgram();
    if (!program) {
      throw new Error('Cannot create a new program');
    }
    /** @type {string[][]} */
    const locs = [];
    for (const { shader, vars } of shaders) {
      ctx.attachShader(program, shader);
      vars.filter(v => !locs.find(l => l[2] === v[2])).forEach(v => locs.push(v));
    }
    ctx.linkProgram(program);

    const aLoc = /** @type {AttributeLocationMap} */ ({});
    const uLoc = /** @type {UniformLocationMap} */ ({});

    for (const [type,, name] of locs) {
      switch (type) {
        case 'attribute':
          aLoc[name] = ctx.getAttribLocation(program, name);
          break;
        case 'uniform':
          uLoc[name] = ctx.getUniformLocation(program, name);
          break;
      }
    }

    if (ctx.getProgramParameter(program, ctx.LINK_STATUS)) {
      return { program, use: () => ctx.useProgram(program), aLoc, uLoc };
    }

    const error = `Cannot initialize shader program - ${ctx.getProgramInfoLog(program)}`;
    ctx.deleteProgram(program);
    throw error;
  };

  return {
    ctx,
    canvas,
    supportsUIntIndexes,
    UintIndexArray: supportsUIntIndexes ? Uint32Array : Uint16Array,
    UNSIGNED_INDEX_TYPE: supportsUIntIndexes ? ctx.UNSIGNED_INT : ctx.UNSIGNED_SHORT,
    getCanvasSize: () => new Float32Array([canvas.clientWidth, canvas.clientHeight, 0]),
    makeProgram,
    vert: (...args) => compileShader(String.raw(...args), ctx.VERTEX_SHADER),
    frag: (...args) => compileShader(String.raw(...args), ctx.FRAGMENT_SHADER),
  };
};
