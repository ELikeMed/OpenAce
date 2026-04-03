/**
 * Rollup config for @openace/embed
 *
 * Builds:
 *   1. ESM + CJS for npm (React as peer dep)
 *   2. IIFE bundle for script tag (includes React/ReactDOM)
 */
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import terser from '@rollup/plugin-terser';
import { readFileSync } from 'fs';

const css = readFileSync('./src/client/styles/ace-widget.css', 'utf-8');

// ── npm build (ESM + CJS) ──
const npmBuild = {
  input: 'src/index.js',
  output: [
    { file: 'dist/index.js', format: 'esm', sourcemap: true },
    { file: 'dist/index.cjs', format: 'cjs', sourcemap: true },
  ],
  external: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime'],
  plugins: [
    resolve(),
    commonjs(),
    json(),
    // Inject CSS as string constant
    {
      name: 'inject-css',
      transform(code, id) {
        if (id.endsWith('ace-widget.css')) {
          return { code: `export default ${JSON.stringify(css)};`, map: null };
        }
        return null;
      }
    },
  ],
};

// ── Script tag build (IIFE with React bundled) ──
const iifeBundle = {
  input: 'src/client/ace-embed.js',
  output: {
    file: 'dist/ace-embed.min.js',
    format: 'iife',
    name: 'OpenAce',
    sourcemap: true,
  },
  plugins: [
    resolve({ browser: true }),
    commonjs(),
    json(),
    // Inject CSS as string constant
    {
      name: 'inject-css',
      transform(code, id) {
        if (id.endsWith('ace-widget.css')) {
          return { code: `export default ${JSON.stringify(css)};`, map: null };
        }
        return null;
      }
    },
    // Replace __ACE_CSS__ with the CSS string
    {
      name: 'replace-css-var',
      transform(code) {
        if (code.includes('__ACE_CSS__')) {
          return { code: code.replace(/__ACE_CSS__/g, JSON.stringify(css)), map: null };
        }
        return null;
      }
    },
    terser(),
  ],
};

// ── CSS file (just copy) ──
const cssBuild = {
  input: 'src/client/styles/ace-widget.css',
  output: { file: 'dist/ace-embed.css', format: 'esm' },
  plugins: [
    {
      name: 'css-output',
      load(id) {
        if (id.endsWith('.css')) {
          return `export default ""`;
        }
        return null;
      },
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'ace-embed.css',
          source: css,
        });
      }
    }
  ],
};

export default [npmBuild, iifeBundle];
