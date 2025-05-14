import typescriptEslint from '@typescript-eslint/eslint-plugin';
import _import from 'eslint-plugin-import';
import jsdoc from 'eslint-plugin-jsdoc';
import globals from 'globals';
import tsParser from '@typescript-eslint/parser';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import js from '@eslint/js';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

export default [
  {
    ignores: [
      '**/node_modules/',
      '**/libs/',
    ],
  },
  ...compat.extends(
    'plugin:@typescript-eslint/recommended',
    'plugin:import/typescript',
    'plugin:jsdoc/recommended-typescript-flavor-error',
  ).map(config => {
    delete config.plugins;
    return config;
  }),
  {
    plugins: {
      '@typescript-eslint': typescriptEslint,
      import: _import,
      jsdoc,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        glMatrix: true,
      },
      parser: tsParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    settings: {
      'import/resolver': {
        node: {
          extensions: ['.js', '.jsx', '.d.ts'],
        },
      },
    },
    rules: {
      '@typescript-eslint/no-shadow': 'error',
      '@typescript-eslint/no-this-alias': 'off',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      'arrow-spacing': 'error',
      'block-spacing': 'error',
      'class-methods-use-this': 'error',
      'comma-dangle': ['error', 'always-multiline'],
      'comma-spacing': 'error',
      'eqeqeq': 'error',
      'for-direction': 'error',
      'indent': ['error', 2, { SwitchCase: 1 }],
      'import/extensions': ['error', 'always'],
      'import/no-cycle': 'off',
      'jsdoc/require-param-description': 'off',
      'jsdoc/require-property-description': 'off',
      'jsdoc/require-returns-description': 'off',
      'max-len': ['error', { code: 120, ignoreStrings: true }],
      'no-console': 'warn',
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-irregular-whitespace': 'error',
      'no-multi-spaces': ['error', { exceptions: { VariableDeclarator: true }}],
      'no-multiple-empty-lines': ['error', { max: 1, maxEOF: 0, maxBOF: 0 }],
      'no-nested-ternary': 'error',
      'no-shadow': 'error',
      'no-trailing-spaces': 'error',
      'no-unused-expressions': 'error',
      'no-useless-rename': 'error',
      'no-warning-comments': 'error',
      'object-shorthand': ['error', 'properties'],
      'prefer-const': 'error',
      'semi': 'error',
      'space-before-blocks': 'error',
      'space-infix-ops': 'error',
      'spaced-comment': 'error',
    },
  },
];
