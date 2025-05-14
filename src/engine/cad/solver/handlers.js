import { EXPRESSION_TYPE } from './parser.js';
import { PRIMITIVE_TYPE } from './solver.js';

const { NUMBER, QUANTITY, STRING, BOOLEAN } = PRIMITIVE_TYPE;
const { IDENTIFIER, FUNCTION, OPERATOR, UNARY } = EXPRESSION_TYPE;

const NUM_QUANT = [NUMBER, QUANTITY];
const ANY = [NUMBER, QUANTITY, STRING, BOOLEAN];
const STRSTR = /** @type {const} */ ([STRING, STRING]);
const STRSTRSTR = /** @type {const} */ ([STRING, STRING, STRING]);

/** @typedef {import("./solver.js").SolverParam} SolverParam */
/** @typedef {import("./solver.js").Primitive} Primitive */
/** @typedef {import("./solver.js").PrimitiveMap} PrimitiveMap */
/** @typedef {import("./solver.js").PrimitiveType} PrimitiveType */
/** @typedef {import("./solver.js").Quant} Quant */
/** @typedef {import("./solver.js").Bool} Bool */

/** @typedef {PrimitiveMap["NUMBER"]} P_NUMBER */
/** @typedef {PrimitiveMap["QUANTITY"]} P_QUANTITY */
/** @typedef {PrimitiveMap["STRING"]} P_STRING */
/** @typedef {PrimitiveMap["BOOLEAN"]} P_BOOLEAN */

/** @typedef {P_NUMBER | P_QUANTITY} P_NUM_QUANT */

/**
 * @template {PrimitiveType} [T=PrimitiveType]
 * @typedef {import("./solver.js").UnaryParam<T>} UnaryParam
 */

/**
 * @template {PrimitiveType[]} [T=PrimitiveType[]]
 * @typedef {import("./solver.js").OpParam<T>} OpParam
 */

/**
 * @template {PrimitiveType[]} [T=PrimitiveType[]]
 * @typedef {import("./solver.js").FnParam<T>} FnParam
 */

/** @typedef {FnParam<[P_NUM_QUANT]>} FnNumQuantParam */
/** @typedef {OpParam<[P_NUM_QUANT, P_NUM_QUANT]>} OpTwoNumQuantParams */

/** @type {FnNumQuantParam} */
const fnAbs = { type: FUNCTION, name: 'abs', args: [NUM_QUANT], handler: n => ({ ...n, value: Math.abs(n.value) })};

/** @type {FnNumQuantParam} */
const fnCeil = { type: FUNCTION, name: 'ceil', args: [NUM_QUANT], handler: n => ({ ...n, value: Math.ceil(n.value) })};

/** @type {FnNumQuantParam} */
const fnFloor = { type: FUNCTION, name: 'floor', args: [NUM_QUANT], handler: n => ({
  ...n,
  value: Math.floor(n.value),
})};

/** @type {FnNumQuantParam} */
const fnRound = { type: FUNCTION, name: 'round', args: [NUM_QUANT], handler: n => ({
  ...n,
  value: Math.round(n.value),
})};

/** @type {FnNumQuantParam} */
const fnFract = { type: FUNCTION, name: 'fract', args: [NUM_QUANT], handler: n => ({
  ...n,
  value: n.value - Math.trunc(n.value),
})};

/** @type {FnNumQuantParam} */
const fnTrunc = { type: FUNCTION, name: 'trunc', args: [NUM_QUANT], handler: n => ({
  ...n,
  value: Math.trunc(n.value),
})};

/** @type {FnParam<[P_NUM_QUANT, P_NUM_QUANT]>} */
const fnMin = { type: FUNCTION, name: 'min', args: [NUM_QUANT, NUM_QUANT], handler: (a, b) => {
  const typeA = a.type === NUMBER ? 'number' : a.quantity;
  const typeB = b.type === NUMBER ? 'number' : b.quantity;
  if (typeA !== typeB) {
    throw new Error(`Function min expects all arguments to be of the same type, got ${typeA} and ${typeB} instead`);
  }
  return { ...a, value: Math.min(a.value, b.value) };
}};

/** @type {FnParam<[P_NUM_QUANT, P_NUM_QUANT]>} */
const fnMax = { type: FUNCTION, name: 'max', args: [NUM_QUANT, NUM_QUANT], handler: (a, b) => {
  const typeA = a.type === NUMBER ? 'number' : a.quantity;
  const typeB = b.type === NUMBER ? 'number' : b.quantity;
  if (typeA !== typeB) {
    throw new Error(`Function max expects all arguments to be of the same type, got ${typeA} and ${typeB} instead`);
  }
  return { ...a, value: Math.max(a.value, b.value) };
}};

/** @type {FnParam<[P_NUM_QUANT, P_NUMBER]>} */
const fnPow = { type: FUNCTION, name: 'pow', args: [NUM_QUANT, [NUMBER]], handler: (n, e) => ({
  ...n,
  value: Math.pow(n.value, e.value),
})};

/** @type {FnNumQuantParam} */
const fnSqrt = { type: FUNCTION, name: 'sqrt', args: [NUM_QUANT], handler: n => ({ ...n, value: Math.sqrt(n.value) })};

/** @type {FnNumQuantParam} */
const fnSign = { type: FUNCTION, name: 'sign', args: [NUM_QUANT], handler: n => ({ ...n, value: Math.sign(n.value) })};

/** @type {FnNumQuantParam} */
const fnLog = { type: FUNCTION, name: 'log', args: [NUM_QUANT], handler: n => ({ ...n, value: Math.log(n.value) })};

/** @type {FnNumQuantParam} */
const fnLog2 = { type: FUNCTION, name: 'log2', args: [NUM_QUANT], handler: n => ({ ...n, value: Math.log2(n.value) })};

/** @type {FnNumQuantParam} */
const fnLog10 = { type: FUNCTION, name: 'log10', args: [NUM_QUANT], handler: n => ({
  ...n,
  value: Math.log10(n.value),
})};

/** @type {FnNumQuantParam} */
const fnSin = { type: FUNCTION, name: 'sin', args: [NUM_QUANT], handler: angle => {
  if (angle.type === NUMBER || angle.quantity === 'angle') return { type: NUMBER, value: Math.sin(angle.value) };
  throw new Error(`Function sin expects an angle argument, got ${angle.quantity} instead`);
}};

/** @type {FnNumQuantParam} */
const fnCos = { type: FUNCTION, name: 'cos', args: [NUM_QUANT], handler: angle => {
  if (angle.type === NUMBER || angle.quantity === 'angle') return { type: NUMBER, value: Math.cos(angle.value) };
  throw new Error(`Function cos expects an angle argument, got ${angle.quantity} instead`);
}};

/** @type {FnNumQuantParam} */
const fnTan = { type: FUNCTION, name: 'tan', args: [NUM_QUANT], handler: angle => {
  if (angle.type === NUMBER || angle.quantity === 'angle') return { type: NUMBER, value: Math.tan(angle.value) };
  throw new Error(`Function tan expects an angle argument, got ${angle.quantity} instead`);
}};

/** @type {FnParam<[P_NUMBER]>} */
const fnAsin = { type: FUNCTION, name: 'asin', args: [NUMBER], handler: ({ value }) => ({
  type: QUANTITY,
  quantity: 'angle',
  value: Math.asin(value),
})};

/** @type {FnParam<[P_NUMBER]>} */
const fnAcos = { type: FUNCTION, name: 'acos', args: [NUMBER], handler: ({ value }) => ({
  type: QUANTITY,
  quantity: 'angle',
  value: Math.acos(value),
})};

/** @type {FnParam<[P_NUMBER]>} */
const fnAtan = { type: FUNCTION, name: 'atan', args: [NUMBER], handler: ({ value }) => ({
  type: QUANTITY,
  quantity: 'angle',
  value: Math.atan(value),
})};

/** @type {FnParam<[P_NUMBER, P_NUMBER]>} */
const fnAtan2 = { type: FUNCTION, name: 'atan2', args: [NUMBER, NUMBER], handler: ({ value: x }, { value: y }) => ({
  type: QUANTITY,
  quantity: 'angle',
  value: Math.atan2(y, x),
})};

/** @type {FnParam<[P_NUMBER]>} */
const fnAsinh = { type: FUNCTION, name: 'asinh', args: [NUMBER], handler: ({ value }) => ({
  type: NUMBER,
  value: Math.asinh(value),
})};

/** @type {FnParam<[P_NUMBER]>} */
const fnAcosh = { type: FUNCTION, name: 'acosh', args: [NUMBER], handler: ({ value }) => ({
  type: NUMBER,
  value: Math.acosh(value),
})};

/** @type {FnParam<[P_NUMBER]>} */
const fnAtanh = { type: FUNCTION, name: 'atanh', args: [NUMBER], handler: ({ value }) => ({
  type: NUMBER,
  value: Math.atanh(value),
})};

/** @type {FnParam<[P_NUMBER]>} */
const fnSinh = { type: FUNCTION, name: 'sinh', args: [NUMBER], handler: ({ value }) => ({
  type: NUMBER,
  value: Math.sinh(value),
})};

/** @type {FnParam<[P_NUMBER]>} */
const fnCosh = { type: FUNCTION, name: 'cosh', args: [NUMBER], handler: ({ value }) => ({
  type: NUMBER,
  value: Math.cosh(value),
})};

/** @type {FnParam<[P_NUMBER]>} */
const fnTanh = { type: FUNCTION, name: 'tanh', args: [NUMBER], handler: ({ value }) => ({
  type: NUMBER,
  value: Math.tanh(value),
})};

/** @type {FnParam<[P_STRING, P_NUMBER, P_NUMBER]>} */
const fnSubstr = { type: FUNCTION, name: 'substr', args: [STRING, NUMBER, NUMBER], handler: (str, start, end) => ({
  ...str,
  value: str.value.substring(start.value, end.value),
})};

/** @type {FnParam<[P_STRING, P_STRING]>} */
const fnConcat = { type: FUNCTION, name: 'concat', args: STRSTR, handler: (a, b) => ({
  ...a,
  value: a.value.concat(b.value),
})};

/** @type {FnParam<[P_STRING, P_STRING]>} */
const fnFind = { type: FUNCTION, name: 'find', args: STRSTR, handler: (str, sub) => ({
  type: NUMBER,
  value: str.value.indexOf(sub.value),
})};

/** @type {FnParam<[P_STRING, P_STRING]>} */
const fnRegexFind = { type: FUNCTION, name: 'regexfind', args: STRSTR, handler: (str, pattern) => {
  const parts = pattern.value.match(/^\/(.+)\/([gimuy]*)$/);
  const regex = parts ? new RegExp(parts[1], parts[2]) : new RegExp(pattern.value);

  return { type: NUMBER, value: str.value.match(regex)?.index ?? -1 };
}};

/** @type {FnParam<[P_STRING, P_STRING]>} */
const fnRegexMatch = { type: FUNCTION, name: 'regexmatch', args: STRSTR, handler: (str, pattern) => {
  const parts = pattern.value.match(/^\/(.+)\/([gimuy]*)$/);
  const regex = parts ? new RegExp(parts[1], parts[2]) : new RegExp(pattern.value);

  return { type: STRING, value: str.value.match(regex)?.[0] ?? '' };
}};

/** @type {FnParam<[P_STRING, P_STRING, P_STRING]>} */
const fnReplace = { type: FUNCTION, name: 'replace', args: STRSTRSTR, handler: (str, sub, repl) => ({
  type: STRING,
  value: str.value.replace(sub.value, repl.value),
})};

/** @type {FnParam<[P_STRING, P_STRING, P_STRING]>} */
const fnReplaceAll = { type: FUNCTION, name: 'replaceall', args: STRSTRSTR, handler: (str, sub, repl) => ({
  type: STRING,
  value: str.value.replaceAll(sub.value, repl.value),
})};

/** @type {FnParam<[P_STRING, P_STRING, P_STRING]>} */
const fnRegexReplace = { type: FUNCTION, name: 'regexreplace', args: STRSTRSTR, handler: (str, pattern, repl) => {
  const parts = pattern.value.match(/^\/(.+)\/([gimuy]*)$/);
  const regex = parts ? new RegExp(parts[1], parts[2]) : new RegExp(pattern.value);

  return { type: STRING, value: str.value.replace(regex, repl.value) };
}};

/** @type {FnParam<[P_STRING]>} */
const fnLen = { type: FUNCTION, name: 'len', args: [STRING], handler: str => ({
  type: NUMBER,
  value: str.value.length,
})};

/** @type {FnParam<[P_STRING, P_NUMBER, P_STRING]>} */
const fnPadStart = { type: FUNCTION, name: 'padstart', args: [STRING, NUMBER, STRING], handler: (str, len, fill) => ({
  ...str,
  value: str.value.padStart(len.value, fill.value),
})};

/** @type {FnParam<[P_STRING, P_NUMBER, P_STRING]>} */
const fnPadEnd = { type: FUNCTION, name: 'padend', args: [STRING, NUMBER, STRING], handler: (str, len, fill) => ({
  ...str,
  value: str.value.padEnd(len.value, fill.value),
})};

/** @type {FnParam<[P_STRING, P_NUMBER]>} */
const fnRepeat = { type: FUNCTION, name: 'repeat', args: [STRING, NUMBER], handler: (str, times) => ({
  ...str,
  value: str.value.repeat(times.value),
})};

/** @type {FnParam<[P_STRING]>} */
const fnUppercase = { type: FUNCTION, name: 'uppercase', args: [STRING], handler: str => ({
  ...str,
  value: str.value.toLocaleUpperCase(),
})};

/** @type {FnParam<[P_STRING]>} */
const fnLowercase = { type: FUNCTION, name: 'lowercase', args: [STRING], handler: str => ({
  ...str,
  value: str.value.toLocaleLowerCase(),
})};

/** @type {UnaryParam<P_NUM_QUANT>} */
const unaryPlus = { type: UNARY, name: '+', args: [NUM_QUANT], handler: v => v};

/** @type {UnaryParam<P_NUM_QUANT>} */
const unaryMinus = { type: UNARY, name: '-', args: [NUM_QUANT], handler: v => ({ ...v, value: -v.value })};

/** @type {UnaryParam<P_BOOLEAN>} */
const unaryNot = { type: UNARY, name: '!', args: [BOOLEAN], handler: v => ({ type: BOOLEAN, value: !v.value })};

/** @type {OpParam<[P_NUM_QUANT, P_NUMBER]>} */
const opExponentiate = { type: OPERATOR, name: '^', args: [NUM_QUANT, [NUMBER]], handler: fnPow.handler };

/** @type {OpTwoNumQuantParams} */
const opMultiply = { type: OPERATOR, name: '*', args: [NUM_QUANT, NUM_QUANT], handler: (a, b) => {
  if (a.type === NUMBER) return { ...b, value: b.value * a.value };
  if (b.type === NUMBER) return { ...a, value: a.value * b.value };
  throw new Error(`Cannot multiply ${a.quantity} with ${b.quantity}`);
}};

/** @type {OpTwoNumQuantParams} */
const opDivide = { type: OPERATOR, name: '/', args: [NUM_QUANT, NUM_QUANT], handler: (a, b) => {
  if (b.value === 0) throw new Error('Division by zero');
  if (b.type === NUMBER) return { ...a, value: a.value / b.value };
  if (a.type === QUANTITY && a.quantity === b.quantity) return { type: NUMBER, value: a.value / b.value };
  throw new Error(`Cannot divide ${a.type === NUMBER ? 'number' : a.quantity} by ${b.quantity}`);

}};

/** @type {OpParam<[P_NUM_QUANT, P_NUMBER]>} */
const opModulo = { type: OPERATOR, name: '%', args: [NUM_QUANT, [NUMBER]], handler: (a, b) => {
  if (b.value === 0) throw new Error('Division by zero');
  return { ...a, value: a.value % b.value };
}};

/** @type {OpTwoNumQuantParams} */
const opAdd = { type: OPERATOR, name: '+', args: [NUM_QUANT, NUM_QUANT], handler: (a, b) => {
  const typeA = a.type === NUMBER ? 'number' : a.quantity;
  const typeB = b.type === NUMBER ? 'number' : b.quantity;
  if (typeA !== typeB) throw new Error(`Cannot add ${typeB} to ${typeA}`);
  return { ...a, value: a.value + b.value };
}};

/** @type {OpTwoNumQuantParams} */
const opSubtract = { type: OPERATOR, name: '-', args: [NUM_QUANT, NUM_QUANT], handler: (a, b) => {
  const typeA = a.type === NUMBER ? 'number' : a.quantity;
  const typeB = b.type === NUMBER ? 'number' : b.quantity;
  if (typeA !== typeB) throw new Error(`Cannot subtract ${typeB} from ${typeA}`);
  return { ...a, value: a.value - b.value };
}};

/** @type {OpParam<[P_NUM_QUANT, P_NUMBER]>} */
const opBitShiftLeft = { type: OPERATOR, name: '<<', args: [NUM_QUANT, [NUMBER]], handler: (a, b) => ({
  ...a,
  value: a.value << b.value,
})};

/** @type {OpParam<[P_NUM_QUANT, P_NUMBER]>} */
const opBitShiftRight = { type: OPERATOR, name: '>>', args: [NUM_QUANT, [NUMBER]], handler: (a, b) => ({
  ...a,
  value: a.value >> b.value,
})};

/** @type {OpTwoNumQuantParams} */
const opLessThan = { type: OPERATOR, name: '<', args: [NUM_QUANT, NUM_QUANT], handler: (a, b) => {
  const typeA = a.type === NUMBER ? 'number' : a.quantity;
  const typeB = b.type === NUMBER ? 'number' : b.quantity;
  if (typeA !== typeB) throw new Error(`Cannot compare ${typeA} with ${typeB}`);
  return { type: BOOLEAN, value: a.value < b.value };
}};

/** @type {OpTwoNumQuantParams} */
const opLessOrEqualThan = { type: OPERATOR, name: '<=', args: [NUM_QUANT, NUM_QUANT], handler: (a, b) => {
  const typeA = a.type === NUMBER ? 'number' : a.quantity;
  const typeB = b.type === NUMBER ? 'number' : b.quantity;
  if (typeA !== typeB) throw new Error(`Cannot compare ${typeA} with ${typeB}`);
  return { type: BOOLEAN, value: a.value <= b.value };
}};

/** @type {OpTwoNumQuantParams} */
const opMoreThan = { type: OPERATOR, name: '>', args: [NUM_QUANT, NUM_QUANT], handler: (a, b) => {
  const typeA = a.type === NUMBER ? 'number' : a.quantity;
  const typeB = b.type === NUMBER ? 'number' : b.quantity;
  if (typeA !== typeB) throw new Error(`Cannot compare ${typeA} with ${typeB}`);
  return { type: BOOLEAN, value: a.value > b.value };
}};

/** @type {OpTwoNumQuantParams} */
const opMoreOrEqualThan = { type: OPERATOR, name: '>=', args: [NUM_QUANT, NUM_QUANT], handler: (a, b) => {
  const typeA = a.type === NUMBER ? 'number' : a.quantity;
  const typeB = b.type === NUMBER ? 'number' : b.quantity;
  if (typeA !== typeB) throw new Error(`Cannot compare ${typeA} with ${typeB}`);
  return { type: BOOLEAN, value: a.value >= b.value };
}};

/** @type {OpTwoNumQuantParams} */
const opEqual = { type: OPERATOR, name: '==', args: [NUM_QUANT, NUM_QUANT], handler: (a, b) => ({
  type: BOOLEAN,
  value: a.type === b.type && a.value === b.value && (
    a.type === NUMBER || a.quantity === /** @type {Quant} */ (b).quantity
  ),
})};

/** @type {OpTwoNumQuantParams} */
const opNotEqual = { type: OPERATOR, name: '!=', args: [NUM_QUANT, NUM_QUANT], handler: (a, b) => {
  const comparison = /** @type {Bool} */ (opEqual.handler(a, b));
  comparison.value = !comparison.value;
  return comparison;
}};

/** @type {OpTwoNumQuantParams} */
const opBinaryAnd = { type: OPERATOR, name: '&', args: [NUM_QUANT, NUM_QUANT], handler: (a, b) => {
  if (a.type === NUMBER) return { ...b, value: b.value & a.value };
  if (b.type === NUMBER) return { ...a, value: a.value & b.value };
  throw new Error(`Cannot perform binary operations on ${a.quantity} and ${b.quantity}`);
}};

/** @type {OpTwoNumQuantParams} */
const opBinaryOr = { type: OPERATOR, name: '|', args: [NUM_QUANT, NUM_QUANT], handler: (a, b) => {
  if (a.type === NUMBER) return { ...b, value: b.value | a.value };
  if (b.type === NUMBER) return { ...a, value: a.value | b.value };
  throw new Error(`Cannot perform binary operations on ${a.quantity} and ${b.quantity}`);
}};

/** @type {OpParam<[P_BOOLEAN, P_BOOLEAN]>} */
const opAnd = { type: OPERATOR, name: '&&', args: [BOOLEAN, BOOLEAN], handler: (a, b) => ({
  ...a,
  value: a.value && b.value,
})};

/** @type {OpParam<[P_BOOLEAN, P_BOOLEAN]>} */
const opOr = { type: OPERATOR, name: '||', args: [BOOLEAN, BOOLEAN], handler: (a, b) => ({
  ...a,
  value: a.value || b.value,
})};

/** @type {OpParam<[P_BOOLEAN, PrimitiveType, PrimitiveType]>} */
const ternary = { type: OPERATOR, name: '?', args: [[BOOLEAN], ANY, ANY], handler: (c, a, b) => (c.value ? a : b)};

/** @type {SolverParam[]} */
export default [
  { type: IDENTIFIER, name: 'true', value: { type: BOOLEAN, value: true } },
  { type: IDENTIFIER, name: 'false', value: { type: BOOLEAN, value: false } },
  { type: IDENTIFIER, name: 'PI', value: { type: NUMBER, value: Math.PI } },
  { type: IDENTIFIER, name: 'TAU', value: { type: NUMBER, value: Math.PI * 2 } },
  { type: IDENTIFIER, name: 'E', value: { type: NUMBER, value: Math.E } },
  /** @type {FnParam} */ (fnAbs),
  /** @type {FnParam} */ (fnCeil),
  /** @type {FnParam} */ (fnFloor),
  /** @type {FnParam} */ (fnRound),
  /** @type {FnParam} */ (fnFract),
  /** @type {FnParam} */ (fnTrunc),
  /** @type {FnParam} */ (fnMin),
  /** @type {FnParam} */ (fnMax),
  /** @type {FnParam} */ (fnPow),
  /** @type {FnParam} */ (fnSqrt),
  /** @type {FnParam} */ (fnSign),
  /** @type {FnParam} */ (fnLog),
  /** @type {FnParam} */ (fnLog2),
  /** @type {FnParam} */ (fnLog10),
  /** @type {FnParam} */ (fnSin),
  /** @type {FnParam} */ (fnCos),
  /** @type {FnParam} */ (fnTan),
  /** @type {FnParam} */ (fnAsin),
  /** @type {FnParam} */ (fnAcos),
  /** @type {FnParam} */ (fnAtan),
  /** @type {FnParam} */ (fnAtan2),
  /** @type {FnParam} */ (fnSinh),
  /** @type {FnParam} */ (fnCosh),
  /** @type {FnParam} */ (fnTanh),
  /** @type {FnParam} */ (fnAtanh),
  /** @type {FnParam} */ (fnAcosh),
  /** @type {FnParam} */ (fnAsinh),
  /** @type {FnParam} */ (fnSubstr),
  /** @type {FnParam} */ (fnConcat),
  /** @type {FnParam} */ (fnFind),
  /** @type {FnParam} */ (fnRegexFind),
  /** @type {FnParam} */ (fnRegexMatch),
  /** @type {FnParam} */ (fnReplace),
  /** @type {FnParam} */ (fnReplaceAll),
  /** @type {FnParam} */ (fnRegexReplace),
  /** @type {FnParam} */ (fnLen),
  /** @type {FnParam} */ (fnPadStart),
  /** @type {FnParam} */ (fnPadEnd),
  /** @type {FnParam} */ (fnRepeat),
  /** @type {FnParam} */ (fnUppercase),
  /** @type {FnParam} */ (fnLowercase),
  /** @type {UnaryParam} */ (unaryPlus),
  /** @type {UnaryParam} */ (unaryMinus),
  /** @type {UnaryParam} */ (unaryNot),
  /** @type {OpParam} */ (opExponentiate),
  /** @type {OpParam} */ (opMultiply),
  /** @type {OpParam} */ (opDivide),
  /** @type {OpParam} */ (opModulo),
  /** @type {OpParam} */ (opAdd),
  /** @type {OpParam} */ (opSubtract),
  /** @type {OpParam} */ (opBitShiftLeft),
  /** @type {OpParam} */ (opBitShiftRight),
  /** @type {OpParam} */ (opLessThan),
  /** @type {OpParam} */ (opLessOrEqualThan),
  /** @type {OpParam} */ (opMoreThan),
  /** @type {OpParam} */ (opMoreOrEqualThan),
  /** @type {OpParam} */ (opEqual),
  /** @type {OpParam} */ (opNotEqual),
  /** @type {OpParam} */ (opBinaryAnd),
  /** @type {OpParam} */ (opBinaryOr),
  /** @type {OpParam} */ (opAnd),
  /** @type {OpParam} */ (opOr),
  /** @type {OpParam} */ (ternary),
];
