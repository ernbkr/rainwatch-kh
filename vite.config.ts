import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Dev only: strip the production CSP <meta> so Vite's HMR / react-refresh
// inline scripts are not blocked. The production build keeps the strict CSP.
function stripCspInDev(): Plugin {
  return {
    name: 'strip-csp-in-dev',
    apply: 'serve',
    transformIndexHtml(html) {
      return html.replace(/\s*<meta http-equiv="Content-Security-Policy"[^>]*>/i, '');
    }
  };
}

export default defineConfig({
  root: 'renderer',
  base: './',
  plugins: [react(), stripCspInDev()],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    // Electron's Chromium supports modulepreload natively — skipping the
    // polyfill keeps the built index.html free of inline scripts so the
    // production `script-src 'self'` CSP holds.
    modulePreload: { polyfill: false }
  },
  server: {
    port: 5173,
    strictPort: true
  }
});
