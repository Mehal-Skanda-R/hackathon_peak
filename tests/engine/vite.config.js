import { defineConfig } from 'vite';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

// Resolve test-only dependencies without creating/changing the team's root package.
const require = createRequire(import.meta.url);
export default defineConfig({
  root: fileURLToPath(new URL('./fixture/', import.meta.url)),
  resolve: { alias: { phaser: require.resolve('phaser/dist/phaser.js') } },
  server: { fs: { allow: [fileURLToPath(new URL('../../', import.meta.url))] } },
  build: { outDir: '../dist', emptyOutDir: true },
});
