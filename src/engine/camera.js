const { vec3, mat4 } = glMatrix;

const PI = Math.PI;
const twoPI = PI * 2;
const halfPI = PI / 2;
const threeFourthsPI = halfPI * 3;

// cached structures
const diff = vec3.create();
const origin = vec3.create();
const toEye = vec3.create();
const toPivot = vec3.create();
const zero = vec3.create();
const transform = mat4.create();

export default class Camera {
  /** @type {Engine} */
  #engine;

  /** @type {vec3} */
  #startingPointVec;

  /** @type {vec3} */
  fovScaling;

  /** @type {vec3} */
  inverseFovScaling;

  /** @type {vec3} */
  screenResolution;

  /** @type {mat4} */
  translation;

  /** @type {mat4} */
  rotation;

  /** @type {mat4} */
  projection;

  /** @type {mat4} */
  normalProjection;

  /** @type {mat4} */
  world;

  /** @type {mat4} */
  viewProjection;

  /** @type {mat4} */
  inverseViewProjection;

  /** @type {mat4} */
  frustum;

  fovy = 1;
  aspect = 1;
  nearPlane = 0.01;
  farPlane = 2000;
  pitch = 0;
  yaw = 0;
  pixelSize = 1;
  frustumOffset = new Float32Array(4);

  /**
   * @param {Engine} engine
   */
  constructor(engine) {
    const { driver: { canvas } } = engine;
    this.#engine = engine;

    this.fovScaling = vec3.create();
    this.inverseFovScaling = vec3.create();
    this.screenResolution = vec3.fromValues(canvas.width, canvas.height, 0);

    this.#startingPointVec = vec3.fromValues(0, 0, -5);
    const startingPointMat = mat4.fromTranslation(mat4.create(), this.#startingPointVec);

    this.translation = mat4.clone(startingPointMat);
    this.rotation = mat4.create();
    this.projection = mat4.create();
    this.normalProjection = mat4.create();
    this.world = mat4.create();
    this.viewProjection = mat4.create();
    this.inverseViewProjection = mat4.create();
    this.frustum = mat4.create();

    engine.on('viewportresize', (current, previous) => {
      if (current[0] === previous[0] && current[1] === previous[1]) return;

      canvas.width = current[0];
      canvas.height = current[1];
      this.screenResolution[0] = current[0];
      this.screenResolution[1] = current[1];

      engine.driver.ctx.viewport(0, 0, canvas.width, canvas.height);

      this.aspect = canvas.width / canvas.height;
      mat4.perspective(this.projection, this.fovy, this.aspect, this.nearPlane, this.farPlane);
      mat4.perspective(this.normalProjection, 1, this.aspect, 1, this.farPlane);
      mat4.getScaling(this.fovScaling, this.projection);
      vec3.inverse(this.inverseFovScaling, this.fovScaling);

      const scaling = 1 / current[1];

      this.pixelSize = 2 * Math.abs(Math.tan(this.fovy * 0.5)) * scaling * this.nearPlane;

      this.frustumOffset[0] = -(1 + scaling) * current[0] * this.pixelSize * 0.5;
      this.frustumOffset[1] = -(scaling - 1) * current[0] * this.pixelSize * 0.5;
      this.frustumOffset[2] = -(scaling - 1) * current[1] * this.pixelSize * 0.5;
      this.frustumOffset[3] = (3 - scaling) * current[1] * this.pixelSize * 0.5;

      this.recalculateMVP();
    });

    engine.on('mousemove', () => this.recalculateFrustum());
  }

  /**
   * @param {number} dX
   * @param {number} dY
   * @param {vec3} rotationOrigin
   */
  orbit(dX, dY, rotationOrigin) {
    toEye[0] = 0;
    toEye[1] = 0;
    toEye[2] = rotationOrigin[2];
    if (!this.#engine.scene.hoveredInstance) {
      toEye[2] = Math.abs(this.#startingPointVec[2]);
    }

    toPivot[0] = -toEye[0];
    toPivot[1] = -toEye[1];
    toPivot[2] = -toEye[2];

    // unpitch
    mat4.fromTranslation(transform, toPivot);
    mat4.rotateX(transform, transform, -this.pitch);
    mat4.translate(transform, transform, toEye);

    mat4.multiply(this.rotation, transform, this.rotation);

    this.pitch += dY * halfPI;
    if (this.pitch < 0) this.pitch += twoPI;
    else if (this.pitch > twoPI) this.pitch -= twoPI;

    if (this.pitch > halfPI && this.pitch < threeFourthsPI) dX *= -1;

    this.yaw += dX * halfPI;
    if (this.yaw < 0) this.yaw += twoPI;
    else if (this.yaw > twoPI) this.yaw -= twoPI;

    // rotate
    mat4.identity(transform);
    mat4.translate(transform, transform, toPivot);
    mat4.rotateX(transform, transform, this.pitch);
    mat4.rotateY(transform, transform, dX * halfPI);
    mat4.translate(transform, transform, toEye);

    mat4.multiply(this.rotation, transform, this.rotation);

    this.recalculateMVP();
  }

  /**
   * @param {number} dX
   * @param {number} dY
   * @param {vec3} rotationOrigin
   */
  pan(dX, dY, rotationOrigin) {
    zero[0] = 0;
    zero[1] = 0;
    zero[2] = 0;

    diff[0] = dX;
    diff[1] = -dY;
    diff[2] = 0;

    const scale = Math.abs(rotationOrigin[2]) * 2;

    vec3.multiply(diff, diff, this.inverseFovScaling);
    vec3.scale(diff, diff, scale);

    vec3.rotateX(diff, diff, zero, -this.pitch);
    vec3.rotateY(diff, diff, zero, -this.yaw);

    mat4.translate(this.translation, this.translation, diff);

    this.recalculateMVP();
  }

  /**
   * @param {number} direction
   */
  zoom(direction) {
    const { scene: { hovered }, tools: { selected } } = this.#engine;
    if (selected.type === 'orbit' && selected.active) return;

    vec3.copy(origin, hovered);

    if (origin[2] < 0) vec3.scale(origin, origin, -1);

    if (direction > 0 && origin[2] < this.nearPlane * 2) return;

    zero[0] = 0;
    zero[1] = 0;
    zero[2] = 0;

    diff[0] = direction;
    diff[1] = direction;
    diff[2] = -direction;

    vec3.multiply(origin, origin, diff);
    vec3.multiply(origin, origin, this.inverseFovScaling);
    vec3.scale(origin, origin, 0.1);

    vec3.rotateX(origin, origin, zero, -this.pitch);
    vec3.rotateY(origin, origin, zero, -this.yaw);

    mat4.translate(this.translation, this.translation, origin);

    this.recalculateMVP();
  }

  recalculateMVP() {
    mat4.multiply(this.world, this.rotation, this.translation);
    mat4.multiply(this.viewProjection, this.projection, this.world);
    mat4.invert(this.inverseViewProjection, this.viewProjection);

    this.recalculateFrustum();

    this.#engine.emit('camerachange');
  }

  recalculateFrustum() {
    const [x, y] = this.#engine.input.position;

    const originX = (x + 0.5) * this.pixelSize;
    const originY = (y + 0.5) * this.pixelSize;

    const left = this.frustumOffset[0] + originX;
    const right = this.frustumOffset[1] + originX;
    const bottom = this.frustumOffset[2] - originY;
    const top = this.frustumOffset[3] - originY;

    mat4.frustum(this.frustum, left, right, bottom, top, this.nearPlane, this.farPlane);
    mat4.multiply(this.frustum, this.frustum, this.world);
  }
}
