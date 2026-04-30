// ESLint flat config. Strict but pragmatic — our spec mandates strict TS already.
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

export default [
  {
    ignores: ['dist/**', 'node_modules/**', 'src-tauri/target/**', 'playwright-report/**'],
  },
  {
    files: ['src/**/*.ts', 'tests/**/*.ts', 'tools/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: './tsconfig.json',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      'no-console': ['warn', { allow: ['error', 'warn'] }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      'eqeqeq': ['error', 'always'],
      'prefer-const': 'error',
    },
  },
  {
    // CLI tools log to stdout intentionally — that's their job.
    files: ['tools/**/*.ts'],
    rules: {
      'no-console': 'off',
    },
  },
];
