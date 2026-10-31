import { eq } from 'drizzle-orm';
import type { Database } from './client.js';
import { organization } from './schema/index.js';

/**
 * Verknüpft eine Organisation mit ihrer Organisation in Zitadel (PLT-02). Beim nächsten Login
 * ordnet die API alle Nutzer dieser Zitadel-Organisation ihr zu.
 */
export async function linkOrganization(db: Database, name: string, zitadelOrgId: string) {
  const [linked] = await db
    .update(organization)
    .set({ zitadelOrgId })
    .where(eq(organization.name, name))
    .returning({ id: organization.id, name: organization.name });
  if (!linked) throw new Error(`Keine Organisation mit dem Namen „${name}“ gefunden.`);
  return linked;
}
