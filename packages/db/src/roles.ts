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
