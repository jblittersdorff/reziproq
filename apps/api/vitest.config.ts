import { defineProject } from 'vitest/config';

export default defineProject({
  // Gemeinsame Pakete aus dem Quellcode laden, damit Tests kein vorheriges Bauen brauchen.
  // Vites Standardbedingungen für Node bleiben erhalten.
  ssr: {
    resolve: { conditions: ['@reziproq/source', 'module', 'node', 'development|production'] },
  },
  test: {
    name: 'api',
    // Feste Testwerte haben Vorrang vor der .env; die Tests brauchen keine Verbindung zu Zitadel.
    env: {
      ZITADEL_ISSUER: 'https://zitadel.test',
      ZITADEL_PROJECT_ID: 'test-project',
      // Die CI setzt DATABASE_URL selbst; lokal die Datenbank aus docker-compose.yml.
      DATABASE_URL:
        process.env.DATABASE_URL ?? 'postgres://reziproq:reziproq_local@localhost:5433/reziproq',
      // Die API verbindet sich wie im Betrieb als reziproq_api (PLT-02); global-setup.ts setzt
      // vorher Login und Passwort dieser Rolle. Nur ein Testwert, kein echtes Geheimnis.
      API_DATABASE_URL:
        process.env.API_DATABASE_URL ??
        'postgres://reziproq_api:reziproq_api_local@localhost:5433/reziproq',
    },
    globalSetup: ['./src/testing/global-setup.ts'],
  },
});
