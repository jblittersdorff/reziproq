import { and, eq, schema, type TenantTransaction } from '@reziproq/db';
import type { OrgRole } from '@reziproq/shared';
import type { AuthContext } from '../auth/auth.guard.js';

/**
 * Wer für eine Anbindung handelt: die verbindende Person bzw. die Person, die einen API-Schlüssel
 * erzeugt hat, mit ihrer heutigen Rolle (IN-01, IN-07). null, wenn sie nicht mehr dazugehört.
 */
export async function actorIn(
  tx: TenantTransaction,
  orgId: string,
  userId: string,
): Promise<AuthContext | null> {
  const [person] = await tx
    .select({ orgRole: schema.appUser.orgRole, isControlling: schema.appUser.isControlling })
    .from(schema.appUser)
    .where(and(eq(schema.appUser.id, userId), eq(schema.appUser.organizationId, orgId)));
  const [organization] = await tx
    .select({ name: schema.organization.name, country: schema.organization.country })
    .from(schema.organization)
    .where(eq(schema.organization.id, orgId));
  const [buyer] = await tx
    .select({ feature: schema.organizationFeature.feature })
    .from(schema.organizationFeature)
    .where(
      and(
        eq(schema.organizationFeature.organizationId, orgId),
        eq(schema.organizationFeature.feature, 'buyer'),
      ),
    );
  if (!person || !organization) return null;
  return {
    userId,
    accessToken: '',
    orgRole: person.orgRole as OrgRole,
    isControlling: person.isControlling,
    isOperator: false,
    tokenRoles: [],
    organization: { id: orgId, ...organization, buyer: Boolean(buyer) },
  };
}
