import { configDefaults, defineProject } from 'vitest/config';

// Lokal laufen die API-Tests in einer eigenen Datenbank (reziproq_test), nie in der Entwicklungs-
// datenbank; global-setup.ts legt sie an. In der CI gilt DATABASE_URL, wie sie gesetzt ist.
const ci = Boolean(process.env.CI);
const testUrl = (url: string) => {
  if (ci) return url;
  const parsed = new URL(url);
  if (!parsed.pathname.endsWith('_test')) parsed.pathname = `${parsed.pathname}_test`;
  return parsed.toString();
};

/**
 * Testdateien, die Module mit vi.mock ersetzen. Sie laufen isoliert im Projekt api-isolated
 * (vitest.isolated.config.ts); alle anderen teilen sich die geladenen Module.
 */
export const isolatedTests = [
  'src/modules/audit/audit.test.ts',
  'src/modules/prompt/ai-sdk-model.test.ts',
];

/** Gemeinsame Einstellungen beider API-Projekte */
export function apiProject(test: {
  name: string;
  include?: string[];
  exclude?: string[];
  isolate: boolean;
  globalSetup?: string[];
}) {
  return defineProject({
    // Gemeinsame Pakete aus dem Quellcode laden, damit Tests kein vorheriges Bauen brauchen.
    // Vites Standardbedingungen für Node bleiben erhalten.
    ssr: {
      resolve: { conditions: ['@reziproq/source', 'module', 'node', 'development|production'] },
    },
    test: {
      ...test,
      // Feste Testwerte haben Vorrang vor der .env; die Tests brauchen keine Verbindung zu Zitadel.
      env: {
        // Kleine Pools: alle Testdateien laufen parallel mit eigener App (max_connections 100).
        DATABASE_POOL_MAX: '4',
        // Nur ein Testwert für die Verschlüsselung der Zugangsdaten (IN-01), kein echtes Geheimnis.
        CONNECTION_SECRET_KEY: 'nur-fuer-tests-kein-geheimnis',
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
      // Jede Datei startet eine eigene App mit Datenbank, alle laufen parallel. Unter Last braucht
      // ein Test mit mehreren Läufen länger als die 5 s von Vitest; Zeitgrenzen für die Leistung
      // prüft getrennt die Zeitmessung (LS-01, pnpm test:perf).
      testTimeout: 15_000,
    },
  });
}

// Die Testdateien eines Workers teilen sich die geladenen Module: Die App mit allen Modulen lädt
// nur einmal je Worker statt einmal je Datei (rund doppelt so schnell). Jede Datei startet ihre
// eigene App wie bisher.
export default apiProject({
  name: 'api',
  exclude: [...configDefaults.exclude, ...isolatedTests],
  isolate: false,
  globalSetup: ['./src/testing/global-setup.ts'],
});
