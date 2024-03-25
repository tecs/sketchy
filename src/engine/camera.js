const { vec3, mat4 } = glMatrix;

const PI = Math.PI;
const twoPI = PI * 2;
const halfPI = PI / 2;
const threeFourthsPI = halfPI * 3;

// cached structures
const diff = vec3.create();
const toEye = vec3.create();
const toPivot = vec3.create();
const transform = mat4.create();

export default class Camera {
  /** @type {Engine} */
  #engine;

  /** @type {Readonly<vec3>} */
  #startingPointVec = vec3.fromValues(0, 0, -5);


  projection = mat4.create();
  normalProjection = mat4.create();
  world = mat4.create();
  viewProjection = mat4.create();
  inverseViewProjection = mat4.create();
  frustum = mat4.create();

  fovScaling = vec3.create();
  inverseFovScaling = vec3.create();
  screenResolution = vec3.create();

  fovy = 1;
  aspect = 1;
  nearPlane = 0.01;
  farPlane = 2000;
  pitch = 0;
  yaw = 0;
  scale = 1;
  pixelSize = 1;
  frustumOffset = new Float32Array(4);

  /**
   * @param {Engine} engine
   */
  constructor(engine) {
    const { config } = engine;
    this.#engine = engine;

    mat4.fromTranslation(this.world, this.#startingPointVec);

    engine.on('viewportresize', (current) => {
      this.screenResolution[0] = current[0];
      this.screenResolution[1] = current[1];
      this.aspect = current[0] / current[1];

      this.recalculateProjection();
    });

    engine.on('mousemove', () => this.recalculateFrustum());

    const cameraFaceXkey = config.createString('shortcuts.cameraX', 'Look along X-axis', 'key', '1');
    const cameraFaceYkey = config.createString('shortcuts.cameraY', 'Look along Y-axis', 'key', '2');
    const cameraFaceZkey = config.createString('shortcuts.cameraZ', 'Look along Z-axis', 'key', '3');
    const cameraFaceReverseXkey = config.createString('shortcuts.cameraRevX', 'Look back at X-axis', 'key', '4');
    const cameraFaceReverseYkey = config.createString('shortcuts.cameraRevY', 'Look back at Y-axis', 'key', '5');
    const cameraFaceReverseZkey = config.createString('shortcuts.cameraRevZ', 'Look back at Z-axis', 'key', '6');
    const cameraFaceXYZkey = config.createString('shortcuts.cameraXYZ', 'Look along XYZ-axis', 'key', '0');

    engine.on('keyup', (key) => {
      if (engine.tools.selected.active) return;

      switch (key) {
        case cameraFaceXkey.value:
          this.resetAndLookFrom(0, halfPI);
          break;
        case cameraFaceYkey.value:
          this.resetAndLookFrom(halfPI, 0);
          break;
        case cameraFaceZkey.value:
          this.resetAndLookFrom(0, 0);
          break;
        case cameraFaceReverseXkey.value:
          this.resetAndLookFrom(0, threeFourthsPI);
          break;
        case cameraFaceReverseYkey.value:
          this.resetAndLookFrom(threeFourthsPI, 0);
          break;
        case cameraFaceReverseZkey.value:
          this.resetAndLookFrom(0, Math.PI);
          break;
        case cameraFaceXYZkey.value:
          this.resetAndLookFrom(halfPI / 2, threeFourthsPI + halfPI / 2);
          break;
      }
    });
  }

  /**
   * @param {number} dX
   * @param {number} dY
   * @param {Readonly<vec3>} rotationOrigin
   */
  orbit(dX, dY, rotationOrigin) {
    toEye[0] = -rotationOrigin[0];
    toEye[1] = -rotationOrigin[1];
    toEye[2] = rotationOrigin[2];
    if (toEye[2] < 0) {
      toEye[0] = 0;
      toEye[1] = 0;
      toEye[2] = Math.abs(this.#startingPointVec[2]);
    }

    toPivot[0] = -toEye[0];
    toPivot[1] = -toEye[1];
    toPivot[2] = -toEye[2];

    const oldPitch = this.pitch;

    this.pitch += dY * halfPI;
    if (this.pitch < 0) this.pitch += twoPI;
    else if (this.pitch > twoPI) this.pitch -= twoPI;

    if (this.pitch > halfPI && this.pitch < threeFourthsPI) dX *= -1;

    this.yaw += dX * halfPI;
    if (this.yaw < 0) this.yaw += twoPI;
    else if (this.yaw > twoPI) this.yaw -= twoPI;

    // rotate
    mat4.fromTranslation(transform, toPivot);
    mat4.rotateX(transform, transform, this.pitch);
    mat4.rotateY(transform, transform, dX * halfPI);
    mat4.rotateX(transform, transform, -oldPitch);
    mat4.translate(transform, transform, toEye);

    mat4.multiply(this.world, transform, this.world);

    this.recalculateMVP();
  }

  /**
   * @param {number} pitch
   * @param {number} yaw
   */
  resetAndLookFrom(pitch, yaw) {
    this.pitch = pitch;
    this.yaw = yaw;

    mat4.identity(this.world);
    mat4.fromTranslation(this.world, this.#startingPointVec);
    mat4.rotateX(this.world, this.world, this.pitch);
    mat4.rotateY(this.world, this.world, this.yaw);

    this.recalculateMVP();
  }

  /**
   * @param {number} dX
   * @param {number} dY
   * @param {Readonly<vec3>} panOrigin
   */
  pan(dX, dY, panOrigin) {
    diff[0] = dX;
    diff[1] = -dY;
    diff[2] = 0;
    const grabPoint = panOrigin[2] > 0 ? panOrigin[2] : Math.abs(this.#startingPointVec[2]);

    vec3.multiply(diff, diff, this.inverseFovScaling);
    vec3.scale(diff, diff, grabPoint * 2);

    mat4.rotateY(this.world, this.world, -this.yaw);
    mat4.rotateX(this.world, this.world, -this.pitch);

    mat4.translate(this.world, this.world, diff);

    mat4.rotateX(this.world, this.world, this.pitch);
    mat4.rotateY(this.world, this.world, this.yaw);

    this.recalculateMVP();
  }

  /**
   * @param {number} direction
   * @param {Readonly<vec3>} zoomOrigin
   */
  zoom(direction, zoomOrigin) {
    const originalScale = this.scale;
    this.scale = Math.min(Math.max(this.scale * (1 - direction * 0.1), 0.1), 10);

    toEye[0] = -zoomOrigin[0];
    toEye[1] = -zoomOrigin[1];
    toEye[2] = zoomOrigin[2];
    if (toEye[2] < 0) {
      toEye[0] = 0;
      toEye[1] = 0;
      toEye[2] = Math.abs(this.#startingPointVec[2]);
    }

    toPivot[0] = -toEye[0];
    toPivot[1] = -toEye[1];
    toPivot[2] = -toEye[2];

    diff[0] = this.scale / originalScale;
    diff[1] = diff[0];
    diff[2] = diff[0];

    mat4.fromTranslation(transform, toPivot);
    mat4.scale(transform, transform, diff);
    mat4.translate(transform, transform, toEye);

    mat4.multiply(this.world, transform, this.world);

    this.recalculateMVP();
  }

  recalculateProjection() {
    mat4.perspective(this.projection, this.fovy, this.aspect, this.nearPlane, this.farPlane);
    mat4.perspective(this.normalProjection, 1, this.aspect, 1, this.farPlane);

    mat4.getScaling(this.fovScaling, this.projection);
    vec3.inverse(this.inverseFovScaling, this.fovScaling);

    const scaling = 1 / this.screenResolution[1];

    this.pixelSize = 2 * Math.abs(Math.tan(this.fovy * 0.5)) * scaling * this.nearPlane;

    this.frustumOffset[0] = -(1 + scaling) * this.screenResolution[0] * this.pixelSize * 0.5;
    this.frustumOffset[1] = -(scaling - 1) * this.screenResolution[0] * this.pixelSize * 0.5;
    this.frustumOffset[2] = -(scaling - 1) * this.screenResolution[1] * this.pixelSize * 0.5;
    this.frustumOffset[3] = (3 - scaling) * this.screenResolution[1] * this.pixelSize * 0.5;

    this.recalculateMVP();
  }

  recalculateMVP() {
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
