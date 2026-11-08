import { createDatabase } from './client.js';
import { demoSetup } from './demo-setup.js';
import { reportDemoSetup } from './demo-setup-cli.js';
import { seed } from './seed.js';

// pnpm db:seed – legt die Beispieldaten aus seed.ts an und richtet sie danach auf die echten
// Konten ein (demo:setup), damit lokal keine erfundenen Personen bleiben.
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
  reportDemoSetup(await demoSetup(db, process.env.NODE_ENV));
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
