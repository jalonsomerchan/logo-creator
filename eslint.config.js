import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: ['dist/**', 'src/js/app2.js', 'src/js/app3.js', 'src/js/app4.js', 'src/js/app5.js', 'src/js/app6.js'],
  },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
];
