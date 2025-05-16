export const TOKEN_TYPE = /** @type {const} */ ({
  IDENTIFIER: 0,
  STRING: 1,
  NUMBER: 2,
  OPERATOR: 3,
});

const { IDENTIFIER, STRING, NUMBER, OPERATOR } = TOKEN_TYPE;

/** @typedef {typeof TOKEN_TYPE} TokenMap */
/** @typedef {Values<TokenMap>} TokenType */

/** @type {Record<TokenType, string>} */
export const TOKEN_NAME = ['identifier', 'string', 'number', 'operator'];

const CHAR_TYPE = /** @type {const} */ ({
  NONE: 0,
  SPACE: 1,
  DIGIT: 2,
  LETTER: 3,
  SYMBOL: 4,
});

const { NONE, SPACE, DIGIT, LETTER, SYMBOL } = CHAR_TYPE;

/** @typedef {typeof CHAR_TYPE} CharMap */
/** @typedef {Values<CharMap>} CharType */

/**
 * @template {TokenType} [T=TokenType]
 * @typedef Token
 * @property {T} type
 * @property {string} data
 */

/**
 * @template {Token?} [T=Token?]
 * @typedef TokenizerState
 * @property {string} formula
 * @property {number} i
 * @property {Token[]} tokens
 * @property {T} token
 * @property {Token?} previousToken
 * @property {string?} char
 * @property {string?} next
 * @property {string?} prev
 * @property {CharType} type
 * @property {CharType} nextType
 * @property {CharType} prevType
 */

/** @type {(state: TokenizerState) => state is TokenizerState<Token>} */
const isTokenNotNull = (state) => state.token !== null;

/** @type {(state: TokenizerState) => state is TokenizerState<Token<TokenMap["NUMBER"]>>} */
const isNumberToken = (state) => state.token?.type === NUMBER;

/**
 * @param {string?} char
 * @returns {CharType}
 */
const charType = (char) => {
  switch (char) {
    case '': case undefined: case null:
      return NONE;
    case ' ':
    case '\t':
    case '\r':
    case '\n':
      return SPACE;
    case '1':
    case '2':
    case '3':
    case '4':
    case '5':
    case '6':
    case '7':
    case '8':
    case '9':
    case '0':
      return DIGIT;
    case 'a': case 'A':
    case 'b': case 'B':
    case 'c': case 'C':
    case 'd': case 'D':
    case 'e': case 'E':
    case 'f': case 'F':
    case 'g': case 'G':
    case 'h': case 'H':
    case 'i': case 'I':
    case 'j': case 'J':
    case 'k': case 'K':
    case 'l': case 'L':
    case 'm': case 'M':
    case 'n': case 'N':
    case 'o': case 'O':
    case 'p': case 'P':
    case 'q': case 'Q':
    case 'r': case 'R':
    case 's': case 'S':
    case 't': case 'T':
    case 'u': case 'U':
    case 'v': case 'V':
    case 'w': case 'W':
    case 'x': case 'X':
    case 'y': case 'Y':
    case 'z': case 'Z':
      return LETTER;
    default:
      return SYMBOL;
  }
};

/**
 * @param {TokenizerState} state
 */
const consumeChar = (state) => {
  state.char = state.next;
  state.type = state.nextType;
  state.next = state.formula[++state.i] ?? null;
  state.nextType = charType(state.next);
};

/**
 * @param {TokenizerState} state
 */
const unconsumeChar = (state) => {
  state.next = state.char;
  state.nextType = state.type;
  --state.i;
  state.char = state.formula[state.i - 1] ?? null;
  state.type = charType(state.char);
};

/**
 * @param {TokenizerState<Token>} state
 */
const appendChar = (state) => {
  state.token.data += state.char;
  state.prev = state.char;
  state.prevType = state.prevType;
};

/**
 * @param {TokenizerState} state
 */
const makeToken = (state) => {
  const { char, type, nextType } = state;
  if (state.token) {
    state.previousToken = state.token;
    state.token = null;
  }

  if (char === null) return;

  switch (type) {
    case SYMBOL:
      if (char === '"') {
        state.token = { type: STRING, data: '' };
        break;
      }

      if (char !== '.' || nextType !== DIGIT) {
        state.token = { type: OPERATOR, data: char };
        break;
      }
    case DIGIT:
      state.token = { type: NUMBER, data: char };
      break;
    case LETTER:
      state.token = { type: IDENTIFIER, data: char };
      break;
    default:
      return;
  }
  state.prev = char;
  state.prevType = type;
  state.tokens.push(state.token);
};

/**
 * @param {TokenizerState} state
 */
const endToken = (state) => {
  state.previousToken = state.token;
  state.token = null;
  state.prev = null;
  state.prevType = NONE;
  makeToken(state);
};

/**
 * @param {TokenizerState<Token<TokenMap["NUMBER"]>>} state
 */
const tryConsumeExponent = (state) => {
  let exponent = 'e';
  consumeChar(state);
  if (state.char === '+' || state.char === '-') {
    exponent += state.char;
    consumeChar(state);
  }

  if (state.type !== DIGIT) {
    for (let i = 0; i < exponent.length; ++i) unconsumeChar(state);
    endToken(state);
    return;
  }

  do {
    exponent += state.char;
    consumeChar(state);
  } while (state.type === DIGIT);

  state.token.data += exponent;
  endToken(state);
};

/**
 * @param {string} formula
 * @returns {Token[]}
 */
export const tokenize = (formula) => {
  const state = /** @type {TokenizerState} */ ({
    formula,
    i: 0,
    tokens: [],
    token: null,
    previousToken: null,
    char: null,
    next: formula[0],
    prev : null,
    type: NONE,
    nextType: charType(formula[0]),
    prevType: NONE,
  });

  do {
    consumeChar(state);

    if (!isTokenNotNull(state)) {
      makeToken(state);
      continue;
    }

    if (isNumberToken(state)) {
      if (state.type === DIGIT) appendChar(state);
      else if (state.char === '.' && !state.token.data.includes('.')) appendChar(state);
      else if (state.char === 'e' && !state.token.data.includes('e')) tryConsumeExponent(state);
      else endToken(state);
      continue;
    }

    if (state.token.type === OPERATOR) {
      if (state.char === state.token.data) {
        switch (state.token.data) {
          case '<':
          case '>':
          case '=':
          case '&':
          case '|':
            appendChar(state);
            continue;
        }
      } else if (state.char === '=') {
        switch (state.token.data) {
          case '<':
          case '>':
          case '!':
            appendChar(state);
            continue;
        }
      }
      endToken(state);
      continue;
    }

    if (state.token.type === IDENTIFIER) {
      if (state.type === LETTER || state.type === DIGIT || state.char === '_') appendChar(state);
      else endToken(state);
      continue;
    }

    if (state.token.type === STRING) {
      if (state.char === '\\' && (state.next === '"' || state.next === '\\')) {
        consumeChar(state);
        appendChar(state);
      } else if (state.char === '"') {
        consumeChar(state);
        endToken(state);
      } else {
        appendChar(state);
      }
    }

  } while (state.next !== null);

  if (state.token?.type === STRING) {
    throw new Error(`Unterminated string "${state.token.data}"`);
  }

  return state.tokens;
};
