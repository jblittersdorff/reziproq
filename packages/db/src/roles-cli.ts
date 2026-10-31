import { apiDatabaseUrl, databaseUrl } from './env.js';
import { ensureApiRole } from './roles.js';

// pnpm db:roles – nach db:migrate: Login der API-Rolle mit dem Passwort aus API_DATABASE_URL.
try {
  await ensureApiRole(databaseUrl(), apiDatabaseUrl());
  console.log('Rolle reziproq_api ist bereit.');
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
