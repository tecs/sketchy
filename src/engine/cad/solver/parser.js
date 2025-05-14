import { TOKEN_TYPE, TOKEN_NAME } from './tokenizer.js';

export const EXPRESSION_TYPE = /** @type {const} */ ({
  NUMBER: 0,
  QUANTITY: 1,
  STRING: 2,
  IDENTIFIER: 3,
  FUNCTION: 4,
  UNARY: 5,
  OPERATOR: 6,
  GROUP: 7,
  EXPRESSION: 8,
  CHOICE: 9,
  LOOP: 10,
});

const {
  NUMBER,
  QUANTITY,
  STRING,
  IDENTIFIER,
  FUNCTION,
  UNARY,
  OPERATOR,
  GROUP,
  EXPRESSION,
  CHOICE,
  LOOP,
} = EXPRESSION_TYPE;

/** @typedef {typeof EXPRESSION_TYPE} ExpressionMap */
/** @typedef {Values<ExpressionMap>} ExpressionType */

/** @type {Record<ExpressionType, string>} */
export const EXPRESSION_NAME = [
  'number',
  'quantity',
  'string',
  'identifier',
  'function',
  'unary',
  'operator',
  'group',
  'expression',
  'choice',
  'loop',
];

/** @typedef {import("./tokenizer").TokenType} TokenType */
/** @typedef {import("./tokenizer").Token} Token */

/** @typedef {{ type: ExpressionMap["IDENTIFIER"], name: string }} Ident */
/** @typedef {{ type: ExpressionMap["STRING"], value: string }} Str */
/** @typedef {{ type: ExpressionMap["NUMBER"], value: string, }} Num */
/** @typedef {{ type: ExpressionMap["QUANTITY"], value: string, unit: string }} Val */
/** @typedef {{ type: ExpressionMap["FUNCTION"], name: string, args: Expression[] }} Fn */
/** @typedef {{ type: ExpressionMap["UNARY"], name: string, args: [ShallowExpression] }} Unary */
/** @typedef {{ type: ExpressionMap["OPERATOR"], name: string, args: Expression[] }} Op */
/** @typedef {{ type: ExpressionMap["GROUP"], args: Expression[] }} Group */
/** @typedef {Fn | Num | Val | Str | Ident | Group | Unary} ShallowExpression */
/** @typedef {ShallowExpression | Op} Expression */

/**
 * @template {Expression} [T=Expression]
 * @typedef TokenDefinition
 * @property {TokenType} type
 * @property {Exclude<keyof T, "type">} [target]
 * @property {string} [data]
 * @property {true} [optional]
 */

/**
 * @template {Expression} [T=Expression]
 * @typedef ExpressionDefinition
 * @property {ExpressionMap["EXPRESSION"]} type
 * @property {Exclude<keyof T, "type">} target
 * @property {true} [optional]
 */

/**
 * @template {Expression} T
 * @typedef {{ type: ExpressionMap["CHOICE"], definition: Definition<T> }} Choice
 */

/**
 * @template {Expression} T
 * @typedef {{ type: ExpressionMap["LOOP"], definition: Definition<T> }} Loop
 */

/**
 * @template {Expression} T
 * @typedef {(Definition<T> | TokenDefinition<T> | ExpressionDefinition<T> | Choice<T> | Loop<T>)[]} Definition
 */

/**
 * @template {Expression} T
 * @typedef {(TokenDefinition<T> | ExpressionDefinition<T>)[]} FlatDefinition
 */

/**
 * Makes a FlatSyntax for the supplied Expression type
 * @template {Expression} T
 * @typedef FS
 * @property {T["type"]} type
 * @property {Partial<Record<Exclude<keyof T, "type" | "args">, string>>} config
 * @property {FlatDefinition<T>} definition
 */

/**
 * Makes a Syntax for the supplied Expression type
 * @template {Expression} T
 * @typedef S
 * @property {T["type"]} type
 * @property {Definition<T>} definition
 * @property {Partial<Record<Exclude<keyof T, "type" | "args">, string>>} [config]
 */

/** @typedef {FS<Ident> | FS<Op> | FS<Num> | FS<Val> | FS<Str> | FS<Fn> | FS<Group> | FS<Unary>} FlatSyntax */
/** @typedef {S<Ident> | S<Op> | S<Num> | S<Val> | S<Str> | S<Fn> | S<Group> | S<Unary>} Syntax */

/**
 * @typedef Candidate
 * @property {FlatSyntax} syntax
 * @property {(Token | Expression)[]} stack
 * @property {number} consumed
 * @property {string} [error]
 */

/**
 * @typedef ParserState
 * @property {number} consumed
 * @property {Expression?} [leadingExpression]
 * @property {boolean} [shallow]
 * @property {string} [error]
 */

/**
 * @param {string | Token} got
 * @returns {string}
 */
const getUnexpected = (got) => {
  if (typeof got !== 'string') got = `${TOKEN_NAME[got.type]} "${got.data}"`;
  return `Unexpected ${got}`;
};

class ParserError extends Error {};

export default class Parser {
  /** @type {FlatSyntax[]} */
  syntax;

  /** @type {string[]} */
  operatorPrecedence;

  /**
   * @param {Syntax[]} syntax
   */
  constructor(syntax) {
    this.syntax = Parser.flattenSyntax(syntax);
    this.operatorPrecedence = this.syntax.reduce((acc, { type: name, definition: [, op ]}) => {
      if (name === OPERATOR && op.type === TOKEN_TYPE.OPERATOR && op.data !== undefined) acc.push(op.data);
      return acc;
    }, /** @type {string[]} */ ([]));
  }
  /**
   * @param {Definition<Expression>[]} rootDefinitions
   * @param {(TokenDefinition | ExpressionDefinition)[][]} definitions
   */
  static mergeDefinitions (rootDefinitions, definitions) {
    if (definitions.length === 0) return;

    const len = rootDefinitions.length;
    for (let i = 0; i < len; ++i) {
      const path = rootDefinitions[i];
      const basePath = path.slice();
      path.push(...definitions[0]);
      for (let k = 1; k < definitions.length; ++k) {
        rootDefinitions.push(basePath.concat(definitions[k]));
      }
    }
  }

  /**
   * @param {Definition<Expression>} definition
   * @returns {(TokenDefinition | ExpressionDefinition)[][]}
   */
  static flattenDefinition (definition) {
    const paths = /** @type {TokenDefinition[][]} */ ([[]]);
    for (const rule of definition) {
      if (Array.isArray(rule)) {
        this.mergeDefinitions(paths, this.flattenDefinition(rule));
        continue;
      }

      switch (rule.type) {
        case TOKEN_TYPE.IDENTIFIER:
        case TOKEN_TYPE.OPERATOR:
        case TOKEN_TYPE.NUMBER:
        case TOKEN_TYPE.STRING:
        case EXPRESSION:
          this.mergeDefinitions(paths, rule.optional ? [[rule], []] : [[rule]]);
          delete rule.optional;
          break;
        case CHOICE: {
          const subSequences = rule.definition.flatMap(d => {
            if ('definition' in d) return this.flattenDefinition(d.definition);
            else if (Array.isArray(d)) return this.flattenDefinition(d);
            return this.flattenDefinition([d]);
          });
          this.mergeDefinitions(paths, subSequences);
          break;
        }
        case LOOP: {
          const maxIter = 10;
          const subSequences = this.flattenDefinition(rule.definition);
          const loopSequences = subSequences.map(s => s.slice());
          for (let i = 0; i < maxIter - 2; ++i) {
            for (let k = 0; k < loopSequences.length; ++k) {
              loopSequences[k].push(...subSequences[k % subSequences.length]);
            }
            loopSequences.push(...subSequences.map(s => s.slice()));
          }
          loopSequences.push([]);
          this.mergeDefinitions(paths, loopSequences);
          break;
        }
      }
    }
    return paths;
  }

  /**
   * @param {Syntax[]} definitions
   * @returns {FlatSyntax[]}
   */
  static flattenSyntax(definitions) {
    return definitions.flatMap(({ type, definition, config }) =>
      this.flattenDefinition(/** @type {Definition<Expression>} */ (definition)).map(d => ({
        type,
        definition: d,
        config: config ?? {},
      })));
  }

  /**
   * @param {FlatSyntax} definition
   * @param {(Token | Expression)[]} stack
   * @returns {Expression}
   */
  static makeExpression({ definition, type, config }, stack) {
    const values = {
      name: 'name' in config ? config.name ?? '' : '',
      value: 'value' in config ? config.value ?? '' : '',
      args: /** @type {Expression[]} */ ([]),
      unit: 'unit' in config ? config.unit ?? '' : '',
    };
    for (let i = 0; i < definition.length; ++i) {
      const { target } = definition[i];
      if (!target) continue;

      const value = stack[i];
      const isToken = 'data' in value;

      if (target === 'args') {
        if (isToken) throw new ParserError('argument data must be an expression, got a token instead');
        values.args.push(value);
        continue;
      }

      if (!isToken) throw new ParserError(`"${target}" field data must be a token, got an expression instead`);
      values[target] = value.data;
    }

    switch (type) {
      case STRING:
      case NUMBER:
        return { type, value: values.value };
      case IDENTIFIER:
        return { type, name: values.name };
      case QUANTITY:
        return { type, value: values.value, unit: values.unit };
      case UNARY:
      case OPERATOR:
      case FUNCTION:
        return { type, name: values.name, args: /** @type {[ShallowExpression]} */ (values.args) };
      case GROUP:
        return values.args[0];
    }
  }

  /**
   * @param {Token[]} tokens
   * @param {ParserState} state
   * @returns {Expression?}
   */
  consumeExpression(tokens, state) {
    const { leadingExpression } = state;

    const candidates = /** @type {Candidate[]} */ ([]);
    const satisfied = /** @type {Candidate[]} */ ([]);

    for (const syntax of this.syntax) {
      if (leadingExpression && syntax.definition[0].type !== EXPRESSION) continue;
      if (state.shallow && syntax.type === OPERATOR) continue;

      /** @type {Candidate} */
      const candidate = { syntax, stack: [], consumed: 0 };
      if (leadingExpression) {
        candidate.stack.push(leadingExpression);
      }
      candidates.push(candidate);
    }

    while (true) {
      let remaining = 0;

      for (const candidate of candidates) {
        const token = /** @type {Token | undefined} */ (tokens[state.consumed + candidate.consumed++]);
        if (!token) continue;

        const { syntax, stack } = candidate;
        const rule = /** @type {TokenDefinition|ExpressionDefinition|undefined} */ (syntax.definition[stack.length]);
        if (!rule) continue;

        if (rule.type === EXPRESSION && (syntax.type !== OPERATOR || !state.shallow)) {
          /** @type {ParserState} */
          const subState = {
            consumed: state.consumed + --candidate.consumed,
            shallow: syntax.type === OPERATOR || syntax.type === UNARY,
          };
          const { consumed } = subState;

          const subExpression = subState.shallow
            ? this.consumeExpression(tokens, subState)
            : this.greedyConsumeExpression(tokens, subState);

          if (!subExpression) {
            candidate.error = state.error;
            continue;
          }

          candidate.consumed += subState.consumed - consumed;
          stack.push(subExpression);
        } else if (rule.type !== token.type || ('data' in rule && rule.data !== token.data)) {
          candidate.error = getUnexpected(token);
          continue;
        } else {
          stack.push(token);
        }
        if (syntax.definition.length === stack.length) satisfied.push(candidate);
        else candidates[remaining++] = candidate;
      }

      if (remaining === 0) break;

      candidates.splice(remaining);
    }

    if (satisfied.length === 0) {
      state.error = candidates.sort((a, b) => b.stack.length - a.stack.length).some(({ error }) => !error)
        ? getUnexpected('end of input')
        : candidates[0].error;

      return null;
    }

    let [result] = satisfied;
    for (let i = 1; i < satisfied.length; ++i) {
      if (satisfied[i].stack.length > result.stack.length) {
        result = satisfied[i];
      }
    }

    state.consumed += result.consumed;
    return Parser.makeExpression(result.syntax, result.stack);
  }

  /**
   * @param {Token[]} tokens
   * @param {ParserState} state
   * @returns {Expression?}
   */
  greedyConsumeExpression(tokens, state) {
    let expression = /** @type {Expression?} */ (null);
    while (true) {
      state.leadingExpression = expression;
      const next = this.consumeExpression(tokens, state);
      if (!next) return expression;

      if (
        expression?.type === OPERATOR && next.type === OPERATOR &&
        expression.args.length === 2 && next.args.length === 2 &&
        this.operatorPrecedence.indexOf(expression.name) > this.operatorPrecedence.indexOf(next.name)
      ) {
        next.args[0] = expression.args[1];
        expression.args[1] = next;
      } else {
        expression = next;
      }
    }
  }

  /**
   * @param {Token[]} tokens
   * @returns {Expression?}
   */
  parse(tokens) {
    if (!tokens.length) return null;

    /** @type {ParserState} */
    const state = { consumed: 0 };

    const expression = this.greedyConsumeExpression(tokens, state);
    if (expression && state.consumed === tokens.length) return expression;

    throw new Error(state.error);
  }
}
