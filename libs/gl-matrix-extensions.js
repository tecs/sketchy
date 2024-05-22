(function (exports) {
  exports.vec2 = Object.freeze({ ...exports.vec2, is: v => v.length === 2 });
  exports.vec3 = Object.freeze({ ...exports.vec3, is: v => v.length === 3 });
  exports.vec4 = Object.freeze({ ...exports.vec4, is: v => v.length === 4 });
  exports.mat2 = Object.freeze({ ...exports.mat2, is: v => v.length === 4 });
  exports.mat2d = Object.freeze({ ...exports.mat2d, is: v => v.length === 6 });
  exports.mat3 = Object.freeze({ ...exports.mat3, is: v => v.length === 9 });
  exports.mat4 = Object.freeze({ ...exports.mat4, is: v => v.length === 16 });
  exports.quat = Object.freeze({ ...exports.quat, is: v => v.length === 4 });
  exports.quat2 = Object.freeze({ ...exports.quat2, is: v => v.length === 8 });
})(this.glMatrix);
