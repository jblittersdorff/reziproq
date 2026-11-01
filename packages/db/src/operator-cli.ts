import { createDatabase } from './client.js';
import { setOperator } from './org-link.js';

// pnpm operator:set <email>            macht die Person zum Betreiber von Reziproq (UMB-01)
// pnpm operator:set --remove <email>   nimmt es wieder weg
const args = process.argv.slice(2);
const remove = args[0] === '--remove';
const email = remove ? args[1] : args[0];
if (!email) {
  console.error('Aufruf: pnpm operator:set <E-Mail>  oder  pnpm operator:set --remove <E-Mail>');
  process.exit(1);
}

const { db, pool } = createDatabase();
try {
  const user = await setOperator(db, email, !remove);
  console.log(
    remove
      ? `„${user.name}“ ist kein Betreiber mehr.`
      : `„${user.name}“ ist jetzt Betreiber von Reziproq.`,
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
