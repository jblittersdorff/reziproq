// E2E-Tests gegen die echte API mit dem Demo-Mandanten Hollmann (feste IDs in der gemeinsamen
// Testdatenbank) laufen nacheinander: dieselbe Sitzungssperre wie in den API-Tests
// (apps/api/src/testing/hollmann.ts), vom Einspielen bis zum Aufräumen.

type Db = typeof import('../../../packages/db/src/index.js');

/** Wartet auf die Sperre; die zurückgegebene Funktion gibt sie frei. */
export async function lockHollmann(db: Db): Promise<() => Promise<void>> {
  const lock = db.createDatabase(db.databaseUrl());
  const client = await lock.pool.connect();
  await client.query('select pg_advisory_lock($1)', [db.hollmannLockKey]);
  return async () => {
    await client.query('select pg_advisory_unlock($1)', [db.hollmannLockKey]);
    client.release();
    await lock.pool.end();
  };
}
