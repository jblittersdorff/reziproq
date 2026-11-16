import { and, eq, schema, sql, type TenantTransaction } from '@reziproq/db';

/** FS-01: offene Hinweise für Start und Überblick; liest nur, prüft nicht neu. */
export async function openHintCount(
  tx: TenantTransaction,
  orgId: string,
  relationshipId?: string,
): Promise<number> {
  const [row] = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.hint)
    .where(
      and(
        eq(schema.hint.orgId, orgId),
        eq(schema.hint.status, 'open'),
        relationshipId ? eq(schema.hint.relationshipId, relationshipId) : undefined,
      ),
    );
  return row?.count ?? 0;
}
