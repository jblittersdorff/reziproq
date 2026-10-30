import { randomUUID } from 'node:crypto';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { createDatabase, type Database } from '../client.js';
import { databaseUrl } from '../env.js';

const migrationsFolder = fileURLToPath(new URL('../../drizzle', import.meta.url));

/**
 * Legt für einen Test eine eigene, leere Datenbank auf demselben Server an und löscht sie danach.
 * So beeinflussen sich Tests und lokale Entwicklungsdaten nicht.
 */
export async function createTempDatabase() {
  const base = new URL(databaseUrl());
  const name = `reziproq_test_${randomUUID().replaceAll('-', '')}`;
  const admin = new Pool({ connectionString: base.toString(), max: 1 });
  await admin.query(`create database ${name}`);

  const url = new URL(base);
  url.pathname = `/${name}`;
  const { db, pool } = createDatabase(url.toString());

  // Beim Löschen mit FORCE beendet PostgreSQL Verbindungen, die gerade noch abgebaut werden
  // (Code 57P01). Das ist beim Aufräumen erwartet; jeden anderen Fehler weiterreichen.
  pool.on('error', (error: Error & { code?: string }) => {
    if (error.code !== '57P01') {
      queueMicrotask(() => {
        throw error;
      });
    }
  });

  return {
    db,
    pool,
    async drop() {
      await pool.end();
      await admin.query(`drop database ${name} with (force)`);
      await admin.end();
    },
  };
}

/** Wendet alle Migrationen an oder, mit `count`, nur die ersten. */
export async function migrateTo(db: Database, count?: number) {
  if (count === undefined) return migrate(db, { migrationsFolder });

  const folder = mkdtempSync(join(tmpdir(), 'reziproq-migrationen-'));
  try {
    cpSync(migrationsFolder, folder, { recursive: true });
    const journalPath = join(folder, 'meta/_journal.json');
    const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as { entries: unknown[] };
    journal.entries = journal.entries.slice(0, count);
    writeFileSync(journalPath, JSON.stringify(journal));
    await migrate(db, { migrationsFolder: folder });
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}
