/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import { forgeServiceWorker } from './scripts/sw-plugin.ts';

// `base: './'` keeps every asset URL relative, so the same build works at the
// root of a domain, under a GitHub Pages project path (/claude-forge/), or from
// any static host. The router uses hash URLs, so no server rewrites are needed.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), forgeServiceWorker()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: { target: 'es2022', sourcemap: false, chunkSizeWarningLimit: 700 },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx'],
    setupFiles: ['./tests/setup.ts'],
    css: false,
  },
});
