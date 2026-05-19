import { defineConfig } from 'vitest/config';

// Dedicated vitest config so the test runner keeps the repo root as its root
// (vite.config.ts sets root to `renderer/` for the app build).
export default defineConfig({
  test: {
    include: ['tests/**/*.test.js'],
    environment: 'node'
  }
});
