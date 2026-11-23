import { and, eq, schema, sql, type TenantTransaction } from '@reziproq/db';
import type { DueItem } from '@reziproq/shared';

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

/**
 * KI-16: Ist mehr als die Hälfte von mindestens 20 Bewertungen einer Regel „nicht hilfreich“,
 * bekommt der Admin eine Aufgabe, die Schwelle zu prüfen. Liest nur; die Aufgabe verschwindet,
 * sobald die Bewertungen wieder passen.
 */
export async function hintRuleReviewDue(
  tx: TenantTransaction,
  orgId: string,
  today: string,
): Promise<DueItem[]> {
  const rows = await tx.execute<{ rule_key: string }>(sql`
    select rule_key from hint where org_id = ${orgId} and feedback is not null
    group by rule_key
    having count(*) >= 20 and count(*) filter (where feedback = 'not_helpful') * 2 > count(*)
    order by rule_key`);
  return rows.rows.map((row) => ({
    id: `hint-rule-${row.rule_key}`,
    kind: 'hint_rule_review' as const,
    supplier: '',
    detail: row.rule_key,
    dueDate: today,
    href: '/einstellungen/ki#hinweise',
  }));
}
