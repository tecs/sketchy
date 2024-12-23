import Input from '../input.js';

const { vec3, mat4, quat } = glMatrix;

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

  #startingDistance = 5;

  projection = mat4.create();
  world = mat4.create();
  viewProjection = mat4.create();
  inverseViewProjection = mat4.create();
  frustum = mat4.create();

  inverseFovScaling = vec3.create();
  screenResolution = vec3.create();
  pixelToScreen = vec3.create();
  eye = vec3.create();
  eyeNormal = vec3.create();

  invertZoom = false;
  orthographic = false;
  fovyTan = 0.5;
  fovTan = 0.5;
  fovy = 1;
  aspect = 1;
  nearPlane = 0.01;
  farPlane = 2000;

  /** Rotation around X */
  pitch = 0;
  /** Rotation around Y */
  yaw = 0;
  rotation = quat.create();
  inverseRotation = quat.create();

  scale = 1;
  pixelSize = 1;
  frustumOffset = new Float32Array(4);

  /**
   * @param {Engine} engine
   */
  constructor(engine) {
    const { config } = engine;
    this.#engine = engine;

    mat4.fromTranslation(this.world, vec3.fromValues(0, 0, -this.#startingDistance));
    this.fovyTan = Math.tan(this.fovy * 0.5);

    engine.on('viewportresize', (current) => {
      this.screenResolution[0] = current[0];
      this.screenResolution[1] = current[1];
      this.pixelToScreen[0] = 2 / this.screenResolution[0];
      this.pixelToScreen[1] = -2 / this.screenResolution[1];
      this.aspect = current[0] / current[1];
      this.fovTan = this.fovyTan * this.aspect;

      this.recalculateProjection();
    });

    engine.on('mousemove', () => this.recalculateFrustum());

    const cameraFaceXkey = config.createString('shortcuts.cameraX', 'Look along X-axis', 'key', Input.stringify('1'));
    const cameraFaceYkey = config.createString('shortcuts.cameraY', 'Look along Y-axis', 'key', Input.stringify('2'));
    const cameraFaceZkey = config.createString('shortcuts.cameraZ', 'Look along Z-axis', 'key', Input.stringify('3'));
    const cameraFaceXYZkey = config.createString('shortcuts.cameraXYZ', 'Look along XYZ-axis', 'key', Input.stringify('0'));
    const cameraFaceReverseXkey = config.createString('shortcuts.cameraRevX', 'Look back at X-axis', 'key', Input.stringify('4'));
    const cameraFaceReverseYkey = config.createString('shortcuts.cameraRevY', 'Look back at Y-axis', 'key', Input.stringify('5'));
    const cameraFaceReverseZkey = config.createString('shortcuts.cameraRevZ', 'Look back at Z-axis', 'key', Input.stringify('6'));

    const orthoSetting = config.createBoolean('camera.ortho', 'Orthographic projection', 'toggle', this.orthographic);
    this.orthographic = orthoSetting.value;

    const invertZoomSetting = config.createBoolean('mouse.invertZoom', 'Invert wheel', 'toggle', this.invertZoom);
    this.invertZoom = invertZoomSetting.value;

    engine.on('settingchange', (setting) => {
      switch (setting) {
        case orthoSetting:
          this.orthographic = setting.value;
          this.recalculateProjection();
          break;
        case invertZoomSetting:
          this.invertZoom = setting.value;
          break;
      }
    });

    const pKey = config.createString('shortcuts.changePerspective', 'Change perspective', 'key', Input.stringify([['v'], ['p']]));

    engine.input.registerShortcuts(
      cameraFaceXkey,
      cameraFaceYkey,
      cameraFaceZkey,
      cameraFaceXYZkey,
      cameraFaceReverseXkey,
      cameraFaceReverseYkey,
      cameraFaceReverseZkey,
      pKey,
    );

    engine.on('shortcut', setting => {
      switch (setting) {
        case cameraFaceXkey: this.resetAndLookFrom(0, halfPI); break;
        case cameraFaceYkey: this.resetAndLookFrom(halfPI, 0); break;
        case cameraFaceZkey: this.resetAndLookFrom(0, 0); break;
        case cameraFaceXYZkey: this.resetAndLookFrom(halfPI / 2, threeFourthsPI + halfPI / 2); break;
        case cameraFaceReverseXkey: this.resetAndLookFrom(0, threeFourthsPI); break;
        case cameraFaceReverseYkey: this.resetAndLookFrom(threeFourthsPI, 0); break;
        case cameraFaceReverseZkey: this.resetAndLookFrom(0, Math.PI); break;
        case pKey: orthoSetting.set(!orthoSetting.value); break;
      }
    });

    engine.on('currentchange', () => this.resetAndLookFrom(0, 0));
  }

  /**
   * @param {number} dX
   * @param {number} dY
   * @param {ReadonlyVec3} rotationOrigin
   */
  orbit(dX, dY, rotationOrigin) {
    if (rotationOrigin[2] < 0) {
      toEye[0] = 0;
      toEye[1] = 0;
      toEye[2] = this.#startingDistance;
    } else {
      toEye[0] = -rotationOrigin[0];
      toEye[1] = -rotationOrigin[1];
      toEye[2] = rotationOrigin[2];
    }

    vec3.negate(toPivot, toEye);

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
    this.scale = 1;

    mat4.fromTranslation(this.world, vec3.fromValues(0, 0, -this.#startingDistance));
    mat4.rotateX(this.world, this.world, this.pitch);
    mat4.rotateY(this.world, this.world, this.yaw);

    mat4.multiply(this.world, this.world, this.#engine.scene.currentInstance.Placement.inverseTrs);

    this.recalculateMVP();
  }

  /**
   * @param {number} dX
   * @param {number} dY
   * @param {number} dZ
   * @param {ReadonlyVec3} panOrigin
   */
  pan(dX, dY, dZ, panOrigin) {
    if (this.invertZoom) dZ *= -1;

    diff[0] = dX;
    diff[1] = -dY;

    vec3.multiply(diff, diff, this.inverseFovScaling);
    let panScale = 2 / this.scale;
    if (!this.orthographic) {
      panScale *= panOrigin[2] > 0 ? panOrigin[2] : this.#startingDistance;
    }
    vec3.scale(diff, diff, panScale);
    diff[2] = dZ;

    const { currentInstance } = this.#engine.scene;

    mat4.multiply(this.world, this.world, currentInstance.Placement.trs);

    mat4.rotateY(this.world, this.world, -this.yaw);
    mat4.rotateX(this.world, this.world, -this.pitch);

    mat4.translate(this.world, this.world, diff);

    mat4.rotateX(this.world, this.world, this.pitch);
    mat4.rotateY(this.world, this.world, this.yaw);

    mat4.multiply(this.world, this.world, currentInstance.Placement.inverseTrs);

    this.recalculateMVP();
  }

  /**
   * @param {number} direction
   * @param {ReadonlyVec3} zoomOrigin
   */
  zoom(direction, zoomOrigin) {
    if (this.invertZoom) direction *= -1;

    const originalScale = this.scale;
    this.scale = Math.min(Math.max(this.scale * (1 - direction * 0.1), 0.1), 10);

    if (zoomOrigin[2] < 0) {
      toEye[0] = 0;
      toEye[1] = 0;
      toEye[2] = this.#startingDistance;
    } else {
      toEye[0] = -zoomOrigin[0];
      toEye[1] = -zoomOrigin[1];
      toEye[2] = zoomOrigin[2];
    }

    vec3.negate(toPivot, toEye);

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
    const top = this.fovyTan * (this.orthographic ? this.#startingDistance : this.nearPlane);
    const right = top * this.aspect;

    if (this.orthographic) {
      mat4.ortho(this.projection, -right, right, -top, top, this.nearPlane, this.farPlane);
    } else {
      mat4.frustum(this.projection, -right, right, -top, top, this.nearPlane, this.farPlane);
    }

    mat4.getScaling(this.inverseFovScaling, this.projection);
    vec3.inverse(this.inverseFovScaling, this.inverseFovScaling);

    const [, vScaling] = this.pixelToScreen;

    this.pixelSize = top * vScaling;

    const hScaling = 0.5 * vScaling * (this.aspect - 1);
    this.frustumOffset[0] = (hScaling - this.aspect) * top;
    this.frustumOffset[1] = (hScaling + this.aspect) * top;
    this.frustumOffset[2] = (vScaling + 1) * top;
    this.frustumOffset[3] = (vScaling + 3) * top;

    this.recalculateMVP();
  }

  recalculateMVP() {
    mat4.multiply(this.viewProjection, this.projection, this.world);
    mat4.invert(this.inverseViewProjection, this.viewProjection);

    mat4.getRotation(this.rotation, this.world);
    quat.invert(this.inverseRotation, this.rotation);

    this.recalculateFrustum();

    this.#engine.emit('camerachange');
  }

  recalculateFrustum() {
    const [x, y] = this.#engine.input.position;

    const originX = x * this.pixelSize;
    const originY = y * this.pixelSize;

    const left = this.frustumOffset[0] - originX;
    const right = this.frustumOffset[1] - originX;
    const bottom = this.frustumOffset[2] + originY;
    const top = this.frustumOffset[3] + originY;

    const sceneScaling = this.#engine.scene.currentInstance.Placement.scaling;

    mat4.getTranslation(this.eye, this.world);
    vec3.set(this.eyeNormal, x * this.pixelToScreen[0] - 1, y * this.pixelToScreen[1] + 1, -1);
    vec3.multiply(this.eyeNormal, this.eyeNormal, this.inverseFovScaling);

    if (this.orthographic) {
      mat4.ortho(this.frustum, left, right, bottom, top, this.nearPlane, this.farPlane);

      this.eyeNormal[2] = 0;
      vec3.subtract(this.eye, this.eye, this.eyeNormal);
      vec3.set(this.eyeNormal, 0, 0, -1);
    } else {
      mat4.frustum(this.frustum, left, right, bottom, top, this.nearPlane, this.farPlane);
    }
    mat4.multiply(this.frustum, this.frustum, this.world);

    vec3.scale(this.eye, this.eye, -1 / this.scale);
    vec3.multiply(this.eye, this.eye, sceneScaling);
    vec3.transformQuat(this.eye, this.eye, this.inverseRotation);

    vec3.multiply(this.eyeNormal, this.eyeNormal, sceneScaling);
    vec3.transformQuat(this.eyeNormal, this.eyeNormal, this.inverseRotation);
    vec3.normalize(this.eyeNormal, this.eyeNormal);
  }
}
