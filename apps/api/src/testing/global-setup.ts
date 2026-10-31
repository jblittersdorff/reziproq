import { ensureApiRole } from '@reziproq/db';
import type { TestProject } from 'vitest/node';

/** Vor allen API-Tests: Login der Rolle reziproq_api, wie `pnpm db:roles` es tut (PLT-02). */
export default async function setup(project: TestProject) {
  const { DATABASE_URL, API_DATABASE_URL } = project.config.env as Record<string, string>;
  if (!DATABASE_URL || !API_DATABASE_URL)
    throw new Error('DATABASE_URL und API_DATABASE_URL fehlen.');
  await ensureApiRole(DATABASE_URL, API_DATABASE_URL);
}
