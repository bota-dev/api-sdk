import js from '@eslint/js';

const globals = Object.fromEntries([
  'AbortController', 'AbortSignal', 'Buffer', 'Headers', 'ReadableStream', 'Request', 'Response',
  'TextDecoder', 'TextEncoder', 'URL', 'URLSearchParams', 'clearImmediate', 'clearInterval',
  'clearTimeout', 'console', 'fetch', 'performance', 'process', 'queueMicrotask',
  'setImmediate', 'setInterval', 'setTimeout', 'structuredClone',
].map(name => [name, 'readonly']));

export default [
  { ignores: ['**/node_modules/**', '**/dist/**', '**/generated/**', '**/.package-artifacts/**'] },
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals },
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    rules: js.configs.recommended.rules,
  },
];
