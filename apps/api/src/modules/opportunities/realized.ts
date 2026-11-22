import { sql, type TenantTransaction } from '@reziproq/db';

/**
 * KI-11, Ablauf 6: Wird aus dem übernommenen Thema eine Initiative, verweist das Potenzial darauf.
 * Hat das Controlling Ist-Werte der Initiative freigegeben, wechselt es auf realized.
 */
export async function syncRealized(tx: TenantTransaction, orgId: string, relationshipId?: string) {
  const scope = relationshipId ? sql`and vo.relationship_id = ${relationshipId}` : sql``;
  await tx.execute(sql`
    update value_opportunity vo set initiative_id = it.initiative_id
    from initiative_topic it
    where vo.org_id = ${orgId} ${scope}
      and vo.adopted_topic_id = it.jbp_topic_id and vo.initiative_id is null`);
  await tx.execute(sql`
    update value_opportunity vo set status = 'realized'
    where vo.org_id = ${orgId} ${scope}
      and vo.status = 'adopted' and vo.initiative_id is not null
      and exists (
        select 1 from initiative_validation v
        where v.initiative_id = vo.initiative_id and v.status = 'approved')`);
}
