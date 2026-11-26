import { createDatabase } from './client.js';
import { seedHollmann } from './hollmann.js';

// pnpm demo:hollmann – legt den Demo-Mandanten Hollmann an oder bringt ihn auf den Stand des Seeds
// (DM-01, E-K0-04). Getrennt von den Test-Mandanten aus pnpm db:seed.
const { db, pool } = createDatabase();
try {
  const result = await seedHollmann(db, { nodeEnv: process.env.NODE_ENV });
  console.log(
    `Demo-Mandant Hollmann: ${result.organizations} Organisationen, ${result.people} Personen, ` +
      `${result.relationships} Beziehungen, Spend 2026 ${(result.spend2026Cents / 100_000_000).toFixed(1).replace('.', ',')} Mio. €.`,
  );
  console.log(
    'Anmelden ohne Zitadel: DEMO_SESSIONS=true in der .env, dann /demo/als/hollmann-jan-luka.',
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
