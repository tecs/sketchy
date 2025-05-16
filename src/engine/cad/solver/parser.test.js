import assert from 'node:assert';
import { describe, it } from 'node:test';
import Parser, { EXPRESSION_TYPE } from './parser.js';
import { TOKEN_TYPE } from './tokenizer.js';
import syntax from './syntax.js';

const { NUMBER: T_NUM, STRING: T_STR, IDENTIFIER: T_ID, OPERATOR: T_OP } = TOKEN_TYPE;
const { NUMBER: E_NUM, QUANTITY, STRING: E_STR, IDENTIFIER: E_ID, OPERATOR: E_OP, UNARY, FUNCTION } = EXPRESSION_TYPE;

/** @typedef {import("./tokenizer.js").Token} Token */

/** @typedef {import('./parser.js').Num} Num */
/** @typedef {import('./parser.js').Val} Val */
/** @typedef {import('./parser.js').Str} Str */
/** @typedef {import('./parser.js').Ident} Ident */

describe('parser', () => {
  const parser = new Parser(syntax);

  /** @type {Token} */
  const identX = { type: T_ID, data: 'x' };

  /** @type {Token} */
  const identY = { type: T_ID, data: 'y' };

  /** @type {Token} */
  const identZ = { type: T_ID, data: 'z' };

  /** @type {Token} */
  const number1 = { type: T_NUM, data: '1' };

  /** @type {Token} */
  const number2 = { type: T_NUM, data: '2' };

  /** @type {Token} */
  const stringFoo = { type: T_STR, data: 'foo' };

  /** @type {Token} */
  const opPlus = { type: T_OP, data: '+' };

  /** @type {Token} */
  const opMinus = { type: T_OP, data: '-' };

  /** @type {Token} */
  const opComma = { type: T_OP, data: ',' };

  /** @type {Token} */
  const opStar = { type: T_OP, data: '*' };

  /** @type {Token} */
  const opLeftParen = { type: T_OP, data: '(' };

  /** @type {Token} */
  const opRightParen = { type: T_OP, data: ')' };

  /** @type {Token} */
  const opBang = { type: T_OP, data: '!' };

  /** @type {Token} */
  const opColon = { type: T_OP, data: ':' };

  /** @type {Token} */
  const opQuestion = { type: T_OP, data: '?' };

  /** @type {Num} */
  const num1 = { type: E_NUM, value: '1' };

  /** @type {Num} */
  const num2 = { type: E_NUM, value: '2' };

  /** @type {Val} */
  const value1x = { type: QUANTITY, value: '1', unit: 'x' };

  /** @type {Str} */
  const strFoo = { type: E_STR, value: 'foo' };

  /** @type {Ident} */
  const idX = { type: E_ID, name: 'x' };

  /** @type {Ident} */
  const idY = { type: E_ID, name: 'y' };

  /** @type {Ident} */
  const idZ = { type: E_ID, name: 'z' };

  it('parses empty tokens', () => {
    const ast = parser.parse([]);
    assert.deepStrictEqual(ast, null);
  });

  it('parses identifiers', () => {
    // x
    const ast = parser.parse([identX]);
    assert.deepStrictEqual(ast, idX);
  });

  it('parses strings', () => {
    // "foo"
    const ast = parser.parse([stringFoo]);
    assert.deepStrictEqual(ast, strFoo);
  });

  it('parses numbers', () => {
    // 1
    const ast = parser.parse([number1]);
    assert.deepStrictEqual(ast, num1);
  });

  it('parses numbers with units', () => {
    // 1x
    const ast = parser.parse([number1, identX]);
    assert.deepStrictEqual(ast, value1x);
  });

  it('parses operators with two operands', () => {
    // 1 + 1
    const ast = parser.parse([number1, opPlus, number1]);
    assert.deepStrictEqual(ast, { type: E_OP, name: '+', args: [num1, num1]});
  });

  it('parses unary operators', () => {
    // !z
    const ast = parser.parse([opBang, identZ]);
    assert.deepStrictEqual(ast, { type: UNARY, name: '!', args: [idZ]});
  });

  it('parses multiple unary +/- operators', () => {
    // 1 + - + - 1
    const ast = parser.parse([number1, opPlus, opMinus, opPlus, opMinus, number1]);
    assert.deepStrictEqual(ast, { type: E_OP, name: '+', args: [
      num1,
      { type: UNARY, name: '-', args: [
        { type: UNARY, name: '+', args: [
          { type: UNARY, name: '-', args: [num1] },
        ]},
      ]},
    ]});
  });

  it('parses ternary expressions', () => {
    // true ? 1 : 2
    const ast = parser.parse([identZ, opQuestion, number1, opColon, number2]);
    assert.deepStrictEqual(ast, { type: E_OP, name: '?', args: [idZ, num1, num2]});
  });

  it('parses functions', () => {
    // x()
    const ast = parser.parse([identX, opLeftParen, opRightParen]);
    assert.deepStrictEqual(ast, { type: FUNCTION, name: 'x', args: [] });
  });

  it('parses functions with arguments', () => {
    // x(1x, 2)
    const ast = parser.parse([identX, opLeftParen, number1, identX, opComma, number2, opRightParen]);
    assert.deepStrictEqual(ast, { type: FUNCTION, name: 'x', args: [
      value1x,
      num2,
    ]});
  });

  it('parses functions with expressions as arguments', () => {
    // x(1 + y())
    const ast = parser.parse([identX, opLeftParen, number1, opPlus, identY, opLeftParen, opRightParen, opRightParen]);
    assert.deepStrictEqual(ast, { type: FUNCTION, name: 'x', args: [
      { type: E_OP, name: '+', args: [num1, { type: FUNCTION, name: 'y', args: [] }]},
    ]});
  });

  it('throws on dangling functions', () => {
    // x(
    /** @type {Token[]} */
    const tokens = [identX, opLeftParen];
    assert.throws(() => parser.parse(tokens));

    // x(1
    tokens.push(number1);
    assert.throws(() => parser.parse(tokens));

    // x(1,
    tokens.push(opComma);
    assert.throws(() => parser.parse(tokens));

    // x(1, x
    tokens.push(identX);
    assert.throws(() => parser.parse(tokens));
  });

  it('throws on malformed function arguments', () => {
    // x(,)
    assert.throws(() => parser.parse([identX, opLeftParen, opComma, opRightParen]));
  });

  it('parses simple groups', () => {
    // (x)
    const ast = parser.parse([opLeftParen, identX, opRightParen]);
    assert.deepStrictEqual(ast, idX);
  });

  it('parses nested groups', () => {
    // ((x))
    const ast = parser.parse([opLeftParen, opLeftParen, identX, opRightParen, opRightParen]);
    assert.deepStrictEqual(ast, idX);
  });

  it('parses groups with expressions', () => {
    // (1 + 1)
    const ast = parser.parse([opLeftParen, number1, opPlus, number1, opRightParen]);
    assert.deepStrictEqual(ast, { type: E_OP, name: '+', args: [num1, num1]});
  });

  it('throws on dangling groups', () => {
    // (
    /** @type {Token[]} */
    const tokens = [opLeftParen];
    assert.throws(() => parser.parse(tokens));

    // (1
    tokens.push(number1);
    assert.throws(() => parser.parse(tokens));

    // (1,
    tokens.push(opComma);
    assert.throws(() => parser.parse(tokens));

    // (1, x
    tokens.push(identX);
    assert.throws(() => parser.parse(tokens));
  });

  it('throws on empty groups', () => {
    // ()
    assert.throws(() => parser.parse([opLeftParen, opRightParen]));
  });

  it('throws on malformed groups', () => {
    // (,)
    assert.throws(() => parser.parse([opLeftParen, opComma, opRightParen]));
  });

  it('parses adjacent expressions', () => {
    // x + y + z
    const ast = parser.parse([identX, opPlus, identY, opPlus, identZ]);
    assert.deepStrictEqual(ast, { type: E_OP, name: '+', args: [{ type: E_OP, name: '+', args: [idX, idY] }, idZ]});
  });

  it('parses adjacent expressions with groups', () => {
    // (x + y) + z
    const ast1 = parser.parse([opLeftParen, identX, opPlus, identY, opRightParen, opPlus, identZ]);
    assert.deepStrictEqual(ast1, { type: E_OP, name: '+', args: [{ type: E_OP, name: '+', args: [idX, idY] }, idZ]});

    // x + (y + z)
    const ast2 = parser.parse([identX, opPlus, opLeftParen, identY, opPlus, identZ, opRightParen]);
    assert.deepStrictEqual(ast2, { type: E_OP, name: '+', args: [idX, { type: E_OP, name: '+', args: [idY, idZ] }]});
  });

  it('parses adjacent expressions with precedence', () => {
    // x * y + z
    const ast1 = parser.parse([identX, opStar, identY, opPlus, identZ]);
    assert.deepStrictEqual(ast1, { type: E_OP, name: '+', args: [{ type: E_OP, name: '*', args: [idX, idY] }, idZ]});

    // x + y * z
    const ast2 = parser.parse([identX, opPlus, identY, opStar, identZ]);
    assert.deepStrictEqual(ast2, { type: E_OP, name: '+', args: [idX, { type: E_OP, name: '*', args: [idY, idZ] }]});

    // x ^ y * z - x * y
    const ast3 = parser.parse([
      identX,
      { type: T_OP, data: '^' },
      identY,
      opStar,
      identZ,
      opMinus,
      identX,
      opStar,
      identY,
    ]);
    assert.deepStrictEqual(ast3, { type: E_OP, name: '-', args: [
      { type: E_OP, name: '*', args: [{ type: E_OP, name: '^', args: [idX, idY] }, idZ]},
      { type: E_OP, name: '*', args: [idX, idY] },
    ]});
  });

  it('parses complex expressions', () => {
    /** @type {Token} */
    const opSlash = { type: T_OP, data: '/' };

    // 2e-1x * (0.5 / 2)
    const ast1 = parser.parse([
      { type: T_NUM, data: '2e-1' },
      identX,
      opStar,
      opLeftParen,
      { type: T_NUM, data: '0.5' },
      opSlash,
      number2,
      opRightParen,
    ]);
    assert.deepStrictEqual(ast1, { type: E_OP, name: '*', args: [
      { type: QUANTITY, value: '2e-1', unit: 'x' },
      { type: E_OP, name: '/', args: [{ type: E_NUM, value: '0.5' }, num2]},
    ]});

    // sin(x) * pow(2, 0.2) * 1mm2 / (1. ^ .2)
    const ast2 = parser.parse([
      { type: T_ID, data: 'sin' }, opLeftParen, identX, opRightParen,
      opStar,
      { type: T_ID, data: 'pow' }, opLeftParen, number2, opComma, { type: T_NUM, data: '0.2' }, opRightParen,
      opStar,
      number1, { type: T_ID, data: 'mm2' },
      opSlash,
      opLeftParen, { type: T_NUM, data: '1.' }, { type: T_OP, data: '^' }, { type: T_NUM, data: '.2' }, opRightParen,
    ]);

    assert.deepStrictEqual(ast2, { type: E_OP, name: '/', args: [
      { type: E_OP, name: '*', args: [
        { type: E_OP, name: '*', args: [
          { type: FUNCTION, name: 'sin', args: [idX] },
          { type: FUNCTION, name: 'pow', args: [num2, { type: E_NUM, value: '0.2' }]},
        ]},
        { type: QUANTITY, value: '1', unit: 'mm2' },
      ]},
      { type: E_OP, name: '^', args: [
        { type: E_NUM, value: '1.' },
        { type: E_NUM, value: '.2' },
      ]},
    ]});

    // len("foo") % x * (!z && (1 != y) ? +1 : -1)',
    const ast3 = parser.parse([
      { type: T_ID, data: 'len' }, opLeftParen, stringFoo, opRightParen,
      { type: T_OP, data: '%' },
      identX,
      opStar,
      opLeftParen,
      /**/ opBang, identZ,
      /**/ { type: T_OP, data: '&&' }, opLeftParen, number1, { type: T_OP, data: '!=' }, identY, opRightParen,
      /**/ opQuestion, opPlus, number1,
      /**/ opColon, opMinus, number1,
      opRightParen,
    ]);
    assert.deepStrictEqual(ast3, { type: E_OP, name: '%', args: [
      { type: FUNCTION, name: 'len', args: [strFoo]},
      { type: E_OP, name: '*', args: [
        idX,
        { type: E_OP, name: '?', args: [
          { type: E_OP, name: '&&', args: [
            { type: UNARY, name: '!', args: [idZ]},
            { type: E_OP, name: '!=', args: [num1, idY]},
          ]},
          { type: UNARY, name: '+', args: [num1] },
          { type: UNARY, name: '-', args: [num1] },
        ]},
      ]},
    ]});
  });

  it('throws on non sequitur expressions', () => {
    // x 1
    assert.throws(() => parser.parse([identX, number1]), /Unexpected number "1"/);
  });
});
