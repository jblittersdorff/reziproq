import { and, asc, eq, schema, type TenantTransaction } from '@reziproq/db';
import type { Person } from '@reziproq/shared';

/**
 * Personen der eigenen Seite, die Verantwortung übernehmen können (JBP-03, JBP-05): das Team der
 * Beziehung; wer gerade arbeitet, kann sich selbst eintragen, auch ohne Teamplatz. Wie bei den
 * Maßnahmen (QBR-03). Die andere Seite wählt nie Personen dieser Seite.
 */
export async function teamPeople(
  tx: TenantTransaction,
  relationshipId: string,
  orgId: string,
  userId: string,
): Promise<Person[]> {
  const rows = await tx
    .select({ userId: schema.appUser.id, name: schema.appUser.name })
    .from(schema.relationshipMember)
    .innerJoin(schema.appUser, eq(schema.appUser.id, schema.relationshipMember.userId))
    .where(
      and(
        eq(schema.relationshipMember.relationshipId, relationshipId),
        eq(schema.relationshipMember.orgId, orgId),
      ),
    )
    .orderBy(asc(schema.appUser.name));
  if (!rows.some((row) => row.userId === userId)) {
    const [me] = await tx
      .select({ userId: schema.appUser.id, name: schema.appUser.name })
      .from(schema.appUser)
      .where(eq(schema.appUser.id, userId));
    if (me) rows.push(me);
  }
  return rows;
}
