import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Je Paket ein Projekt; Web und API dazu je ein isoliertes Projekt für Tests, die Module mit
    // eigenem Zustand ersetzen (siehe isolatedTests in den Konfigurationen der Pakete).
    projects: [
      'apps/*',
      'packages/*',
      'scripts',
      'apps/web/vitest.isolated.config.ts',
      'apps/api/vitest.isolated.config.ts',
    ],
  },
});
