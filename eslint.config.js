// Lint (audit R2-05): correctness rules only, no style rules, so the code isn't reformatted. `npm run lint` runs tools/lint.js, which
// lints src/ui.js with src/map.js spliced in at /*MAP*/, the way build.js joins them, so names shared between the two resolve.
const globals = require('globals');
const rules = {
  'no-undef': 'error', 'no-dupe-keys': 'error', 'no-dupe-args': 'error', 'no-dupe-else-if': 'error', 'no-duplicate-case': 'error',
  'no-unreachable': 'error', 'no-func-assign': 'error', 'no-const-assign': 'error', 'no-self-assign': 'error', 'no-self-compare': 'error',
  'no-unsafe-negation': 'error', 'no-unsafe-finally': 'error', 'use-isnan': 'error', 'valid-typeof': 'error', 'no-sparse-arrays': 'error',
  'no-cond-assign': ['error', 'except-parens'], 'no-redeclare': 'error', 'no-shadow-restricted-names': 'error', 'no-loss-of-precision': 'error',
  'no-unused-vars': ['error', { vars: 'all', args: 'none', caughtErrors: 'none', varsIgnorePattern: '^_' }],
};
module.exports = [
  { ignores: ['index.html', 'sw.js', '3d/**', 'node_modules/**', 'test/shots/**', 'art/**', 'docs/**'] },
  { files: ['src/engine.js'], languageOptions: { ecmaVersion: 2022, sourceType: 'script', globals: { ...globals.browser, ...globals.node } }, rules },
  { files: ['src/ui.js'], languageOptions: { ecmaVersion: 2022, sourceType: 'script', globals: { ...globals.browser, OC: 'readonly', OC3D: 'readonly' } }, rules },
  { files: ['src3d/**/*.js'], languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: globals.browser }, rules },
  { files: ['build.js', 'build3d.js', 'eslint.config.js', 'tools/**/*.js', 'test/**/*.js'], languageOptions: { ecmaVersion: 2022, sourceType: 'commonjs', globals: globals.node }, rules },
];
