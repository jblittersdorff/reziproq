import { Client } from 'pg';

/**
 * Gibt der Rolle reziproq_api (angelegt von Migration 0007) Login und das Passwort aus
 * API_DATABASE_URL. Das Passwort steht nur in der Umgebung, nie im Code (CLAUDE.md).
 */
export async function ensureApiRole(adminUrl: string, apiUrl: string): Promise<void> {
  const api = new URL(apiUrl);
  if (decodeURIComponent(api.username) !== 'reziproq_api') {
    throw new Error('API_DATABASE_URL muss den Nutzer reziproq_api verwenden.');
  }
  const password = decodeURIComponent(api.password);
  if (!password) throw new Error('API_DATABASE_URL braucht ein Passwort.');

  const client = new Client({ connectionString: adminUrl });
  await client.connect();
  try {
    // ALTER ROLE kennt keine Parameter; escapeLiteral schützt das Passwort.
    await client.query(`alter role reziproq_api login password ${client.escapeLiteral(password)}`);
  } finally {
    await client.end();
  }
}

/** Setzt Login und Passwort der Betriebsrolle aus JOBS_DATABASE_URL (QS-01). */
export async function ensureJobsRole(adminUrl: string, jobsUrl: string): Promise<void> {
  const jobs = new URL(jobsUrl);
  if (decodeURIComponent(jobs.username) !== 'reziproq_jobs') {
    throw new Error('JOBS_DATABASE_URL muss den Nutzer reziproq_jobs verwenden.');
  }
  const password = decodeURIComponent(jobs.password);
  if (!password) throw new Error('JOBS_DATABASE_URL braucht ein Passwort.');

  const client = new Client({ connectionString: adminUrl });
  await client.connect();
  try {
    await client.query(`alter role reziproq_jobs login password ${client.escapeLiteral(password)}`);
  } finally {
    await client.end();
  }
}
