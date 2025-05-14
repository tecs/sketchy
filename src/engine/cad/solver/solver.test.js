import '../../../../libs/gl-matrix.js';

import assert from 'node:assert';
import { describe, it } from 'node:test';
import { EXPRESSION_TYPE } from './parser.js';
import Solver, { PRIMITIVE_TYPE } from './solver.js';
import syntax from './syntax.js';

const { NUMBER, QUANTITY, STRING } = PRIMITIVE_TYPE;
const { IDENTIFIER, FUNCTION, OPERATOR, UNARY } = EXPRESSION_TYPE;

/** @typedef {import("./solver.js").SolverParam} SolverParam */
/** @typedef {import("./solver.js").Primitive} Primitive */
/** @typedef {import("./solver.js").PrimitiveMap} PrimitiveMap */
/** @typedef {import("./solver.js").PrimitiveType} PrimitiveType */

/** @typedef {PrimitiveMap["NUMBER"]} P_NUMBER */
/** @typedef {PrimitiveMap["QUANTITY"]} P_QUANTITY */
/** @typedef {PrimitiveMap["STRING"]} P_STRING */

/**
 * @template {PrimitiveType[]} T
 * @typedef {import("./solver.js").OpParam<T>} OpParam
 */

/**
 * @template {PrimitiveType[]} T
 * @typedef {import("./solver.js").FnParam<T>} FnParam
 */

describe('solver', () => {
  /** @type {Primitive} */
  const number1 = { type: NUMBER, value: 1 };

  /** @type {Primitive} */
  const distance100 = { type: QUANTITY, value: 100, quantity: 'distance' };

  /** @type {Primitive} */
  const stringFoo = { type: STRING, value: 'foo'};

  /** @type {import("./solver.js").IdentParam} */
  const identX = { type: IDENTIFIER, name: 'x', value: stringFoo };

  /** @type {FnParam<[P_NUMBER]>} */
  const fnDouble = { type: FUNCTION, name: 'double', args: [NUMBER], handler: d => ({
    type: d.type,
    value: d.value * 2,
  })};

  /** @type {FnParam<[P_STRING, P_NUMBER]>} */
  const fnSubstr = { type: FUNCTION, name: 'substr', args: [STRING, NUMBER], handler: (s, n) => ({
    type: s.type,
    value: s.value.substring(0, n.value),
  })};

  /** @type {FnParam<[P_STRING]>} */
  const fnLen = { type: FUNCTION, name: 'len', args: [STRING], handler: s => ({
    type: NUMBER,
    value: s.value.length,
  })};

  /** @type {OpParam<[P_NUMBER, P_NUMBER]>} */
  const opAdd = { type: OPERATOR, name: '+', args: [NUMBER, NUMBER], handler: (a, b) => ({
    type: a.type,
    value: a.value + b.value,
  })};

  /** @type {OpParam<[P_NUMBER | P_QUANTITY, P_NUMBER | P_QUANTITY]>} */
  const opMul = { type: OPERATOR, name: '*', args: [[NUMBER, QUANTITY], [NUMBER, QUANTITY]], handler: (a, b) => {
    const isAQuant = 'quantity' in a;
    const isBQuant = 'quantity' in b;
    if (isAQuant && isBQuant) throw new Error(`Cannot multiply ${a.quantity} with ${b.quantity}`);

    const value = a.value * b.value;

    if (isAQuant) return { ...a, value };
    if (isBQuant) return { ...b, value };

    return { type: NUMBER, value };
  }};

  /** @type {import("./solver.js").UnaryParam<P_NUMBER>} */
  const unaryNegate = { type: UNARY, name: '-', args: [NUMBER], handler: (a) => ({ type: a.type, value: -a.value })};

  const solverEmpty = new Solver(syntax, []);
  const solverIdentXString = new Solver(syntax, /** @type {SolverParam[]} */ ([identX]));
  const solverFnXString = new Solver(syntax, /** @type {SolverParam[]} */ ([{
    type: FUNCTION,
    name: 'x',
    args: [],
    handler: () => stringFoo,
  }]));
  const solverFnWithArgs = new Solver(syntax, /** @type {SolverParam[]} */ ([fnDouble, fnSubstr]));
  const solverOp = new Solver(syntax, /** @type {SolverParam[]} */ ([opAdd, unaryNegate]));
  const solverFull = new Solver(syntax, /** @type {SolverParam[]} */ ([identX, fnLen, opAdd, opMul, unaryNegate]));

  it('solves empty formulas', () => {
    const result = solverEmpty.solve('');
    assert.deepStrictEqual(result, null);
  });

  it('solves plain values', () => {
    const result1 = solverEmpty.solve('1');
    assert.deepStrictEqual(result1, number1);

    const result2 = solverEmpty.solve('1mm');
    assert.deepStrictEqual(result2, { type: QUANTITY, value: 1, quantity: 'distance' });

    const result3 = solverEmpty.solve('"foo"');
    assert.deepStrictEqual(result3, stringFoo);
  });

  it('converts quantities to their base unit', () => {
    const result = solverEmpty.solve('1m');
    assert.deepStrictEqual(result, { type: QUANTITY, value: 1000, quantity: 'distance' });
  });

  it('converts quantities with exponents', () => {
    const result = solverEmpty.solve('1e-1m');
    assert.deepStrictEqual(result, distance100);
  });

  it('throws on unknown units', () => {
    assert.throws(() => solverEmpty.solve('1foo'), /Unknown unit "foo"/);
  });

  it('solves identifiers', () => {
    const result = solverIdentXString.solve('x');
    assert.deepStrictEqual(result, stringFoo);
  });

  it('throws on unknown identifiers', () => {
    assert.throws(() => solverIdentXString.solve('y'), /Undefined identifier "y"/);
  });

  it('solves function calls', () => {
    const result = solverFnXString.solve('x()');
    assert.deepStrictEqual(result, stringFoo);
  });

  it('solves function calls with arguments', () => {
    const result1 = solverFnWithArgs.solve('double(5e-1)');
    assert.deepStrictEqual(result1, number1);

    const result2 = solverFnWithArgs.solve('substr("foobar", 3)');
    assert.deepStrictEqual(result2, stringFoo);
  });

  it('throws on unknown functions', () => {
    assert.throws(() => solverFnXString.solve('y()'), /Undefined function "y"/);
  });

  it('throws on wrong number of arguments', () => {
    assert.throws(() => solverFnWithArgs.solve('double()'), /expects 1 arguments, got 0 instead/);
    assert.throws(() => solverFnWithArgs.solve('double(1, 2)'), /expects 1 arguments, got 2 instead/);
  });

  it('throws on wrong type of arguments', () => {
    assert.throws(() => solverFnWithArgs.solve('double("foo")'), /expects argument 1 to be number, got string instead/);
  });

  it('throws on function exceptions', () => {
    assert.throws(() => solverFull.solve('1mm * 2mm'), /Cannot multiply distance with distance/);
  });

  it('solves operators', () => {
    const result1 = solverOp.solve('0.25 + 0.75');
    assert.deepStrictEqual(result1, number1);

    const result2 = solverOp.solve('-(-1)');
    assert.deepStrictEqual(result2, number1);
  });

  it('throws on unknown operators', () => {
    assert.throws(() => solverOp.solve('1 ^ 2'), /Undefined operator "\^"/);
  });

  it('throws on wrong type of operands', () => {
    assert.throws(() => solverOp.solve('1 + "foo"'), /expects operand 2 to be number, got string instead/);
  });

  it('solves complex formulas', () => {
    const result = solverFull.solve('20mm * (-len(x) + 4 * 2)');
    assert.deepStrictEqual(result, distance100);
  });
});
