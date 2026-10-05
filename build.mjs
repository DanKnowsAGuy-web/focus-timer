// Builds the extension into extension/dist.
// Content scripts cannot be ES modules in MV3, so esbuild bundles each entry
// into a classic script. Static files (manifest, pages) are copied as is.
import { build } from 'esbuild';
import { cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(root, 'extension', 'src');
const dist = path.join(root, 'extension', 'dist');

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

await build({
  entryPoints: {
    'content/youtube': path.join(src, 'content', 'youtube.js'),
  },
  outdir: dist,
  bundle: true,
  format: 'iife',
  target: 'chrome120',
  sourcemap: false,
  logLevel: 'warning',
});

await cp(path.join(root, 'extension', 'manifest.json'), path.join(dist, 'manifest.json'));
console.log('built extension/dist');
