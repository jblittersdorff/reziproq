import { createDatabase } from './client.js';
import { linkOrganization, makeAdmin } from './org-link.js';

// pnpm org:link "<Name>" <zitadel-org-id>
// pnpm org:link --admin <email>
const [first, second] = process.argv.slice(2);
if (!first || !second) {
  console.error('Aufruf: pnpm org:link "<Name der Organisation>" <Resource ID aus Zitadel>');
  console.error('        pnpm org:link --admin <E-Mail>');
  process.exit(1);
}

const { db, pool } = createDatabase();
try {
  if (first === '--admin') {
    const user = await makeAdmin(db, second);
    console.log(`„${user.name}“ ist jetzt Admin der eigenen Organisation.`);
  } else {
    const linked = await linkOrganization(db, first, second);
    console.log(`„${linked.name}“ ist mit der Zitadel-Organisation ${second} verknüpft.`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
