import { defineProject } from 'vitest/config';

export default defineProject({
  // Gemeinsame Pakete aus dem Quellcode laden, damit Tests kein vorheriges Bauen brauchen.
  // Vites Standardbedingungen für Node bleiben erhalten.
  ssr: {
    resolve: { conditions: ['@reziproq/source', 'module', 'node', 'development|production'] },
  },
  test: {
    name: 'api',
  },
});
