import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import type { TestProject } from 'vitest/node';
import { createDatabase, type Database } from '../client.js';
import { databaseUrl } from '../env.js';
import { seed } from '../seed.js';

// Baut einmal je Testlauf die Vorlagen für createTempDatabase({ from }): alle Migrationen
// (migrated) und dazu die Beispieldaten für die Entwicklung (seeded). Danach kopiert jeder Test nur
// noch (create database … template …) statt über hundert Migrationen einzuspielen. Am Ende des
// Laufs werden die Vorlagen gelöscht, ebenso übrig gebliebene eines abgebrochenen Laufs.

const migrationsFolder = fileURLToPath(new URL('../../drizzle', import.meta.url));
const prefix = 'reziproq_vorlage_';

export default async function setup(project: TestProject) {
  const admin = new Pool({ connectionString: databaseUrl(), max: 1 });
  const dropAll = async () => {
    const old = await admin.query<{ datname: string }>(
      `select datname from pg_database where datname like '${prefix}%'`,
    );
    for (const row of old.rows) await admin.query(`drop database ${row.datname} with (force)`);
  };
  /** Verbindet sich mit einer Datenbank, arbeitet und schließt die Verbindung wieder. */
  const inDatabase = async (name: string, work: (db: Database) => Promise<unknown>) => {
    const url = new URL(databaseUrl());
    url.pathname = `/${name}`;
    const { db, pool } = createDatabase(url.toString());
    try {
      await work(db);
    } finally {
      await pool.end();
    }
  };

  await dropAll();
  const run = randomUUID().replaceAll('-', '').slice(0, 12);
  const templates = { migrated: `${prefix}${run}_migriert`, seeded: `${prefix}${run}_daten` };
  await admin.query(`create database ${templates.migrated}`);
  await inDatabase(templates.migrated, (db) => migrate(db, { migrationsFolder }));
  await admin.query(`create database ${templates.seeded} template ${templates.migrated}`);
  await inDatabase(templates.seeded, (db) => seed(db, { nodeEnv: 'development' }));
  project.provide('databaseTemplates', templates);

  return async () => {
    await dropAll();
    await admin.end();
  };
}
