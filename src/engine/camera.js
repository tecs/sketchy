const PI = Math.PI;
const twoPI = PI * 2;
const halfPI = PI / 2;
const threeFourthsPI = halfPI * 3;

/**
 * @typedef Camera
 * @property {number} fovy
 * @property {number} aspect
 * @property {number} nearPlane
 * @property {number} farPlane
 * @property {vec3} fovScaling
 * @property {vec3} inverseFovScaling
 * @property {number} pitch
 * @property {number} yaw
 * @property {mat4} translation
 * @property {mat4} inverseTranslation
 * @property {mat4} rotation
 * @property {mat4} inverseRotation
 * @property {mat4} projection
 * @property {mat4} normalProjection
 * @property {mat4} world
 * @property {mat4} mvp
 * @property {mat4} inverseMvp
 * @property {vec3} screenResolution
 * @property {(dX: number, dY: number) => void} pan
 * @property {(dx: number, dy: number) => void} orbit
 * @property {(direction: number) => void} zoom
 * @property {() => void} recalculateMVP
 */

/**
 * @param {Engine} engine
 * @returns {Camera}
 */
export default (engine) => {
  const canvas = /** @type {HTMLCanvasElement} */ (engine.driver.ctx.canvas);

  const { mat4, vec3 } = engine.math;

  const startingPointVec = vec3.fromValues(0, 0, -5);
  const startingPointMat = mat4.fromTranslation(mat4.create(), startingPointVec);

  /** @type {Camera} */
  const camera = {
    fovy: 1,
    aspect: 1,
    nearPlane: 0.01,
    farPlane: 2000,
    fovScaling: vec3.create(),
    inverseFovScaling: vec3.create(),
    pitch: 0,
    yaw: 0,
    translation: mat4.clone(startingPointMat),
    inverseTranslation: mat4.invert(mat4.create(), startingPointMat),
    rotation: mat4.create(),
    inverseRotation: mat4.create(),
    projection: mat4.create(),
    normalProjection: mat4.create(),
    world: mat4.create(),
    mvp: mat4.create(),
    inverseMvp: mat4.create(),
    screenResolution: vec3.fromValues(canvas.width, canvas.height, 0),
    orbit(dX, dY) {
      const toEye = vec3.clone(engine.state.hovered);
      toEye[0] = toEye[1] = 0;
      if (!engine.state.hoveredInstance?.id.int) {
        toEye[2] = Math.abs(startingPointVec[2]);
      }

      const toPivot = vec3.fromValues(-toEye[0], -toEye[1], -toEye[2]);
      const transform = mat4.create();

      // unpitch
      mat4.translate(transform, transform, toPivot);
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
      mat4.invert(this.inverseRotation, this.rotation);

      this.recalculateMVP();
    },
    pan(dX, dY) {
      const zero = vec3.create();
      const scale = Math.abs(engine.state.hovered[2]) * 2;
      const diff = vec3.fromValues(dX, -dY, 0);

      vec3.multiply(diff, diff, this.inverseFovScaling);
      vec3.scale(diff, diff, scale);

      vec3.rotateX(diff, diff, zero, -this.pitch);
      vec3.rotateY(diff, diff, zero, -this.yaw);

      mat4.translate(this.translation, this.translation, diff);
      mat4.invert(this.inverseTranslation, this.translation);
      
      this.recalculateMVP();
    },
    zoom(direction) {
      const zero = vec3.create();
      const origin = vec3.clone(engine.scene.hovered);
      
      if (origin[2] < 0) vec3.scale(origin, origin, -1);

      if (direction > 0 && origin[2] < this.nearPlane * 2) return;

      vec3.multiply(origin, origin, vec3.fromValues(-direction, -direction, direction));
      vec3.multiply(origin, origin, this.inverseFovScaling);
      vec3.scale(origin, origin, 0.1);
      
      vec3.rotateX(origin, origin, zero, -this.pitch);
      vec3.rotateY(origin, origin, zero, -this.yaw);

      mat4.translate(this.translation, this.translation, origin);
      mat4.invert(this.inverseTranslation, this.translation);

      this.recalculateMVP();
    },
    recalculateMVP() {
      mat4.multiply(this.world, this.rotation, this.translation);
      mat4.multiply(this.mvp, this.projection, this.world);
      mat4.invert(this.inverseMvp, this.mvp);

      engine.emit('camerachange');
    },
  };

  engine.on('viewportresize', (current, previous) => {
    if (current[0] === previous[0] && current[1] === previous[1]) return;

    camera.screenResolution[0] = canvas.width = current[0];
    camera.screenResolution[1] = canvas.height = current[1];
    engine.driver.ctx.viewport(0, 0, canvas.width, canvas.height);

    camera.aspect = canvas.width / canvas.height;
    mat4.perspective(camera.projection, camera.fovy, camera.aspect, camera.nearPlane, camera.farPlane);
    mat4.perspective(camera.normalProjection, 1, camera.aspect, 1, camera.farPlane);
    mat4.getScaling(camera.fovScaling, camera.projection);
    vec3.inverse(camera.inverseFovScaling, camera.fovScaling);

    camera.recalculateMVP();
  });

  return camera;
};