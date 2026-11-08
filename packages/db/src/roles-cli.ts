import { apiDatabaseUrl, databaseUrl, jobsDatabaseUrl } from './env.js';
import { ensureApiRole, ensureJobsRole } from './roles.js';

// pnpm db:roles – nach db:migrate: Login der API-Rolle mit dem Passwort aus API_DATABASE_URL.
try {
  await ensureApiRole(databaseUrl(), apiDatabaseUrl());
  await ensureJobsRole(databaseUrl(), jobsDatabaseUrl());
  console.log('Rollen reziproq_api und reziproq_jobs sind bereit.');
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
