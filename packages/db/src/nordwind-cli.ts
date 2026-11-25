import { createDatabase } from './client.js';
import { seedNordwind } from './nordwind.js';

// pnpm demo:nordwind – legt den Demo-Mandanten Nordwind an oder bringt ihn auf den Stand des Seeds
// (DM-01, E-K0-04). Getrennt von den Test-Mandanten aus pnpm db:seed.
const { db, pool } = createDatabase();
try {
  const result = await seedNordwind(db, { nodeEnv: process.env.NODE_ENV });
  console.log(
    `Demo-Mandant Nordwind: ${result.organizations} Organisationen, ${result.people} Personen, ` +
      `${result.relationships} Beziehungen, Spend 2026 ${(result.spend2026Cents / 100_000_000).toFixed(1).replace('.', ',')} Mio. €.`,
  );
  console.log(
    'Anmelden ohne Zitadel: DEMO_SESSIONS=true in der .env, dann /demo/als/nordwind-jan-luka.',
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
