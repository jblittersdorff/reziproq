import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { databaseUrl } from './env.js';
import * as schema from './schema/index.js';

export type Database = ReturnType<typeof createDatabase>['db'];

export function createDatabase(url: string = databaseUrl()) {
  const pool = new Pool({ connectionString: url });
  const db = drizzle({ client: pool, schema, casing: 'snake_case' });
  return { db, pool };
}
