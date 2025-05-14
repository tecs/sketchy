import { EXPRESSION_TYPE } from './parser.js';
import { TOKEN_TYPE } from './tokenizer.js';

/** @type {import("./parser").Syntax[]} */
export default [
  { type: EXPRESSION_TYPE.GROUP, definition: [
    { type: TOKEN_TYPE.OPERATOR, data: '(' },
    { type: EXPRESSION_TYPE.EXPRESSION, target: 'args' },
    { type: TOKEN_TYPE.OPERATOR, data: ')' },
  ]},
  { type: EXPRESSION_TYPE.FUNCTION, definition: [
    { type: TOKEN_TYPE.IDENTIFIER, target: 'name' },
    { type: TOKEN_TYPE.OPERATOR, data: '(' },
    { type: EXPRESSION_TYPE.CHOICE, definition: [
      [
        { type: EXPRESSION_TYPE.EXPRESSION, target: 'args' },
        { type: EXPRESSION_TYPE.LOOP, definition: [
          { type: TOKEN_TYPE.OPERATOR, data: ',' },
          { type: EXPRESSION_TYPE.EXPRESSION, target: 'args' },
        ]},
      ],
      [],
    ]},
    { type: TOKEN_TYPE.OPERATOR, data: ')' },
  ]},
  { type: EXPRESSION_TYPE.QUANTITY, definition: [
    { type: TOKEN_TYPE.NUMBER, target: 'value' },
    { type: TOKEN_TYPE.IDENTIFIER, target: 'unit' },
  ]},
  { type: EXPRESSION_TYPE.NUMBER, definition: [{ type: TOKEN_TYPE.NUMBER, target: 'value' }]},
  { type: EXPRESSION_TYPE.STRING, definition: [{ type: TOKEN_TYPE.STRING, target: 'value' }] },
  { type: EXPRESSION_TYPE.IDENTIFIER, definition: [{ type: TOKEN_TYPE.IDENTIFIER, target: 'name' }] },
  { type: EXPRESSION_TYPE.UNARY, definition: [
    { type: EXPRESSION_TYPE.CHOICE, definition: [
      { type: TOKEN_TYPE.OPERATOR, data: '+', target: 'name'},
      { type: TOKEN_TYPE.OPERATOR, data: '-', target: 'name'},
      { type: TOKEN_TYPE.OPERATOR, data: '!', target: 'name' },
    ]},
    { type: EXPRESSION_TYPE.EXPRESSION, target: 'args' },
  ]},
  { type: EXPRESSION_TYPE.OPERATOR, definition: [
    { type: EXPRESSION_TYPE.EXPRESSION, target: 'args' },
    { type: EXPRESSION_TYPE.CHOICE, definition: [
      { type: TOKEN_TYPE.OPERATOR, data: '^', target: 'name' },
      { type: TOKEN_TYPE.OPERATOR, data: '*', target: 'name' },
      { type: TOKEN_TYPE.OPERATOR, data: '/', target: 'name' },
      { type: TOKEN_TYPE.OPERATOR, data: '%', target: 'name' },
      { type: TOKEN_TYPE.OPERATOR, data: '+', target: 'name' },
      { type: TOKEN_TYPE.OPERATOR, data: '-', target: 'name' },
      { type: TOKEN_TYPE.OPERATOR, data: '<<', target: 'name' },
      { type: TOKEN_TYPE.OPERATOR, data: '>>', target: 'name' },
      { type: TOKEN_TYPE.OPERATOR, data: '<', target: 'name' },
      { type: TOKEN_TYPE.OPERATOR, data: '<=', target: 'name' },
      { type: TOKEN_TYPE.OPERATOR, data: '>', target: 'name' },
      { type: TOKEN_TYPE.OPERATOR, data: '>=', target: 'name' },
      { type: TOKEN_TYPE.OPERATOR, data: '==', target: 'name' },
      { type: TOKEN_TYPE.OPERATOR, data: '!=', target: 'name' },
      { type: TOKEN_TYPE.OPERATOR, data: '&', target: 'name' },
      { type: TOKEN_TYPE.OPERATOR, data: '|', target: 'name' },
      { type: TOKEN_TYPE.OPERATOR, data: '&&', target: 'name' },
      { type: TOKEN_TYPE.OPERATOR, data: '||', target: 'name' },
    ]},
    { type: EXPRESSION_TYPE.EXPRESSION, target: 'args' },
  ]},
  { type: EXPRESSION_TYPE.OPERATOR, definition: [
    { type: EXPRESSION_TYPE.EXPRESSION, target: 'args' },
    { type: TOKEN_TYPE.OPERATOR, data: '?', target: 'name' },
    { type: EXPRESSION_TYPE.EXPRESSION, target: 'args' },
    { type: TOKEN_TYPE.OPERATOR, data: ':' },
    { type: EXPRESSION_TYPE.EXPRESSION, target: 'args' },
  ]},
];
