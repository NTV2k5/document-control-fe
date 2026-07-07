import { deserialize, serialize } from 'node:v8';
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import unusedImports from 'eslint-plugin-unused-imports';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import prettier from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier';

if (typeof globalThis.structuredClone !== 'function') {
  globalThis.structuredClone = (value) => deserialize(serialize(value));
}

export default tseslint.config(
  { ignores: ['dist', 'src/routeTree.gen.ts'] },
  {
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
      react.configs.flat.recommended,
      jsxA11y.flatConfigs.recommended,
      prettierConfig,
    ],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      'unused-imports': unusedImports,
      prettier,
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      // Prettier
      'prettier/prettier': 'error',

      // Disabled — plugins not installed / deprecated rules
      'react-refresh/only-export-components': 'off',
      'react/no-unstable-context-value': 'off',
      'node/prefer-global/buffer': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',

      // React
      'react/display-name': 'off',
      'react/prop-types': 'off',
      'react/react-in-jsx-scope': 'off',
      'react/jsx-boolean-value': ['error', 'never'],
      'react/self-closing-comp': ['error', { component: true, html: true }],

      // React Hooks
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // TypeScript
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/consistent-type-definitions': 'off',
      '@typescript-eslint/no-empty-interface': 'off',
      '@typescript-eslint/no-namespace': 'error',
      '@typescript-eslint/no-shadow': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-asserted-optional-chain': 'warn',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', disallowTypeAnnotations: false },
      ],
      '@typescript-eslint/no-unused-expressions': ['error', { allowShortCircuit: true, allowTernary: true }],

      // Unused imports
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],

      // jsx-a11y — Link from TanStack Router renders a proper <a href>, no need to check it
      'jsx-a11y/anchor-is-valid': 'off',
      'jsx-a11y/click-events-have-key-events': 'off',
      'jsx-a11y/no-static-element-interactions': 'off',

      // General
      'comma-dangle': ['error', 'always-multiline'],
      curly: ['error', 'multi-line'],
      eqeqeq: ['error', 'smart'],
      'no-console': 'off',
      'prefer-const': ['error', { destructuring: 'any' }],
      'object-shorthand': ['warn', 'always'],
      'no-extra-bind': 'warn',
      'no-unused-expressions': 'off',
    },
  },
);
