import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

/**
 * Writes dist/sw.js after a build: the service worker template with the list of
 * built files and a version derived from their contents, so any change to the
 * game produces a new cache and players pick it up on their next visit.
 */
function serviceWorker(): Plugin {
  let outDir = 'dist';
  return {
    name: 'deckfall-service-worker',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    closeBundle() {
      const files = (readdirSync(outDir, { recursive: true, withFileTypes: true }) as import('node:fs').Dirent[])
        .filter((entry) => entry.isFile())
        .map((entry) => relative(outDir, join(entry.parentPath, entry.name)).replaceAll('\\', '/'))
        // Skipped: docs, source maps and the old .woff font format (every current browser takes .woff2).
        // index.html is stored as './' below; some servers redirect the explicit name, and a
        // redirected copy cannot be used to answer a page load.
        .filter((file) => !['sw.js', 'index.html'].includes(file) && !/\.(md|map|woff)$/.test(file))
        .sort();
      const hash = createHash('sha256');
      for (const file of files) hash.update(file).update(readFileSync(join(outDir, file)));
      const template = readFileSync(join(import.meta.dirname, 'pwa', 'sw.template.js'), 'utf8');
      const urls = ['./', ...files.map((file) => `./${file}`)];
      writeFileSync(
        join(outDir, 'sw.js'),
        template.replace('__VERSION__', hash.digest('hex').slice(0, 12)).replace('__FILES__', JSON.stringify(urls)),
      );
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), serviceWorker()],
  // To reach `npm run preview` through a tunnel, name its hostname: PREVIEW_HOST=example.com npm run preview
  preview: { allowedHosts: process.env.PREVIEW_HOST ? [process.env.PREVIEW_HOST] : [] },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
