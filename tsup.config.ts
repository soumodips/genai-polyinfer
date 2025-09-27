import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['cjs'],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: true,
    target: 'node14',
    outExtension({ format }) {
      return {
        js: format === 'cjs' ? '.cjs.js' : '.esm.js'
      };
    }
  },
  {
    entry: ['src/index.ts'],
    format: ['esm'],
    dts: false, // Only generate once
    splitting: false,
    sourcemap: true,
    clean: false,
    target: 'es2020',
    external: ['node-fetch'],
    outExtension({ format }) {
      return {
        js: format === 'cjs' ? '.cjs.js' : '.esm.js'
      };
    }
  }
]);