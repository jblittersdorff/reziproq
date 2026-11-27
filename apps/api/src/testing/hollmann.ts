import {
  createDatabase,
  type Database,
  databaseUrl,
  hollmann,
  seedHollmann,
  sql,
} from '@reziproq/db';

// Der Demo-Mandant Hollmann hat feste IDs (DM-01). Die API-Testdateien laufen parallel auf
// reziproq_test; spielten zwei zugleich Hollmann ein, leerte die eine, was die andere gerade liest.
// Deshalb hält jede Datei eine Sitzungssperre auf eigener Verbindung, vom Einspielen bis zum Aufräumen.

/** Schlüssel der Sperre; frei gewählt, nur für Hollmann */
const lockKey = 41_011_123;

/** Zeitgrenze für beforeAll: Wer wartet, wartet, bis die andere Datei fertig ist. */
export const hollmannTimeout = 180_000;

/** Spielt Hollmann exklusiv ein; die zurückgegebene Funktion räumt auf und gibt die Sperre frei. */
export async function seedHollmannExclusive(db: Database): Promise<() => Promise<void>> {
  const lock = createDatabase(databaseUrl());
  const client = await lock.pool.connect();
  const unlock = async () => {
    await client.query('select pg_advisory_unlock($1)', [lockKey]);
    client.release();
    await lock.pool.end();
  };
  await client.query('select pg_advisory_lock($1)', [lockKey]);
  try {
    await seedHollmann(db, { nodeEnv: 'test' });
  } catch (error) {
    await unlock();
    throw error;
  }
  return async () => {
    try {
      const orgs = (
        await db.execute<{ id: string }>(
          sql`select app_demo_orgs_von(${hollmann.org.id}::uuid) as id`,
        )
      ).rows.map((row) => row.id);
      await db.execute(sql`select app_demo_leeren(${hollmann.org.id}::uuid)`);
      if (orgs.length > 0) await db.execute(sql`delete from organization where id in ${orgs}`);
    } finally {
      await unlock();
    }
  };
}
