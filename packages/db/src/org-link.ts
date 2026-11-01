import { eq, sql } from 'drizzle-orm';
import type { Database } from './client.js';
import { appUser, organization } from './schema/index.js';

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

/**
 * Macht eine Person zum Admin ihrer Organisation (PLT-05), z. B. den ersten Admin eines Kunden.
 * Sie muss sich schon einmal angemeldet haben und einer Organisation zugeordnet sein.
 */
export async function makeAdmin(db: Database, email: string) {
  const [user] = await db
    .select({ id: appUser.id, name: appUser.name, organizationId: appUser.organizationId })
    .from(appUser)
    .where(sql`lower(${appUser.email}) = lower(${email})`);
  if (!user) throw new Error(`Keine Person mit der E-Mail „${email}“. Erst einmal anmelden.`);
  if (!user.organizationId) {
    throw new Error(`„${user.name}“ gehört noch zu keiner Organisation (pnpm org:link).`);
  }
  await db
    .update(appUser)
    .set({ orgRole: 'admin', rolesImportedAt: sql`coalesce(${appUser.rolesImportedAt}, now())` })
    .where(eq(appUser.id, user.id));
  return user;
}

/**
 * Setzt oder entfernt das Kennzeichen Betreiber (UMB-01). Nur per Skript, nie über die API:
 * pnpm operator:set <email> bzw. pnpm operator:set --remove <email>.
 */
export async function setOperator(db: Database, email: string, isOperator: boolean) {
  const [user] = await db
    .update(appUser)
    .set({ isOperator })
    .where(sql`lower(${appUser.email}) = lower(${email})`)
    .returning({ id: appUser.id, name: appUser.name });
  if (!user) throw new Error(`Keine Person mit der E-Mail „${email}“. Erst einmal anmelden.`);
  return user;
}
