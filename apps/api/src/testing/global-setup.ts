import { ensureApiRole, ensureTestDatabase } from '@reziproq/db';
import type { TestProject } from 'vitest/node';

/**
 * Vor allen API-Tests: eigene Testdatenbank anlegen und migrieren, dann Login der Rolle
 * reziproq_api setzen, wie `pnpm db:roles` es tut (PLT-02).
 */
export default async function setup(project: TestProject) {
  const { DATABASE_URL, API_DATABASE_URL } = project.config.env as Record<string, string>;
  if (!DATABASE_URL || !API_DATABASE_URL)
    throw new Error('DATABASE_URL und API_DATABASE_URL fehlen.');
  await ensureTestDatabase(DATABASE_URL);
  await ensureApiRole(DATABASE_URL, API_DATABASE_URL);
}
