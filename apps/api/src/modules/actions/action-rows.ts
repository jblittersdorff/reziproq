import { and, eq, inArray, schema, sql, type TenantTransaction } from '@reziproq/db';

/** Offen heißt noch zu tun: open oder in_progress (QBR-03). */
export const openStatuses = ['open', 'in_progress'] as const;

/** Heute als JJJJ-MM-TT; überfällig ist, was davor fällig war und noch offen ist. */
export const today = () => new Date().toISOString().slice(0, 10);

export const isOverdue = (row: { dueDate: string; status: string }) =>
  (openStatuses as readonly string[]).includes(row.status) && row.dueDate < today();

/**
 * Offene Maßnahmen einer Beziehung, wie Row-Level Security sie der Session zeigt: geteilte beider
 * Seiten und die eigenen internen. Für Überblick und Termin; liest nur.
 */
export function openActionsOf(tx: TenantTransaction, relationshipId: string) {
  return tx
    .select({
      id: schema.action.id,
      title: schema.action.title,
      status: schema.action.status,
      dueDate: schema.action.dueDate,
    })
    .from(schema.action)
    .where(
      and(
        eq(schema.action.relationshipId, relationshipId),
        inArray(schema.action.status, [...openStatuses]),
      ),
    )
    .orderBy(schema.action.dueDate);
}

/** Zählt offene und überfällige Maßnahmen einer Beziehung. */
export async function countOpenActions(tx: TenantTransaction, relationshipId: string) {
  const [row] = await tx
    .select({
      open: sql<number>`count(*)::int`,
      overdue: sql<number>`count(*) filter (where ${schema.action.dueDate} < current_date)::int`,
    })
    .from(schema.action)
    .where(
      and(
        eq(schema.action.relationshipId, relationshipId),
        inArray(schema.action.status, [...openStatuses]),
      ),
    );
  return { open: row?.open ?? 0, overdue: row?.overdue ?? 0 };
}
