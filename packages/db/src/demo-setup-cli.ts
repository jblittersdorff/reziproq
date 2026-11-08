import { createDatabase } from './client.js';
import { type DemoSetupResult, demoSetup } from './demo-setup.js';

// pnpm demo:setup – die lokalen Beispieldaten gehören danach deinen echten Konten.
export function reportDemoSetup(result: DemoSetupResult) {
  const lines = [
    result.buyer
      ? `Käufer: ${result.buyer.name} ist Admin mit Controlling und SRO in jeder Beziehung des Test-OEM.`
      : 'Käufer: noch kein echtes Konto im Test-OEM. Einmal mit dem Käuferkonto anmelden, dann erneut ausführen.',
    result.supplier
      ? `Lieferant: ${result.supplier.name} ist Admin und Key Account Manager beim Test-Lieferanten.`
      : 'Lieferant: noch kein echtes Konto beim Test-Lieferanten. Einmal anmelden, dann erneut ausführen.',
    `Erfundene Personen entfernt: ${result.removedPeople}. Reste aus Testläufen entfernt: ${result.removedTestOrganizations} Organisationen.`,
  ];
  for (const line of lines) console.log(line);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { db, pool } = createDatabase();
  try {
    reportDemoSetup(await demoSetup(db, process.env.NODE_ENV));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
