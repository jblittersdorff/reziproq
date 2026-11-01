import { fileURLToPath } from 'node:url';
import { defineProject } from 'vitest/config';

export default defineProject({
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
    name: 'web',
    include: ['src/**/*.test.{ts,tsx}'],
    // Feste Zeitzone, damit formatierte Uhrzeiten lokal und in der CI (UTC) gleich sind.
    env: { TZ: 'Europe/Berlin' },
  },
});
