import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { createDatabase } from './client.js';

const migrationsFolder = fileURLToPath(new URL('../drizzle', import.meta.url));

/**
 * Adresse der Testdatenbank zu einer Datenbank-URL: derselbe Server, Name mit Endung _test. In der
 * CI bleibt die URL, wie sie ist; dort ist die Datenbank ohnehin frisch.
 */
export function testDatabaseUrl(url: string, ci = Boolean(process.env.CI)): string {
  if (ci) return url;
  const parsed = new URL(url);
  const name = parsed.pathname.replace(/^\//, '');
  if (!name.endsWith('_test')) parsed.pathname = `/${name}_test`;
  return parsed.toString();
}

/**
 * Legt die Testdatenbank an, falls es sie nicht gibt, und wendet alle Migrationen an. So schreiben
 * automatische Tests nie in die lokale Entwicklungsdatenbank.
 */
export async function ensureTestDatabase(url: string): Promise<void> {
  const target = new URL(url);
  const name = target.pathname.replace(/^\//, '');
  if (!/^[a-z0-9_]+$/.test(name)) throw new Error(`Ungültiger Datenbankname: ${name}`);
  const server = new URL(url);
  server.pathname = '/postgres';
  const admin = new Pool({ connectionString: server.toString(), max: 1 });
  try {
    const exists = await admin.query('select 1 from pg_database where datname = $1', [name]);
    if (exists.rowCount === 0) await admin.query(`create database ${name}`);
  } finally {
    await admin.end();
  }
  const { db, pool } = createDatabase(url);
  try {
    await migrate(db, { migrationsFolder });
  } finally {
    await pool.end();
  }
}
