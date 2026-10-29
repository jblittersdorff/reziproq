import { defineProject } from 'vitest/config';

export default defineProject({
  // Gemeinsame Pakete aus dem Quellcode laden, damit Tests kein vorheriges Bauen brauchen.
  // Vites Standardbedingungen für Node bleiben erhalten.
  ssr: {
    resolve: { conditions: ['@reziproq/source', 'module', 'node', 'development|production'] },
  },
  test: {
    name: 'api',
    // Feste Testwerte haben Vorrang vor der .env; die Tests brauchen weder Zitadel noch eine Datenbank.
    env: {
      ZITADEL_ISSUER: 'https://zitadel.test',
      ZITADEL_PROJECT_ID: 'test-project',
      DATABASE_URL: 'postgres://test:test@localhost:5432/test',
    },
  },
});
