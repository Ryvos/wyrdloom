import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// Tauri uses a fixed dev port; align Vite to it so `tauri dev` can hand off cleanly.
const TAURI_DEV_PORT = 1420;

// GitHub Pages serves the repo at /wyrdloom/. The Pages workflow sets
// VITE_DEPLOY_BASE; everything else (Tauri, vite preview, the local Vite dev
// server) leaves it unset and ships at /. Avoid hardcoding /wyrdloom/ here so
// a fork doesn't have to also rewrite this file.
const DEPLOY_BASE = process.env.VITE_DEPLOY_BASE ?? '/';

export default defineConfig({
  base: DEPLOY_BASE,

  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@data': resolve(__dirname, 'data'),
    },
  },

  server: {
    port: TAURI_DEV_PORT,
    strictPort: true,
    host: '127.0.0.1',
  },

  // Tauri 2.x expects the renderer at a fixed port and disables HMR on its own protocol;
  // we keep the Vite defaults for the web target and only specialize when TAURI_PLATFORM is set.
  envPrefix: ['VITE_', 'TAURI_ENV_', 'TAURI_PLATFORM'],

  build: {
    target: 'es2022',
    sourcemap: true,
    // Pixi v8 ships modern ESM; do not transpile it down further than needed.
    minify: 'esbuild',
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: {
          pixi: ['pixi.js'],
        },
      },
    },
  },

  clearScreen: false,
});
