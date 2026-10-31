import { createDatabase } from './client.js';
import { linkOrganization } from './org-link.js';

// pnpm org:link "<Name>" <zitadel-org-id>
const [name, zitadelOrgId] = process.argv.slice(2);
if (!name || !zitadelOrgId) {
  console.error('Aufruf: pnpm org:link "<Name der Organisation>" <Resource ID aus Zitadel>');
  process.exit(1);
}

const { db, pool } = createDatabase();
try {
  const linked = await linkOrganization(db, name, zitadelOrgId);
  console.log(`„${linked.name}“ ist mit der Zitadel-Organisation ${zitadelOrgId} verknüpft.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
