import { fileURLToPath } from 'node:url';
import { configDefaults, defineProject } from 'vitest/config';

/**
 * Testdateien, die eigene Module mit eigenem Zustand ersetzen (Outlook-Adapter, Anmeldung mit
 * eigenen Methoden). Sie laufen isoliert im Projekt web-isolated (vitest.isolated.config.ts); alle
 * anderen teilen sich die geladenen Module.
 */
export const isolatedTests = [
  'src/features/auth/plt-01.test.tsx',
  'src/features/audit/plt-08.test.tsx',
  'src/features/calendar/in-03.test.tsx',
  'src/features/activities/in-04.test.tsx',
];

/** Gemeinsame Einstellungen beider Web-Projekte */
export function webProject(test: {
  name: string;
  include: string[];
  exclude?: string[];
  isolate: boolean;
}) {
  return defineProject({
    // Gemeinsame Pakete aus dem Quellcode laden, damit Tests kein vorheriges Bauen brauchen.
    // resolve gilt für Tests mit jsdom, ssr für Tests in Node; Vites Standardbedingungen bleiben.
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
      conditions: ['@reziproq/source', 'module', 'browser', 'development|production'],
    },
    ssr: {
      resolve: { conditions: ['@reziproq/source', 'module', 'node', 'development|production'] },
    },
    test: {
      ...test,
      // Feste Zeitzone, damit formatierte Uhrzeiten lokal und in der CI (UTC) gleich sind.
      env: { TZ: 'Europe/Berlin' },
      // Den gemeinsamen Anmeldezustand legt shared-auth.ts einmal je Worker an.
      // Dazu der Ersatz für showModal und close des nativen Elements dialog (E-K0-01).
      setupFiles: ['./src/testing/shared-auth.ts', './src/testing/dialog.ts'],
    },
  });
}

// Die Testdateien eines Workers teilen sich die geladenen Module: rund dreimal schneller, weil
// React, Router und die Sprachdateien nur einmal je Worker laden.
export default webProject({
  name: 'web',
  include: ['src/**/*.test.{ts,tsx}'],
  exclude: [...configDefaults.exclude, ...isolatedTests],
  isolate: false,
});
