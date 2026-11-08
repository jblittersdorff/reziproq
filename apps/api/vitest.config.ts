import { defineProject } from 'vitest/config';

// Lokal laufen die API-Tests in einer eigenen Datenbank (reziproq_test), nie in der Entwicklungs-
// datenbank; global-setup.ts legt sie an. In der CI gilt DATABASE_URL, wie sie gesetzt ist.
const ci = Boolean(process.env.CI);
const testUrl = (url: string) => {
  if (ci) return url;
  const parsed = new URL(url);
  if (!parsed.pathname.endsWith('_test')) parsed.pathname = `${parsed.pathname}_test`;
  return parsed.toString();
};

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
      DATABASE_URL: testUrl(
        process.env.DATABASE_URL ?? 'postgres://reziproq:reziproq_local@localhost:5433/reziproq',
      ),
      // Die API verbindet sich wie im Betrieb als reziproq_api (PLT-02); global-setup.ts setzt
      // vorher Login und Passwort dieser Rolle. Nur ein Testwert, kein echtes Geheimnis.
      API_DATABASE_URL: testUrl(
        process.env.API_DATABASE_URL ??
          'postgres://reziproq_api:reziproq_api_local@localhost:5433/reziproq',
      ),
    },
    globalSetup: ['./src/testing/global-setup.ts'],
  },
});
