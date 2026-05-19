import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'renderer',
  base: './',
  plugins: [react()],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    // Skipping the modulepreload polyfill keeps the built index.html free of
    // inline scripts, so the strict `script-src 'self'` CSP (configured in
    // src-tauri/tauri.conf.json) holds.
    modulePreload: { polyfill: false }
  },
  server: {
    port: 5173,
    strictPort: true
  }
});
