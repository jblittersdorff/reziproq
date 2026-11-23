import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { databaseUrl } from './env.js';
import * as schema from './schema/index.js';

export type Database = ReturnType<typeof createDatabase>['db'];

/**
 * Größe eines Verbindungspools: Standard 10 wie bei pg. Die Tests setzen DATABASE_POOL_MAX klein,
 * weil viele Testdateien parallel je eigene Pools öffnen und sonst max_connections überschreiten.
 */
const poolMax = () => {
  const value = Number(process.env.DATABASE_POOL_MAX);
  return Number.isInteger(value) && value > 0 ? value : 10;
};

export function createDatabase(url: string = databaseUrl()) {
  const pool = new Pool({ connectionString: url, max: poolMax() });
  const db = drizzle({ client: pool, schema, casing: 'snake_case' });
  return { db, pool };
}
