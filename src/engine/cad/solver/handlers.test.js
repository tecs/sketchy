import '../../../../libs/gl-matrix.js';

import assert from 'node:assert';
import { describe, it } from 'node:test';
import handlers from './handlers.js';
import { PRIMITIVE_TYPE } from './solver.js';
import { EXPRESSION_NAME, EXPRESSION_TYPE } from './parser.js';

const { NUMBER, QUANTITY, STRING, BOOLEAN } = PRIMITIVE_TYPE;
const { FUNCTION, OPERATOR, UNARY } = EXPRESSION_TYPE;

/**
 * @param {string} name
 * @param {import("./solver.js").SolverParam["type"]} type
 * @returns {FnParam["handler"]}
 */
const tryGetHandler = (name, type) => {
  const handler = handlers.find(h => h.name === name && h.type === type);
  if (handler && 'handler' in handler) return handler.handler;
  throw new Error(`Handlers have no ${EXPRESSION_NAME[type]} named "${name}"`);
};

/**
 *
 * @param {Primitive} primitive
 * @returns {Primitive}
 */
const snapValue = (primitive) => {
  switch (primitive.type) {
    case NUMBER:
    case QUANTITY:
      const value = Math.round(primitive.value);
      if (Math.abs(primitive.value - value) <= Number.EPSILON) return {...primitive, value };
  }
  return primitive;
};

/** @typedef {import("./solver.js").Num} Num */
/** @typedef {import("./solver.js").Quant} Quant */
/** @typedef {import("./solver.js").Str} Str */
/** @typedef {import("./solver.js").Bool} Bool */
/** @typedef {import("./solver.js").Primitive} Primitive */
/** @typedef {import("./solver.js").FnParam} FnParam */

describe('handlers', () => {
  const number = /** @type {const} */ ({ type: NUMBER });
  const string = /** @type {const} */ ({ type: STRING });
  const distance = /** @type {const} */ ({ type: QUANTITY, quantity: 'distance' });
  const angle = /** @type {const} */ ({ type: QUANTITY, quantity: 'angle' });

  /** @type {Num} */
  const number0 = { ...number, value: 0 };

  /** @type {Num} */
  const number1 = { ...number, value: 1 };

  /** @type {Num} */
  const number2 = { ...number, value: 2 };

  /** @type {Num} */
  const number3 = { ...number, value: 3 };

  /** @type {Str} */
  const stringFoo = { ...string, value: 'foo' };

  /** @type {Str} */
  const stringBar = { ...string, value: 'bar' };

  /** @type {Str} */
  const stringFoobar = { ...string, value: 'foobar' };

  /** @type {Bool} */
  const boolTrue = { type: BOOLEAN, value: true };

  /** @type {Bool} */
  const boolFalse = { type: BOOLEAN, value: false };

  /** @type {Quant} */
  const quant0mm = { ...distance, value: 0 };

  /** @type {Quant} */
  const quant1mm = { ...distance, value: 1 };

  /** @type {Quant} */
  const quant2mm = { ...distance, value: 2 };

  /** @type {Quant} */
  const quant0rad = { ...angle, value: 0 };

  /** @type {Quant} */
  const quant1rad = { ...angle, value: 1 };

  /** @type {Quant} */
  const quantHalfPIrad = { ...angle, value: Math.PI * 0.5 };

  it('abs()', () => {
    const handler = tryGetHandler('abs', FUNCTION);
    assert.deepStrictEqual(handler({ ...number, value: -1 }), number1);
    assert.deepStrictEqual(handler(number1), number1);
    assert.deepStrictEqual(handler(quant1mm), quant1mm);
    assert.deepStrictEqual(handler({ ...distance, value: -1 }), quant1mm);
  });

  it('ceil()', () => {
    const handler = tryGetHandler('ceil', FUNCTION);
    assert.deepStrictEqual(handler({ ...number, value: 0.5 }), number1);
    assert.deepStrictEqual(handler({ ...distance, value: 0.5 }), quant1mm);
  });

  it('floor()', () => {
    const handler = tryGetHandler('floor', FUNCTION);
    assert.deepStrictEqual(handler({ ...number, value: 1.5 }), number1);
    assert.deepStrictEqual(handler({ ...distance, value: 1.5 }), quant1mm);
  });

  it('round()', () => {
    const handler = tryGetHandler('round', FUNCTION);
    assert.deepStrictEqual(handler({ ...number, value: 1.4 }), number1);
    assert.deepStrictEqual(handler({ ...number, value: 0.6 }), number1);
    assert.deepStrictEqual(handler({ ...distance, value: 1.4 }), quant1mm);
    assert.deepStrictEqual(handler({ ...distance, value: 0.6 }), quant1mm);
  });

  it('fract()', () => {
    const handler = tryGetHandler('fract', FUNCTION);
    assert.deepStrictEqual(handler({ ...number, value: 1.5 }), { ...number, value: 0.5 });
    assert.deepStrictEqual(
      handler({ ...distance, value: 1.5 }),
      { ...distance, value: 0.5 },
    );
  });

  it('trunc()', () => {
    const handler = tryGetHandler('trunc', FUNCTION);
    assert.deepStrictEqual(handler({ ...number, value: 1.8 }), number1);
    assert.deepStrictEqual(handler({ ...distance, value: 1.8 }), quant1mm);
  });

  it('min()', () => {
    const handler = tryGetHandler('min', FUNCTION);
    assert.deepStrictEqual(handler(number0, number1), number0);
    assert.deepStrictEqual(handler(quant1mm, quant2mm), quant1mm);
  });

  it('min() throws on mismatched argument types', () => {
    const handler = tryGetHandler('min', FUNCTION);
    assert.throws(
      () => handler(number0, quant1mm),
      /min expects all arguments to be of the same type, got number and distance/,
    );
    assert.throws(
      () => handler(quant1mm, quant0rad),
      /min expects all arguments to be of the same type, got distance and angle/,
    );
  });

  it('max()', () => {
    const handler = tryGetHandler('max', FUNCTION);
    assert.deepStrictEqual(handler(number0, number1), number1);
    assert.deepStrictEqual(handler(quant1mm, quant0mm), quant1mm);
  });

  it('max() throws on mismatched argument types', () => {
    const handler = tryGetHandler('max', FUNCTION);
    assert.throws(
      () => handler(number0, quant1mm),
      /max expects all arguments to be of the same type, got number and distance/,
    );
    assert.throws(
      () => handler(quant1mm, quant0rad),
      /max expects all arguments to be of the same type, got distance and angle/,
    );
  });

  it('pow()', () => {
    const handler = tryGetHandler('pow', FUNCTION);
    assert.deepStrictEqual(handler(number2, number2), { ...number, value: 4 });
    assert.deepStrictEqual(handler(quant2mm, number2), { ...distance, value: 4 });
  });

  it('sqrt()', () => {
    const handler = tryGetHandler('sqrt', FUNCTION);
    assert.deepStrictEqual(handler({ ...number, value: 4 }), number2);
    assert.deepStrictEqual(handler({ ...distance, value: 4 }), quant2mm);
  });

  it('sign()', () => {
    const handler = tryGetHandler('sign', FUNCTION);
    assert.deepStrictEqual(handler(number2), number1);
    assert.deepStrictEqual(handler({ ...number, value: -2 }), { ...number, value: -1});
    assert.deepStrictEqual(handler(quant2mm), quant1mm);
    assert.deepStrictEqual(handler({ ...distance, value: -2 }), { ...distance, value: -1});
  });

  it('log()', () => {
    const { E } = Math;
    const handler = tryGetHandler('log', FUNCTION);
    assert.deepStrictEqual(handler({ ...number, value: E }), number1);
    assert.deepStrictEqual(handler({ ...number, value: E * E }), number2);
    assert.deepStrictEqual(handler({ ...distance, value: E * E }), quant2mm);
  });

  it('log@()', () => {
    const handler = tryGetHandler('log2', FUNCTION);
    assert.deepStrictEqual(handler({ ...number, value: 2 }), number1);
    assert.deepStrictEqual(handler({ ...number, value: 4 }), number2);
    assert.deepStrictEqual(handler({ ...distance, value: 4 }), quant2mm);

  });

  it('log10()', () => {
    const handler = tryGetHandler('log10', FUNCTION);
    assert.deepStrictEqual(handler({ ...number, value: 10 }), number1);
    assert.deepStrictEqual(handler({ ...number, value: 100 }), number2);
    assert.deepStrictEqual(handler({ ...distance, value: 100 }), quant2mm);
  });

  it('sin()', () => {
    const handler = tryGetHandler('sin', FUNCTION);
    assert.deepStrictEqual(snapValue(handler(number0)), number0);
    assert.deepStrictEqual(snapValue(handler({ ...number, value: quantHalfPIrad.value })), number1);
    assert.deepStrictEqual(snapValue(handler(quantHalfPIrad)), number1);
  });

  it('sin() throws on wrong quantity', () => {
    const handler = tryGetHandler('sin', FUNCTION);
    assert.throws(() => handler(quant1mm), /sin expects an angle argument, got distance/);
  });

  it('cos()', () => {
    const handler = tryGetHandler('cos', FUNCTION);
    assert.deepStrictEqual(snapValue(handler(number0)), number1);
    assert.deepStrictEqual(snapValue(handler({ ...number, value: quantHalfPIrad.value })), number0);
    assert.deepStrictEqual(snapValue(handler(quantHalfPIrad)), number0);
  });

  it('cos() throws on wrong quantity', () => {
    const handler = tryGetHandler('cos', FUNCTION);
    assert.throws(() => handler(quant1mm), /cos expects an angle argument, got distance/);
  });

  it('tan()', () => {
    const handler = tryGetHandler('tan', FUNCTION);
    assert.deepStrictEqual(snapValue(handler(number0)), number0);
    assert.deepStrictEqual(snapValue(handler({ ...number, value: Math.PI * 0.25 })), number1);
    assert.deepStrictEqual(snapValue(handler({ ...angle, value: Math.PI * 0.25 })), number1);
  });

  it('tan() throws on wrong quantity', () => {
    const handler = tryGetHandler('tan', FUNCTION);
    assert.throws(() => handler(quant1mm), /tan expects an angle argument, got distance/);
  });

  it('asin()', () => {
    const handler = tryGetHandler('asin', FUNCTION);
    assert.deepStrictEqual(snapValue(handler(number0)), quant0rad);
    assert.deepStrictEqual(snapValue(handler({ ...number, value: Math.sin(1) })), quant1rad);
  });

  it('acos()', () => {
    const handler = tryGetHandler('acos', FUNCTION);
    assert.deepStrictEqual(snapValue(handler(number1)), quant0rad);
    assert.deepStrictEqual(snapValue(handler({ ...number, value: Math.cos(1) })), quant1rad);
  });

  it('atan()', () => {
    const handler = tryGetHandler('atan', FUNCTION);
    assert.deepStrictEqual(snapValue(handler(number0)), quant0rad);
    assert.deepStrictEqual(snapValue(handler({ ...number, value: Math.tan(1) })), quant1rad);
  });

  it('atan2()', () => {
    const handler = tryGetHandler('atan2', FUNCTION);
    assert.deepStrictEqual(snapValue(handler(number1, number0)), quant0rad);
    assert.deepStrictEqual(
      snapValue(handler({ ...number, value: Math.cos(1) }, { ...number, value: Math.sin(1) })),
      quant1rad,
    );
  });

  it('sinh()', () => {
    const handler = tryGetHandler('sinh', FUNCTION);
    assert.deepStrictEqual(snapValue(handler(number0)), number0);
    assert.deepStrictEqual(snapValue(handler({ ...number, value: Math.asinh(1) })), number1);
  });

  it('cosh()', () => {
    const handler = tryGetHandler('cosh', FUNCTION);
    assert.deepStrictEqual(snapValue(handler(number0)), number1);
    assert.deepStrictEqual(snapValue(handler({ ...number, value: Math.acosh(2) })), number2);
  });

  it('tanh()', () => {
    const handler = tryGetHandler('tanh', FUNCTION);
    assert.deepStrictEqual(snapValue(handler(number0)), number0);
    assert.deepStrictEqual(snapValue(handler({ ...number, value: Math.atanh(1) })), number1);
  });

  it('asinh()', () => {
    const handler = tryGetHandler('asinh', FUNCTION);
    assert.deepStrictEqual(snapValue(handler(number0)), number0);
    assert.deepStrictEqual(snapValue(handler({ ...number, value: Math.sinh(1) })), number1);
  });

  it('acosh()', () => {
    const handler = tryGetHandler('acosh', FUNCTION);
    assert.deepStrictEqual(snapValue(handler(number1)), number0);
    assert.deepStrictEqual(snapValue(handler({ ...number, value: Math.cosh(1) })), number1);
  });

  it('atanh()', () => {
    const handler = tryGetHandler('atanh', FUNCTION);
    assert.deepStrictEqual(snapValue(handler(number0)), number0);
    assert.deepStrictEqual(snapValue(handler({ ...number, value: Math.tanh(1) })), number1);
  });

  it('substr()', () => {
    const handler = tryGetHandler('substr', FUNCTION);
    assert.deepStrictEqual(handler(stringFoobar, number0, number3), stringFoo);
    assert.deepStrictEqual(handler(stringFoobar, number3, { ...number, value: 6 }), stringBar);
  });

  it('concat()', () => {
    const handler = tryGetHandler('concat', FUNCTION);
    assert.deepStrictEqual(handler(stringFoo, stringBar), stringFoobar);
  });

  it('find()', () => {
    const handler = tryGetHandler('find', FUNCTION);
    assert.deepStrictEqual(handler(stringFoobar, stringBar), number3);
    assert.deepStrictEqual(handler(stringFoo, stringBar), { ...number, value: -1 });
  });

  it('regexfind()', () => {
    const handler = tryGetHandler('regexfind', FUNCTION);
    assert.deepStrictEqual(handler(stringFoobar, stringBar), number3);
    assert.deepStrictEqual(handler(stringFoobar, { ...string, value: '/O+./i' }), number1);
    assert.deepStrictEqual(handler(stringFoo, stringBar), { ...number, value: -1 });
  });

  it('regexmatch()', () => {
    const handler = tryGetHandler('regexmatch', FUNCTION);
    assert.deepStrictEqual(handler(stringFoobar, stringBar), stringBar);
    assert.deepStrictEqual(handler(stringFoobar, { ...string, value: '/O+./i' }), { ...string, value: 'oob' });
    assert.deepStrictEqual(handler(stringFoo, stringBar), { ...string, value: '' });
  });

  it('replace()', () => {
    const handler = tryGetHandler('replace', FUNCTION);
    assert.deepStrictEqual(handler(stringFoobar, stringFoo, stringBar), { ...string, value: 'barbar' });
    assert.deepStrictEqual(handler(stringBar, stringFoo, stringFoobar), stringBar);
  });

  it('replaceall()', () => {
    const handler = tryGetHandler('replaceall', FUNCTION);
    assert.deepStrictEqual(handler(stringFoobar, { ...string, value: 'o' }, stringBar), { ...string, value: 'fbarbarbar' });
    assert.deepStrictEqual(handler(stringBar, stringFoo, stringFoobar), stringBar);
  });

  it('regexreplace()', () => {
    const handler = tryGetHandler('regexreplace', FUNCTION);
    assert.deepStrictEqual(handler(stringFoobar, stringFoo, stringBar), { ...string, value: 'barbar' });
    assert.deepStrictEqual(handler(stringFoobar, { ...string, value: '/O/i' }, stringFoo), { ...string, value: 'ffooobar' });
    assert.deepStrictEqual(
      handler(stringFoobar, { ...string, value: '/([fb].)/g' }, { ...string, value: '$1s' }),
      { ...string, value: 'fosobasr' },
    );
    assert.deepStrictEqual(handler(stringBar, stringFoo, stringFoobar), stringBar);
  });

  it('len()', () => {
    const handler = tryGetHandler('len', FUNCTION);
    assert.deepStrictEqual(handler(stringFoo), number3);
  });

  it('padstart()', () => {
    const handler = tryGetHandler('padstart', FUNCTION);
    assert.deepStrictEqual(handler(stringFoo, number1, stringBar), stringFoo);
    assert.deepStrictEqual(handler(stringFoo, { ...number, value: 10 }, stringBar), { ...string, value: 'barbarbfoo' });
  });

  it('padend()', () => {
    const handler = tryGetHandler('padend', FUNCTION);
    assert.deepStrictEqual(handler(stringFoo, number1, stringBar), stringFoo);
    assert.deepStrictEqual(handler(stringFoo, { ...number, value: 10 }, stringBar), { ...string, value: 'foobarbarb' });
  });

  it('repeat()', () => {
    const handler = tryGetHandler('repeat', FUNCTION);
    assert.deepStrictEqual(handler(stringFoo, number3), { ...string, value: 'foofoofoo' });
  });

  it('uppercase()', () => {
    const handler = tryGetHandler('uppercase', FUNCTION);
    assert.deepStrictEqual(handler(stringFoobar), { ...string, value: 'FOOBAR' });
  });

  it('lowercase()', () => {
    const handler = tryGetHandler('lowercase', FUNCTION);
    assert.deepStrictEqual(handler({ ...string, value: 'FOOBAR' }), stringFoobar);
  });

  it('unary +', () => {
    const handler = tryGetHandler('+', UNARY);
    assert.deepStrictEqual(handler(number1), number1);
    assert.deepStrictEqual(handler({ ...distance, value: -1 }), { ...distance, value: -1 });
  });

  it('unary -', () => {
    const handler = tryGetHandler('-', UNARY);
    assert.deepStrictEqual(handler(number1), { ...number, value: -1 });
    assert.deepStrictEqual(handler({ ...distance, value: -1 }), quant1mm);
  });

  it('unary !', () => {
    const handler = tryGetHandler('!', UNARY);
    assert.deepStrictEqual(handler(boolTrue), boolFalse);
    assert.deepStrictEqual(handler(boolFalse), boolTrue);
  });

  it('operator ^', () => {
    const handler = tryGetHandler('^', OPERATOR);
    assert.deepStrictEqual(handler(number2, number2), { ...number, value: 4 });
    assert.deepStrictEqual(handler(quant2mm, number2), { ...distance, value: 4 });
  });

  it('operator *', () => {
    const handler = tryGetHandler('*', OPERATOR);
    assert.deepStrictEqual(handler(number1, number2), number2);
    assert.deepStrictEqual(handler(number1, quant2mm), quant2mm);
    assert.deepStrictEqual(handler(quant1mm, number2), quant2mm);
  });

  it('operator * throws on two quantity operands', () => {
    const handler = tryGetHandler('*', OPERATOR);
    assert.throws(() => handler(quant1mm, quant2mm), /cannot multiply distance with distance/i);
  });

  it('operator /', () => {
    const handler = tryGetHandler('/', OPERATOR);
    assert.deepStrictEqual(handler(number2, number2), number1);
    assert.deepStrictEqual(handler(quant2mm, number2), quant1mm);
    assert.deepStrictEqual(handler(quant2mm, quant2mm), number1);
  });

  it('operator / throws on right operand equals zero', () => {
    const handler = tryGetHandler('/', OPERATOR);
    assert.throws(() => handler(number2, number0), /division by zero/i);
  });

  it('operator / throws on mismatched operands types when right operand is a quantity', () => {
    const handler = tryGetHandler('/', OPERATOR);
    assert.throws(() => handler(number2, quant2mm), /cannot divide number by distance/i);
    assert.throws(() => handler(quant0rad, quant1mm), /cannot divide angle by distance/i);
  });

  it('operator %', () => {
    const handler = tryGetHandler('%', OPERATOR);
    assert.deepStrictEqual(handler(number3, number2), number1);
    assert.deepStrictEqual(handler(quant1mm, number2), quant1mm);
    assert.deepStrictEqual(handler(quant2mm, number2), quant0mm);
  });

  it('operator % throws on right operand equals zero', () => {
    const handler = tryGetHandler('%', OPERATOR);
    assert.throws(() => handler(number2, number0), /division by zero/i);
  });

  it('operator +', () => {
    const handler = tryGetHandler('+', OPERATOR);
    assert.deepStrictEqual(handler(number1, number2), number3);
    assert.deepStrictEqual(handler(quant1mm, quant1mm), quant2mm);
  });

  it('operator + throws on mismatched operands types', () => {
    const handler = tryGetHandler('+', OPERATOR);
    assert.throws(() => handler(number2, quant2mm), /cannot add distance to number/i);
    assert.throws(() => handler(quant0rad, quant1mm), /cannot add distance to angle/i);
  });

  it('operator -', () => {
    const handler = tryGetHandler('-', OPERATOR);
    assert.deepStrictEqual(handler(number3, number2), number1);
    assert.deepStrictEqual(handler(quant2mm, quant1mm), quant1mm);
  });

  it('operator - throws on mismatched operands types', () => {
    const handler = tryGetHandler('-', OPERATOR);
    assert.throws(() => handler(number2, quant2mm), /cannot subtract distance from number/i);
    assert.throws(() => handler(quant0rad, quant1mm), /cannot subtract distance from angle/i);
  });

  it('operator <<', () => {
    const handler = tryGetHandler('<<', OPERATOR);
    assert.deepStrictEqual(handler(number1, number1), number2);
    assert.deepStrictEqual(handler(quant1mm, number2), { ...distance, value: 4 });
  });

  it('operator >>', () => {
    const handler = tryGetHandler('>>', OPERATOR);
    assert.deepStrictEqual(handler(number2, number1), number1);
    assert.deepStrictEqual(handler({ ...distance, value: 4 }, number2), quant1mm);
  });

  it('operator <', () => {
    const handler = tryGetHandler('<', OPERATOR);
    assert.deepStrictEqual(handler(number1, number2), boolTrue);
    assert.deepStrictEqual(handler(number2, number1), boolFalse);
    assert.deepStrictEqual(handler(number1, number1), boolFalse);
    assert.deepStrictEqual(handler(quant1mm, quant2mm), boolTrue);
  });

  it('operator < throws on mismatched operands', () => {
    const handler = tryGetHandler('<', OPERATOR);
    assert.throws(() => handler(number2, quant2mm), /cannot compare number with distance/i);
    assert.throws(() => handler(quant0rad, quant1mm), /cannot compare angle with distance/i);
  });

  it('operator <=', () => {
    const handler = tryGetHandler('<=', OPERATOR);
    assert.deepStrictEqual(handler(number1, number2), boolTrue);
    assert.deepStrictEqual(handler(number2, number1), boolFalse);
    assert.deepStrictEqual(handler(number1, number1), boolTrue);
    assert.deepStrictEqual(handler(quant1mm, quant2mm), boolTrue);
  });

  it('operator <= throws on mismatched operands', () => {
    const handler = tryGetHandler('<=', OPERATOR);
    assert.throws(() => handler(number2, quant2mm), /cannot compare number with distance/i);
    assert.throws(() => handler(quant0rad, quant1mm), /cannot compare angle with distance/i);
  });

  it('operator >', () => {
    const handler = tryGetHandler('>', OPERATOR);
    assert.deepStrictEqual(handler(number1, number2), boolFalse);
    assert.deepStrictEqual(handler(number2, number1), boolTrue);
    assert.deepStrictEqual(handler(number1, number1), boolFalse);
    assert.deepStrictEqual(handler(quant1mm, quant2mm), boolFalse);
  });

  it('operator > throws on mismatched operands', () => {
    const handler = tryGetHandler('>', OPERATOR);
    assert.throws(() => handler(number2, quant2mm), /cannot compare number with distance/i);
    assert.throws(() => handler(quant0rad, quant1mm), /cannot compare angle with distance/i);
  });

  it('operator >=', () => {
    const handler = tryGetHandler('>=', OPERATOR);
    assert.deepStrictEqual(handler(number1, number2), boolFalse);
    assert.deepStrictEqual(handler(number2, number1), boolTrue);
    assert.deepStrictEqual(handler(number1, number1), boolTrue);
    assert.deepStrictEqual(handler(quant1mm, quant2mm), boolFalse);
  });

  it('operator >= throws on mismatched operands', () => {
    const handler = tryGetHandler('>=', OPERATOR);
    assert.throws(() => handler(number2, quant2mm), /cannot compare number with distance/i);
    assert.throws(() => handler(quant0rad, quant1mm), /cannot compare angle with distance/i);
  });

  it('operator ==', () => {
    const handler = tryGetHandler('==', OPERATOR);
    assert.deepStrictEqual(handler(number1, number2), boolFalse);
    assert.deepStrictEqual(handler(number2, number1), boolFalse);
    assert.deepStrictEqual(handler(number1, number1), boolTrue);
    assert.deepStrictEqual(handler(quant1mm, quant2mm), boolFalse);
    assert.deepStrictEqual(handler(quant0mm, number0), boolFalse);
    assert.deepStrictEqual(handler(quant1mm, quant0rad), boolFalse);
  });

  it('operator !=', () => {
    const handler = tryGetHandler('!=', OPERATOR);
    assert.deepStrictEqual(handler(number1, number2), boolTrue);
    assert.deepStrictEqual(handler(number2, number1), boolTrue);
    assert.deepStrictEqual(handler(number1, number1), boolFalse);
    assert.deepStrictEqual(handler(quant1mm, quant2mm), boolTrue);
    assert.deepStrictEqual(handler(quant0mm, number0), boolTrue);
    assert.deepStrictEqual(handler(quant1mm, quant0rad), boolTrue);
  });

  it('operator &', () => {
    const handler = tryGetHandler('&', OPERATOR);
    assert.deepStrictEqual(handler(number1, number3), number1);
    assert.deepStrictEqual(handler(quant1mm, number3), quant1mm);
  });

  it('operator & throws on two quantity operands', () => {
    const handler = tryGetHandler('&', OPERATOR);
    assert.throws(() => handler(quant1mm, quant2mm), /cannot perform binary operations on distance and distance/i);
    assert.throws(() => handler(quant1mm, quant0rad), /cannot perform binary operations on distance and angle/i);
  });

  it('operator |', () => {
    const handler = tryGetHandler('|', OPERATOR);
    assert.deepStrictEqual(handler(number1, number2), number3);
    assert.deepStrictEqual(handler(quant1mm, number2), { ...distance, value: 3 });
  });

  it('operator | throws on twp quantity operands', () => {
    const handler = tryGetHandler('|', OPERATOR);
    assert.throws(() => handler(quant1mm, quant2mm), /cannot perform binary operations on distance and distance/i);
    assert.throws(() => handler(quant1mm, quant0rad), /cannot perform binary operations on distance and angle/i);
  });

  it('operator &&', () => {
    const handler = tryGetHandler('&&', OPERATOR);
    assert.deepStrictEqual(handler(boolTrue, boolTrue), boolTrue);
    assert.deepStrictEqual(handler(boolTrue, boolFalse), boolFalse);
    assert.deepStrictEqual(handler(boolFalse, boolTrue), boolFalse);
    assert.deepStrictEqual(handler(boolFalse, boolFalse), boolFalse);
  });

  it('operator ||', () => {
    const handler = tryGetHandler('||', OPERATOR);
    assert.deepStrictEqual(handler(boolTrue, boolTrue), boolTrue);
    assert.deepStrictEqual(handler(boolTrue, boolFalse), boolTrue);
    assert.deepStrictEqual(handler(boolFalse, boolTrue), boolTrue);
    assert.deepStrictEqual(handler(boolFalse, boolFalse), boolFalse);
  });

  it('ternary operator ? :', () => {
    const handler = tryGetHandler('?', OPERATOR);
    assert.deepStrictEqual(handler(boolTrue, quant1mm, number1), quant1mm);
    assert.deepStrictEqual(handler(boolFalse, quant1mm, number1), number1);
  });
});
