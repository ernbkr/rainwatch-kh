import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Standalone Vite build for the GitHub Pages landing page.
// `base` matches the repo name so asset URLs resolve under
// https://ernbkr.github.io/rainwatch-kh/.
export default defineConfig({
  root: 'landing',
  base: '/rainwatch-kh/',
  plugins: [react()],
  build: {
    outDir: '../landing-dist',
    emptyOutDir: true
  }
});
