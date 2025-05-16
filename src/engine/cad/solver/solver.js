import { tokenize } from './tokenizer.js';
import Parser, { EXPRESSION_TYPE, EXPRESSION_NAME } from './parser.js';
import { Properties } from '../../general/properties.js';

const {
  NUMBER,
  QUANTITY,
  STRING,
  IDENTIFIER,
  FUNCTION,
  UNARY,
  OPERATOR,
} = EXPRESSION_TYPE;

export const PRIMITIVE_TYPE = /** @type {const} */ ({
  NUMBER,
  QUANTITY,
  STRING,
  BOOLEAN: 3,
});

/** @typedef {typeof PRIMITIVE_TYPE} PrimitiveMap */
/** @typedef {Values<PrimitiveMap>} PrimitiveType */

/** @type {Record<PrimitiveType, string>} */
export const PRIMITIVE_NAME = ['number', 'quantity', 'string', 'boolean'];

/** @typedef {import("./tokenizer").Token} Token */
/** @typedef {import("./parser").Syntax} Syntax */
/** @typedef {import("./parser").Expression} Expression */
/** @typedef {import("./parser").ExpressionMap} ExpressionMap */
/** @typedef {import("./parser").ExpressionType} ExpressionType */
/** @typedef {import("./parser").Ident} Ident */
/** @typedef {import("./parser").Unary} Unary */
/** @typedef {import("./parser").Op} Op */
/** @typedef {import("./parser").Fn} Fn */
/** @typedef {import("../../general/properties.js").Unit} Unit */

/**
 * @template {ExpressionType} T
 * @template {{}} P
 * @typedef {{ type: T, name: string } & P} Param
 */

/** @typedef {{ type: PrimitiveMap["NUMBER"], value: number }} Num */
/** @typedef {{ type: PrimitiveMap["QUANTITY"], value: number, quantity: Unit["type"] }} Quant */
/** @typedef {{ type: PrimitiveMap["STRING"], value: string }} Str */
/** @typedef {{ type: PrimitiveMap["BOOLEAN"], value: boolean }} Bool */

/**
 * @template {PrimitiveType[]} A
 * @typedef {{ args: Readonly<A> | Expand<A>, handler: (...args: Remap<A, "type", Primitive>) => Primitive }} Handler
 */

/** @typedef {Num | Quant | Str | Bool} Primitive */
/** @typedef {Param<ExpressionMap["IDENTIFIER"], { value: Primitive }>} IdentParam */

/**
 * @template {PrimitiveType} [A=PrimitiveType]
 * @typedef {Param<ExpressionMap["UNARY"], Handler<[A]>>} UnaryParam
 */

/**
 * @template {PrimitiveType[]} [A=PrimitiveType[]]
 * @typedef {Param<ExpressionMap["OPERATOR"], Handler<A>>} OpParam
 */

/**
 * @template {PrimitiveType[]} [A=PrimitiveType[]]
 * @typedef {Param<ExpressionMap["FUNCTION"], Handler<A>>} FnParam
 */

/** @typedef {IdentParam|UnaryParam|OpParam|FnParam} SolverParam */

class SolverError extends Error {};

export default class Solver {
  /** @type {Parser} */
  parser;

  /** @type {SolverParam[]} */
  handlers;

  /**
   * @param {Syntax[]} syntax
   * @param {SolverParam[]} handlers
   */
  constructor(syntax, handlers) {
    this.handlers = handlers;
    this.parser = new Parser(syntax);
  }

  /**
   * @template {Ident | Unary | Op | Fn} E
   * @param {E} exp
   * @returns {Find<SolverParam, "type", E["type"]>}
   */
  tryFindParam(exp) {
    for (const param of this.handlers) {
      if (param.type === exp.type && param.name === exp.name) {
        return /** @type {Find<SolverParam, "type", E["type"]>} */ (param);
      }
    }

    throw new Error(`Undefined ${EXPRESSION_NAME[exp.type]} "${exp.name}"`);
  }

  /**
   * @param {Expression} expression
   * @returns {Primitive}
   */
  solveExpression(expression) {
    switch(expression.type) {
      case STRING:
        return expression;
      case NUMBER: {
        const value = Properties.parseNumber(expression.value);
        if (value === null) throw new Error(`Invalid number "${expression.value}"`);

        return { type: NUMBER, value };
      }
      case QUANTITY: {
        const quantity = Properties.findType(expression.unit);
        if (!quantity) throw new Error(`Unknown unit "${expression.unit}"`);

        const value = Properties.parse(`${expression.value}${expression.unit}`, quantity);
        if (value === null) throw new Error(`Invalid number "${expression.value}"`);

        return { type: QUANTITY, value, quantity };
      }
      case IDENTIFIER:
        return this.tryFindParam(expression).value;
      case OPERATOR:
      case FUNCTION:
      case UNARY:
        break;
      default:
        throw new SolverError(`Unexpected Expression type "${EXPRESSION_NAME[expression.type]}" (${expression.type})`);
    }

    const param = this.tryFindParam(expression);
    const handlerExpects = `${EXPRESSION_NAME[param.type]} "${param.name}" expects`;
    const argType = param.type === FUNCTION ? 'argument' : 'operand';
    if (expression.args.length !== param.args.length) {
      throw new Error(`${handlerExpects} ${param.args.length} ${argType}s, got ${expression.args.length} instead`);
    }

    const args = /** @type {Primitive[]} */ ([]);
    for (let i = 0; i < expression.args.length; ++i) {
      const expArg = expression.args[i];
      const arg = this.solveExpression(expArg);
      const paramArg = /** @type {PrimitiveType[]} */ (Array.isArray(param.args[i]) ? param.args[i] : [param.args[i]]);
      if (!paramArg.includes(arg.type)) {
        const got = EXPRESSION_NAME[arg.type];
        const expected = paramArg.map(index => EXPRESSION_NAME[index]);
        const expectedParam = expected.length === 1 ? expected[0] : `one of [${expected.join(', ')}]`;
        throw new Error(`${handlerExpects} ${argType} ${i + 1} to be ${expectedParam}, got ${got} instead`);
      }
      args.push(arg);
    }

    return param.handler(... /** @type {[Primitive]} */ (args));
  }

  /**
   * @param {string} formula
   * @returns {Primitive?}
   */
  solve(formula) {
    const tokens = tokenize(formula);
    const ast = this.parser.parse(tokens);
    return ast ? this.solveExpression(ast) : null;
  }
}
