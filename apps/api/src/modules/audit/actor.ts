import { type AuditActor, eq, schema, type TenantTransaction } from '@reziproq/db';
import type { AuthContext } from '../auth/auth.guard.js';

/** Wer ändert: Name aus app_user, wie er gerade heißt, und die Organisation (PLT-08). */
export async function actorOf(
  tx: TenantTransaction,
  auth: AuthContext,
  organizationId: string,
): Promise<AuditActor> {
  const [user] = await tx
    .select({ name: schema.appUser.name })
    .from(schema.appUser)
    .where(eq(schema.appUser.id, auth.userId));
  return { userId: auth.userId, name: user?.name ?? auth.userId, organizationId };
}
