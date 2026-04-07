import { build } from 'esbuild';
import { cpSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'esm',
  outfile: 'build/index.js',
  banner: {
    js: [
      // ESM shims for __dirname and require() (needed by bundled code)
      'import { createRequire as __createRequire } from "module";',
      'import { fileURLToPath as __fileURLToPath } from "url";',
      'import { dirname as __dirname_fn } from "path";',
      'const require = __createRequire(import.meta.url);',
      'const __filename = __fileURLToPath(import.meta.url);',
      'const __dirname = __dirname_fn(__filename);',
    ].join('\n'),
  },
  // Exclude node built-ins from bundle
  external: ['fs', 'path', 'os', 'url', 'module', 'crypto', 'events', 'stream', 'util', 'net', 'tls', 'http', 'https', 'zlib', 'buffer', 'string_decoder', 'child_process', 'worker_threads', 'node:*'],
  sourcemap: false,
  minify: false, // Keep readable for debugging
});

// Copy sql.js WASM file next to the bundle
cpSync(
  join(__dirname, 'node_modules/sql.js/dist/sql-wasm.wasm'),
  join(__dirname, 'build/sql-wasm.wasm')
);

console.log('Build complete: build/index.js + build/sql-wasm.wasm');
