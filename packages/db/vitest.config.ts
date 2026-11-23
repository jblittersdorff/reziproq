import { defineProject } from 'vitest/config';

export default defineProject({
  // Das Seed nutzt @reziproq/shared (SEG-01, PLT-07); aus dem Quellcode laden wie in apps/api,
  // damit die Tests kein vorheriges Bauen brauchen.
  ssr: {
    resolve: { conditions: ['@reziproq/source', 'module', 'node', 'development|production'] },
  },
  test: {
    name: 'db',
    // Jeder Migrationstest legt eine eigene Datenbank an und spielt alle Migrationen ein; unter
    // der Last von pnpm check dauert das länger als die üblichen 5 Sekunden. Gleiches gilt für
    // beforeAll, das die Hilfsdatenbank mit über hundert Migrationen aufbaut.
    testTimeout: 30_000,
    hookTimeout: 60_000,
    env: {
      // Die CI setzt DATABASE_URL selbst; lokal die Datenbank aus docker-compose.yml.
      // Tests legen darauf eigene Datenbanken an und löschen sie wieder.
      DATABASE_URL:
        process.env.DATABASE_URL ?? 'postgres://reziproq:reziproq_local@localhost:5433/reziproq',
    },
  },
});
