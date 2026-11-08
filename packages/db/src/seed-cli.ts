import { createDatabase } from './client.js';
import { seed } from './seed.js';

// pnpm db:seed – legt die Beispieldaten aus seed.ts an.
const { db, pool } = createDatabase();
try {
  const result = await seed(db, {
    nodeEnv: process.env.NODE_ENV,
    many: process.argv.includes('--viele'),
  });
  console.log(
    `Beispieldaten angelegt: ${result.organizations} Organisationen, ` +
      `${result.relationships} Beziehungen, ${result.users} Nutzer, ` +
      `${result.manySuppliers} zusätzliche Lieferanten.`,
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
