import { fileURLToPath } from 'node:url';
import { defineProject } from 'vitest/config';

export default defineProject({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // Gemeinsame Pakete aus dem Quellcode laden, damit Tests kein vorheriges Bauen brauchen.
  ssr: {
    resolve: { conditions: ['@reziproq/source', 'module', 'node', 'development|production'] },
  },
  test: {
    name: 'web',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
