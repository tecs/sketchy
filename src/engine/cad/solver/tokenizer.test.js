import assert from 'node:assert';
import { describe, it } from 'node:test';
import { tokenize, TOKEN_TYPE } from './tokenizer.js';

/** @typedef {import("./tokenizer.js").Token} Token */

const { NUMBER, STRING, IDENTIFIER, OPERATOR } = TOKEN_TYPE;

describe('tokenizer', () => {
  /** @type {Token} */
  const identX = { type: IDENTIFIER, data: 'x' };

  /** @type {Token} */
  const identFoo = { type: IDENTIFIER, data: 'foo' };

  /** @type {Token} */
  const identFoo2 = { type: IDENTIFIER, data: 'foo2' };

  /** @type {Token} */
  const number0 = { type: NUMBER, data: '0' };

  /** @type {Token} */
  const number1 = { type: NUMBER, data: '1' };

  /** @type {Token} */
  const opPlus = { type: OPERATOR, data: '+' };

  it('tokenizes empty formulas', () => {
    const tokens = tokenize('');
    assert.deepStrictEqual(tokens, []);
  });

  it('tokenizes single-letter identifiers', () => {
    const tokens = tokenize('x');
    assert.deepStrictEqual(tokens, [identX]);
  });

  it('tokenizes multi-letter identifiers', () => {
    const tokens = tokenize('foo');
    assert.deepStrictEqual(tokens, [identFoo]);
  });

  it('tokenizes identifiers with underscores', () => {
    const tokens = tokenize('foo_bar');
    assert.deepStrictEqual(tokens, [{ type: IDENTIFIER, data: 'foo_bar' }]);
  });

  it('tokenizes identifiers with numbers', () => {
    const tokens = tokenize('foo2');
    assert.deepStrictEqual(tokens, [identFoo2]);
  });

  it('tokenizes single-digit numbers', () => {
    const tokens = tokenize('1');
    assert.deepStrictEqual(tokens, [number1]);
  });

  it('tokenizes multi-digit numbers', () => {
    const tokens = tokenize('123');
    assert.deepStrictEqual(tokens, [{ type: NUMBER, data: '123' }]);
  });

  it('tokenizes floating-point numbers', () => {
    const tokens = tokenize('1.2');
    assert.deepStrictEqual(tokens, [{ type: NUMBER, data: '1.2' }]);
  });

  it('tokenizes numbers with exponent notation', () => {
    const tokens = tokenize('1e2');
    assert.deepStrictEqual(tokens, [{ type: NUMBER, data: '1e2' }]);
  });

  it('tokenizes numbers with negative exponent notation', () => {
    const tokens = tokenize('1e-2');
    assert.deepStrictEqual(tokens, [{ type: NUMBER, data: '1e-2' }]);
  });

  it('tokenizes numbers with units', () => {
    const tokens = tokenize('1foo');
    assert.deepStrictEqual(tokens, [number1, identFoo]);
  });

  it('tokenizes numbers with exponentiated units', () => {
    const tokens = tokenize('1foo2');
    assert.deepStrictEqual(tokens, [number1, identFoo2]);
  });

  it('tokenizes numbers with units that look like exponents', () => {
    const tokens = tokenize('1e');
    assert.deepStrictEqual(tokens, [number1, { type: IDENTIFIER, data: 'e' }]);
  });

  it('tokenizes floating-point numbers with exponent notation and units', () => {
    const tokens = tokenize('1.2e-3e4');
    assert.deepStrictEqual(tokens, [{ type: NUMBER, data: '1.2e-3' }, { type: IDENTIFIER, data: 'e4' }]);
  });

  it('tokenizes strings', () => {
    const tokens = tokenize('"foo"');
    assert.deepStrictEqual(tokens, [{ type: STRING, data: 'foo' }]);
  });

  it('tokenizes strings with spaces', () => {
    const tokens = tokenize('"foo bar"');
    assert.deepStrictEqual(tokens, [{ type: STRING, data: 'foo bar' }]);
  });

  it('tokenizes strings with escaped quotes', () => {
    const tokens = tokenize('"foo\\""');
    assert.deepStrictEqual(tokens, [{ type: STRING, data: 'foo"' }]);
  });

  it('tokenizes strings with escaped backslashes', () => {
    const tokens = tokenize('"foo\\\\"');
    assert.deepStrictEqual(tokens, [{ type: STRING, data: 'foo\\' }]);
  });

  it('tokenizes strings with backslashes', () => {
    const tokens = tokenize('"foo\\bar"');
    assert.deepStrictEqual(tokens, [{ type: STRING, data: 'foo\\bar' }]);
  });

  it('tokenizes operators', () => {
    const tokens = tokenize('+');
    assert.deepStrictEqual(tokens, [opPlus]);
  });

  it('tokenizes compound operators', () => {
    const tokens = tokenize('==');
    assert.deepStrictEqual(tokens, [{ type: OPERATOR, data: '==' }]);
  });

  it('tokenizes multi-token formulas with spaces', () => {
    const tokens = tokenize('x + 1');
    assert.deepStrictEqual(tokens, [identX, opPlus, number1]);
  });

  it('tokenizes multi-token formulas without spaces', () => {
    const tokens = tokenize('x+1');
    assert.deepStrictEqual(tokens, [identX, opPlus, number1]);
  });

  it('tokenizes complex formulas', () => {
    /** @type {Token} */
    const opComma = { type: OPERATOR, data: ',' };

    /** @type {Token} */
    const opLeftParen = { type: OPERATOR, data: '(' };

    /** @type {Token} */
    const opRightParen = { type: OPERATOR, data: ')' };

    /** @type {Token} */
    const opLeftSquareParen = { type: OPERATOR, data: '[' };

    /** @type {Token} */
    const opRightSquareParen = { type: OPERATOR, data: ']' };

    const tokens = tokenize('foo("foo bar\\baz\\\" \\\\ \\\\\\ \\\\\\\"" ) % x([1, 0], [0, 1])*(false&&!1!=1?+1:-1)');
    assert.deepStrictEqual(tokens, [
      identFoo, opLeftParen, { type: STRING, data: 'foo bar\\baz\" \\ \\\\ \\\"' }, opRightParen,
      { type: OPERATOR, data: '%' },
      identX, opLeftParen,
      /**/ opLeftSquareParen, number1, opComma, number0, opRightSquareParen, opComma,
      /**/ opLeftSquareParen, number0, opComma, number1, opRightSquareParen,
      opRightParen,
      { type: OPERATOR, data: '*' },
      opLeftParen,
      /**/ { type: IDENTIFIER, data: 'false' }, { type: OPERATOR, data: '&&' },
      /**/ { type: OPERATOR, data: '!' }, number1, { type: OPERATOR, data: '!=' }, number1,
      /**/ { type: OPERATOR, data: '?' }, opPlus, number1,
      /**/ { type: OPERATOR, data: ':' }, { type: OPERATOR, data: '-' }, number1,
      opRightParen,
    ]);
  });

  it('throws on unterminated strings', () => {
    assert.throws(() => tokenize('"foo" "bar'), /Unterminated string "bar"/);
  });

  it('throws on unterminated strings with a dangling escape character', () => {
    assert.throws(() => tokenize('"foo\\'), /Unterminated string "foo\\"/);
  });

  it('throws on unterminated strings with a dangling escaped closing quote', () => {
    assert.throws(() => tokenize('"foo\\"'), /Unterminated string "foo""/);
  });
});
