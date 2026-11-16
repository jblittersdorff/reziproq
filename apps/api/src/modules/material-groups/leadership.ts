import { and, eq, inArray, schema, type TenantTransaction } from '@reziproq/db';

/**
 * WG-01: Lead und Commodity Manager stehen an der Warengruppe; das Team führt sie mit den Rollen
 * „lead“ und „commodity_manager“. Diese Zeilen folgen immer den Feldern der Warengruppe.
 */
export async function syncLeadership(
  tx: TenantTransaction,
  orgId: string,
  materialGroupId: string,
  leadUserId: string | null,
  commodityManagerUserId: string | null,
) {
  await tx
    .delete(schema.materialGroupMember)
    .where(
      and(
        eq(schema.materialGroupMember.materialGroupId, materialGroupId),
        inArray(schema.materialGroupMember.role, ['lead', 'commodity_manager']),
      ),
    );
  const rows = [
    ...(leadUserId ? [{ userId: leadUserId, role: 'lead' as const }] : []),
    ...(commodityManagerUserId
      ? [{ userId: commodityManagerUserId, role: 'commodity_manager' as const }]
      : []),
  ];
  if (rows.length === 0) return;
  await tx
    .insert(schema.materialGroupMember)
    .values(rows.map((row) => ({ ...row, orgId, materialGroupId })));
}
