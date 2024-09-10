interface FixedFloat32Array<N extends number> extends Float32Array {  readonly length: N; }

type vec2 = FixedFloat32Array<2>;
type ReadonlyVec2 = Readonly<vec2>;
type PlainVec2 = Tuple<number, 2>;

type vec3 = FixedFloat32Array<3>;
type ReadonlyVec3 = Readonly<vec3>;
type PlainVec3 = Tuple<number, 3>;

type vec4 = FixedFloat32Array<4>;
type ReadonlyVec4 = Readonly<vec4>;
type PlainVec4 = Tuple<number, 4>;

type mat2 = FixedFloat32Array<4>;
type ReadonlyMat2 = Readonly<mat2>;
type PlainMat2 = Tuple<number, 4>;

type mat2d = FixedFloat32Array<6>;
type ReadonlyMat2d = Readonly<mat2d>;
type PlainMat2d = Tuple<number, 6>;

type mat3 = FixedFloat32Array<9>;
type ReadonlyMat3 = Readonly<mat3>;
type PlainMat3 = Tuple<number, 9>;

type mat4 = FixedFloat32Array<16>;
type ReadonlyMat4 = Readonly<mat4>;
type PlainMat4 = Tuple<number, 16>;

type quat = FixedFloat32Array<4>;
type ReadonlyQuat = Readonly<quat>;
type PlainQuat = Tuple<number, 4>;

type quat2 = FixedFloat32Array<8>;
type ReadonlyQuat2 = Readonly<quat2>;
type PlainQuat2 = Tuple<number, 8>;

type GlmBase<T extends Float32Array, ReadonlyT> = {
    create: () => T;
    clone: (a: ReadonlyT) => T;
    copy: (out: T, a: ReadonlyT) => T;
    str: (a: ReadonlyT) => string;
    add: (out: T, a: ReadonlyT, b: ReadonlyT) => T;
    mul: (out: T, a: ReadonlyT, b: ReadonlyT) => T;
    multiply: (out: T, a: ReadonlyT, b: ReadonlyT) => T;
    equals: (a: ReadonlyT, b: ReadonlyT) => boolean;
    exactEquals: (a: ReadonlyT, b: ReadonlyT) => boolean;
    is: (v: Float32Array) => v is T;
};

type GlmBaseMQ<T, ReadonlyT> = {
    identity: (out: T) => T;
    invert: (out: T, a: ReadonlyT) => T;
};

type GlmBaseMV<T, ReadonlyT> = {
    sub: (out: T, a: ReadonlyT, b: ReadonlyT) => T;
    subtract: (out: T, a: ReadonlyT, b: ReadonlyT) => T;
};

type GlmBaseQV<T, ReadonlyT> = {
    len: (a: ReadonlyT) => number;
    length: (a: ReadonlyT) => number;
    sqrLen: (a: ReadonlyT) => number;
    normalize: (out: T, a: ReadonlyT) => T;
    squaredLength: (a: ReadonlyT) => number;
    dot: (a: ReadonlyT, b: ReadonlyT) => number;
    lerp: (out: T, a: ReadonlyT, b: ReadonlyT, t: number) => T;
    scale: (out: T, a: ReadonlyT, b: number) => T;
};

type GlmBaseM<T extends Float32Array, ReadonlyT> = GlmBase<T, ReadonlyT> & GlmBaseMQ<T, ReadonlyT> & GlmBaseMV<T, ReadonlyT> & {
    determinant: (a: ReadonlyT) => number;
    frob: (a: ReadonlyT) => number;
    multiplyScalar: (out: T, a: ReadonlyT, b: number) => T;
    multiplyScalarAndAdd: (out: T, a: ReadonlyT, b: ReadonlyT, scale: number) => T;
};

type GlmBaseQ<T extends Float32Array, ReadonlyT> = GlmBase<T, ReadonlyT> & GlmBaseMQ<T, ReadonlyT> & GlmBaseQV<T, ReadonlyT> & {
    conjugate: (out: T, a: ReadonlyT) => T;
    rotateX: (out: T, a: ReadonlyT, rad: number) => T;
    rotateY: (out: T, a: ReadonlyT, rad: number) => T;
    rotateZ: (out: T, a: ReadonlyT, rad: number) => T;
};

type GlmBaseV<T extends Float32Array, ReadonlyT> = GlmBase<T, ReadonlyT> & GlmBaseMV<T, ReadonlyT> & GlmBaseQV<T, ReadonlyT> & {
    random: (out: T, scale?: number) => T;
    zero: (out: T) => T;
    dist: (a: ReadonlyT, b: ReadonlyT) => number;
    distance: (a: ReadonlyT, b: ReadonlyT) => number;
    sqrDist: (a: ReadonlyT, b: ReadonlyT) => number;
    squaredDistance: (a: ReadonlyT, b: ReadonlyT) => number;
    inverse: (out: T, a: ReadonlyT) => T;
    negate: (out: T, a: ReadonlyT) => T;
    transformMat4: (out: T, a: ReadonlyT, m: ReadonlyMat4) => T;
    div: (out: T, a: ReadonlyT, b: ReadonlyT) => T;
    divide: (out: T, a: ReadonlyT, b: ReadonlyT) => T;
    ceil: (out: T, a: ReadonlyT) => T;
    floor: (out: T, a: ReadonlyT) => T;
    round: (out: T, a: ReadonlyT) => T;
    scaleAndAdd: (out: T, a: ReadonlyT, b: ReadonlyT, scale: number) => T;
    min: (out: T, a: ReadonlyT, b: ReadonlyT) => T;
    max: (out: T, a: ReadonlyT, b: ReadonlyT) => T;
    forEach: <ArgT>(a: T[], stride: number, offset: number, count: number, fn: (vec: [T, T], vec_: [T, T], arg: ArgT) => void, arg?: ArgT) => T[];
};

declare var glMatrix: Readonly<{
    mat2: GlmBaseM<mat2, ReadonlyMat2> & {
        fromValues: (m00: number, m01: number, m10: number, m11: number) => mat2;
        fromRotation: (out: mat2, rad: number) => mat2;
        fromScaling: (out: mat2, v: ReadonlyVec2) => mat2;
        set: (out: mat2, m00: number, m01: number, m10: number, m11: number) => mat2;
        transpose: (out: mat2, a: ReadonlyMat2) => mat2;
        adjoint: (out: mat2, a: ReadonlyMat2) => mat2;
        rotate: (out: mat2, a: ReadonlyMat2, rad: number) => mat2;
        scale: (out: mat2, a: ReadonlyMat2, v: ReadonlyVec2) => mat2;
        LDU: (L: ReadonlyMat2, D: ReadonlyMat2, U: ReadonlyMat2, a: ReadonlyMat2) => [ReadonlyMat2, ReadonlyMat2, ReadonlyMat2];
    },
    mat2d: GlmBaseM<mat2d, ReadonlyMat2d> & {
        fromValues: (a: number, b: number, c: number, d: number, tx: number, ty: number) => mat2d;
        fromRotation: (out: mat2d, rad: number) => mat2d;
        fromScaling: (out: mat2d, v: ReadonlyVec2) => mat2d;
        fromTranslation: (out: mat2d, v: ReadonlyVec2) => mat2d;
        set: (out: mat2d, a: number, b: number, c: number, d: number, tx: number, ty: number) => mat2d;
        rotate: (out: mat2d, a: ReadonlyMat2d, rad: number) => mat2d;
        scale: (out: mat2d, a: ReadonlyMat2d, v: ReadonlyVec2) => mat2d;
        translate: (out: mat2d, a: ReadonlyMat2d, v: ReadonlyVec2) => mat2d;
    },
    mat3: GlmBaseM<mat3, ReadonlyMat3> & {
        fromMat4: (out: mat3, a: ReadonlyMat4) => mat3;
        fromValues: (m00: number, m01: number, m02: number, m10: number, m11: number, m12: number, m20: number, m21: number, m22: number) => mat3;
        fromTranslation: (out: mat3, v: ReadonlyVec2) => mat3;
        fromRotation: (out: mat3, rad: number) => mat3;
        fromScaling: (out: mat3, v: ReadonlyVec2) => mat3;
        fromMat2d: (out: mat3, a: ReadonlyMat2d) => mat3;
        fromQuat: (out: mat3, q: ReadonlyQuat) => mat3;
        set: (out: mat3, m00: number, m01: number, m02: number, m10: number, m11: number, m12: number, m20: number, m21: number, m22: number) => mat3;
        transpose: (out: mat3, a: ReadonlyMat3) => mat3;
        adjoint: (out: mat3, a: ReadonlyMat3) => mat3;
        translate: (out: mat3, a: ReadonlyMat3, v: ReadonlyVec2) => mat3;
        rotate: (out: mat3, a: ReadonlyMat3, rad: number) => mat3;
        scale: (out: mat3, a: ReadonlyMat3, v: ReadonlyVec2) => mat3;
        normalFromMat4: (out: mat3, a: ReadonlyMat4) => mat3;
        projection: (out: mat3, width: number, height: number) => mat3;
    },
    mat4: GlmBaseM<mat4, ReadonlyMat4> & {
        fromValues: (m00: number, m01: number, m02: number, m03: number, m10: number, m11: number, m12: number, m13: number, m20: number, m21: number, m22: number, m23: number, m30: number, m31: number, m32: number, m33: number) => mat4;
        fromTranslation: (out: mat4, v: ReadonlyVec3) => mat4;
        fromScaling: (out: mat4, v: ReadonlyVec3) => mat4;
        fromRotation: (out: mat4, rad: number, axis: ReadonlyVec3) => mat4;
        fromXRotation: (out: mat4, rad: number) => mat4;
        fromYRotation: (out: mat4, rad: number) => mat4;
        fromZRotation: (out: mat4, rad: number) => mat4;
        fromRotationTranslation: (out: mat4, q: quat, v: ReadonlyVec3) => mat4;
        fromRotationTranslationScale: (out: mat4, q: quat, v: ReadonlyVec3, s: ReadonlyVec3) => mat4;
        fromRotationTranslationScaleOrigin: (out: mat4, q: quat, v: ReadonlyVec3, s: ReadonlyVec3, o: ReadonlyVec3) => mat4;
        fromQuat2: (out: mat4, a: ReadonlyQuat2) => mat4;
        set: (out: mat4, m00: number, m01: number, m02: number, m03: number, m10: number, m11: number, m12: number, m13: number, m20: number, m21: number, m22: number, m23: number, m30: number, m31: number, m32: number, m33: number) => mat4;
        transpose: (out: mat4, a: ReadonlyMat4) => mat4;
        adjoint: (out: mat4, a: ReadonlyMat4) => mat4;
        translate: (out: mat4, a: ReadonlyMat4, v: ReadonlyVec3) => mat4;
        scale: (out: mat4, a: ReadonlyMat4, v: ReadonlyVec3) => mat4;
        rotate: (out: mat4, a: ReadonlyMat4, rad: number, axis: ReadonlyVec3) => mat4;
        rotateX: (out: mat4, a: ReadonlyMat4, rad: number) => mat4;
        rotateY: (out: mat4, a: ReadonlyMat4, rad: number) => mat4;
        rotateZ: (out: mat4, a: ReadonlyMat4, rad: number) => mat4;
        getTranslation: (out: vec3, mat: ReadonlyMat4) => vec3;
        getScaling: (out: vec3, mat: ReadonlyMat4) => vec3;
        getRotation: (out: quat, mat: ReadonlyMat4) => quat;
        decompose: (out_r: quat, out_t: vec3, out_s: vec3, mat: ReadonlyMat4) => quat;
        fromQuat: (out: mat4, q: ReadonlyQuat) => mat4;
        frustum: (out: mat4, left: number, right: number, bottom: number, top: number, near: number, far: number) => mat4;
        perspectiveNO: (out: mat4, fovy: number, aspect: number, near: number, far: number) => mat4;
        perspective: (out: mat4, fovy: number, aspect: number, near: number, far: number) => mat4;
        perspectiveZO: (out: mat4, fovy: number, aspect: number, near: number, far: number) => mat4;
        perspectiveFromFieldOfView: (out: mat4, fov: number, near: number, far: number) => mat4;
        orthoNO: (out: mat4, left: number, right: number, bottom: number, top: number, near: number, far: number) => mat4;
        ortho: (out: mat4, left: number, right: number, bottom: number, top: number, near: number, far: number) => mat4;
        orthoZO: (out: mat4, left: number, right: number, bottom: number, top: number, near: number, far: number) => mat4;
        lookAt: (out: mat4, eye: ReadonlyVec3, center: ReadonlyVec3, up: ReadonlyVec3) => mat4;
        targetTo: (out: mat4, eye: ReadonlyVec3, target: ReadonlyVec3, up: ReadonlyVec3) => mat4;
    },
    quat: GlmBaseQ<quat, ReadonlyQuat> & {
        fromValues: (x: number, y: number, z: number, w: number) => quat;
        fromEuler: (out: quat, x: number, y: number, z: number, order?: ('zyx'|'xyz'|'yxz'|'yzx'|'zxy'|'zyx')) => quat;
        fromMat3: (out: quat, m: ReadonlyMat3) => quat;
        random: (out: quat) => quat;
        calculateW: (out: quat, a: ReadonlyQuat) => quat;
        getAngle: (a: ReadonlyQuat, b: ReadonlyQuat) => number;
        getAxisAngle: (out_axis: vec3, q: ReadonlyQuat) => number;
        exp: (out: quat, a: ReadonlyQuat) => quat;
        ln: (out: quat, a: ReadonlyQuat) => quat;
        pow: (out: quat, a: ReadonlyQuat, b: number) => quat;
        rotationTo: (out: quat, a: ReadonlyVec3, b: ReadonlyVec3) => quat;
        set: (out: quat, x: number, y: number, z: number, w: number) => quat;
        setAxes: (out: quat, view: ReadonlyVec3, right: ReadonlyVec3, up: ReadonlyVec3) => quat;
        setAxisAngle: (out: quat, axis: ReadonlyVec3, rad: number) => quat;
        slerp: (out: quat, a: ReadonlyQuat, b: ReadonlyQuat, t: number) => quat;
        sqlerp: (out: quat, a: ReadonlyQuat, b: ReadonlyQuat, c: ReadonlyQuat, d: ReadonlyQuat, t: number) => quat;
    },
    quat2: GlmBaseQ<quat2, ReadonlyQuat2> & {
        fromValues: (x1: number, y1: number, z1: number, w1: number, x2: number, y2: number, z2: number, w2: number) => quat2;
        fromRotationTranslationValues: (x1: number, y1: number, z1: number, w1: number, x2: number, y2: number, z2: number) => quat2;
        fromRotationTranslation: (out: quat2, q: ReadonlyQuat, t: ReadonlyVec3) => quat2;
        fromTranslation: (out: quat2, t: ReadonlyVec3) => quat2;
        fromRotation: (out: quat2, q: ReadonlyQuat) => quat2;
        fromMat4: (out: quat2, a: ReadonlyMat4) => quat2;
        getReal: (out: quat2, a: ReadonlyVec4) => quat2;
        getDual: (out: quat, a: ReadonlyQuat2) => quat;
        getTranslation: (out: vec3, a: ReadonlyQuat2) => vec3;
        rotateByQuatAppend: (out: quat2, a: ReadonlyQuat2, q: ReadonlyQuat) => quat2;
        rotateByQuatPrepend: (out: quat2, q: ReadonlyQuat, a: ReadonlyQuat2) => quat2;
        rotateAroundAxis: (out: quat2, a: ReadonlyQuat2, axis: ReadonlyVec3, rad: number) => quat2;
        set: (out: quat2, x1: number, y1: number, z1: number, w1: number, x2: number, y2: number, z2: number, w2: number) => quat2;
        setReal: (out: quat2, a: ReadonlyVec4) => quat2;
        setDual: (out: quat2, q: ReadonlyQuat) => quat2;
        translate: (out: quat2, a: ReadonlyQuat2, v: ReadonlyVec3) => quat2;
    },
    vec2: GlmBaseV<vec2, ReadonlyVec2> & {
        fromValues: (x: number, y: number) => vec2;
        angle: (a: ReadonlyVec2, b: ReadonlyVec2) => number;
        cross: (out: vec2, a: ReadonlyVec2, b: ReadonlyVec2) => vec2;
        set: (out: vec2, x: number, y: number) => vec2;
        rotate: (out: vec2, a: ReadonlyVec2, b: ReadonlyVec2, rad: number) => vec2;
        transformMat2: (out: vec2, a: ReadonlyVec2, m: ReadonlyMat2) => vec2;
        transformMat2d: (out: vec2, a: ReadonlyVec2, m: ReadonlyMat2d) => vec2;
        transformMat3: (out: vec2, a: ReadonlyVec2, m: ReadonlyMat3) => vec2;
    },
    vec3: GlmBaseV<vec3, ReadonlyVec3> & {
        fromValues: (x: number, y: number, z: number) => vec3;
        angle: (a: ReadonlyVec3, b: ReadonlyVec3) => number;
        cross: (out: vec3, a: ReadonlyVec3, b: ReadonlyVec3) => vec3;
        bezier: (out: vec3, a: ReadonlyVec3, b: ReadonlyVec3, c: ReadonlyVec3, d: ReadonlyVec3, t: number) => vec3;
        hermite: (out: vec3, a: ReadonlyVec3, b: ReadonlyVec3, c: ReadonlyVec3, d: ReadonlyVec3, t: number) => vec3;
        rotateX: (out: vec3, a: ReadonlyVec3, b: ReadonlyVec3, rad: number) => vec3;
        rotateY: (out: vec3, a: ReadonlyVec3, b: ReadonlyVec3, rad: number) => vec3;
        rotateZ: (out: vec3, a: ReadonlyVec3, b: ReadonlyVec3, rad: number) => vec3;
        set: (out: vec3, x: number, y: number, z: number) => vec3;
        slerp: (out: vec3, a: ReadonlyVec3, b: ReadonlyVec3, t: number) => vec3;
        transformMat3: (out: vec3, a: ReadonlyVec3, m: ReadonlyMat3) => vec3;
        transformQuat: (out: vec3, a: ReadonlyVec3, q: ReadonlyQuat) => vec3;
    },
    vec4: GlmBaseV<vec4, ReadonlyVec4> & {
        fromValues: (x: number, y: number, z: number, w: number) => vec4;
        cross: (out: vec4, u: ReadonlyVec4, v: ReadonlyVec4, w: ReadonlyVec4) => vec4;
        set: (out: vec4, x: number, y: number, z: number, w: number) => vec4;
        transformQuat: (out: vec4, a: ReadonlyVec4, q: ReadonlyQuat) => vec4;
    },
    glMatrix: {
        EPSILON: number;
        ARRAY_TYPE: ArrayConstructor | Float32ArrayConstructor;
        RANDOM: () => number;
        ANGLE_ORDER: string;
        setMatrixArrayType: (type: Float32ArrayConstructor | ArrayConstructor) => void;
        toRadian: (a: number) => number;
        equals: (a: number, b: number) => boolean;
    },
}>;

type GLMatrix = typeof glMatrix;
