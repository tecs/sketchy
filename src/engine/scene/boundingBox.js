const { vec3 } = glMatrix;

// cached structures
const boundingCoord = vec3.create();

export default class BoundingBox {
  data = new Float32Array(24);

  /** @type {vec3} */
  min;

  /** @type {vec3} */
  max;

  constructor() {
    const min = this.data.subarray(0, 3);
    const max = this.data.subarray(18, 21);

    if (!vec3.is(min) || !vec3.is(max)) {
      throw new Error('Min and/or max vertex of bounding box is malformed');
    }

    this.min = min;
    this.max = max;

    this.reset();
  }

  reset() {
    this.data.set([0, 0, 0]);
    this.data.set([0, 0, 0], 18);
  }

  /**
   * Based on the diagonal bounding box vertices (p0 BFL, p6 TRR),
   * recalculates all remaining vertices (p1-p5 and p7)
   */
  regenerate() {
    // p1 BRL
    this.data[3] = this.data[0];
    this.data[4] = this.data[1];
    this.data[5] = this.data[20];
    // p2 BRR
    this.data[6] = this.data[18];
    this.data[7] = this.data[1];
    this.data[8] = this.data[20];
    // p3 BFR
    this.data[9] = this.data[18];
    this.data[10] = this.data[1];
    this.data[11] = this.data[2];
    // p4 TFL
    this.data[12] = this.data[0];
    this.data[13] = this.data[19];
    this.data[14] = this.data[2];
    // p5 TRL
    this.data[15] = this.data[0];
    this.data[16] = this.data[19];
    this.data[17] = this.data[20];
    // p7 TFR
    this.data[21] = this.data[18];
    this.data[22] = this.data[19];
    this.data[23] = this.data[2];
  }

  /**
   * @param {Float32Array} newData
   */
  expand(newData) {
    for (let i = 0; i < newData.length; i += 3) {
      const vertex = /** @type {vec3} */ (newData.subarray(i, i + 3));
      vec3.min(this.min, this.min, vertex);
      vec3.max(this.max, this.max, vertex);
    }

    this.regenerate();
  }

  /**
   * @param {BoundingBox} other
   * @param {mat4} trs
   */
  expandWithBoundingBox(other, trs) {
    for (let i = 0; i < 24; i += 3) {
      vec3.transformMat4(boundingCoord, /** @type {vec3} */ (other.data.subarray(i, i + 3)), trs);
      vec3.min(this.min, this.min, boundingCoord);
      vec3.max(this.max, this.max, boundingCoord);
    }

    this.regenerate();
  }
}
