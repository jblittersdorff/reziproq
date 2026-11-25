import { eq, schema, sql, type TenantTransaction } from '@reziproq/db';
import {
  type DueItem,
  type OrgModules,
  type PreparedDraft,
  resolveOrgModules,
  sortTimeline,
  type TimelineItem,
  type WaitingItem,
  withModules,
} from '@reziproq/shared';

// NAV-10 1.1, UX-20 Phase 2: Quellen für Mein Tag, Terminschiene und „Als Nächstes“. Alles läuft
// in der Mandanten-Session; die Zeilensicherheit der Quelltabellen gilt weiter. Dazu sieht ein
// Käufer außer dem Admin nur Lieferanten, in deren Team er ist (wie Start und Hinweise).

export interface Viewer {
  orgId: string;
  userId: string;
  admin: boolean;
}

/** Sichtbare aktive Lieferanten der Person mit Namen, wie die Liste sie zeigt */
export async function visibleRelationships(
  tx: TenantTransaction,
  viewer: Viewer,
): Promise<Map<string, string>> {
  const rows = await tx.execute<{ id: string; name: string }>(sql`
    select r.id, coalesce(rs.display_name, o.name) as name
    from relationship r
    join organization o on o.id = r.supplier_org_id
    left join relationship_side rs on rs.relationship_id = r.id and rs.org_id = ${viewer.orgId}
    where r.buyer_org_id = ${viewer.orgId} and r.status = 'active'
      and (${viewer.admin} or exists (
        select 1 from relationship_member m
        where m.relationship_id = r.id and m.org_id = ${viewer.orgId} and m.user_id = ${viewer.userId}))
    order by name`);
  return new Map(rows.rows.map((row) => [row.id, row.name]));
}

/** Module der Organisation (UX-20); ohne Zeile der Standard */
export async function orgModulesOf(tx: TenantTransaction, orgId: string): Promise<OrgModules> {
  return resolveOrgModules(
    await tx
      .select({ module: schema.orgModule.module, enabled: schema.orgModule.enabled })
      .from(schema.orgModule)
      .where(eq(schema.orgModule.orgId, orgId)),
  );
}

const ids = (relationships: Map<string, string>) => [...relationships.keys()];
const uuidArray = (values: string[]) => sql`${`{${values.join(',')}}`}::uuid[]`;

/**
 * Terminschiene (`timeline_item`): Termine, offene Zusagen beider Seiten, Fristen offener
 * Bewertungsrunden und Reviews der Warengruppen zwischen `from` und `to`. Claims, Risiken und
 * Vertragsfristen kommen nur mit aktivem Modul dazu; in Release 1.1 haben sie keine Quelle.
 */
export async function timelineItems(
  tx: TenantTransaction,
  viewer: Viewer,
  relationships: Map<string, string>,
  range: { from: string; to: string },
  options: { rounds: 'all' | 'own'; modules: OrgModules },
): Promise<TimelineItem[]> {
  const relationshipIds = ids(relationships);
  const items: TimelineItem[] = [];
  if (relationshipIds.length > 0) {
    const meetings = await tx.execute<{
      id: string;
      relationship_id: string;
      title: string;
      starts_at: Date;
      location: string | null;
    }>(sql`
      select id, relationship_id, title, starts_at, location from meeting
      where relationship_id = any(${uuidArray(relationshipIds)}) and status = 'planned'
        and starts_at >= ${range.from}::date and starts_at < ${range.to}::date + 1`);
    for (const row of meetings.rows) {
      const startsAt = new Date(row.starts_at);
      items.push({
        id: `meeting:${row.id}`,
        date: startsAt.toISOString().slice(0, 10),
        kind: 'meeting',
        source: 'meeting',
        title: row.title,
        counterpart: relationships.get(row.relationship_id) ?? null,
        detail: row.location,
        startsAt: startsAt.toISOString(),
        progress: null,
        href: `/lieferanten/${row.relationship_id}/umsetzung/termine/${row.id}`,
        relationshipId: row.relationship_id,
        categoryId: null,
      });
    }
    const commitments = await tx.execute<{
      id: string;
      relationship_id: string;
      title: string;
      owner_name: string;
      side: 'buyer' | 'supplier';
      due_on: string;
    }>(sql`
      select id, relationship_id, title, owner_name, side, due_on::text from commitment
      where relationship_id = any(${uuidArray(relationshipIds)}) and status = 'open'
        and due_on between ${range.from}::date and ${range.to}::date`);
    for (const row of commitments.rows) {
      items.push({
        id: `commitment:${row.id}`,
        date: row.due_on,
        kind: 'commitment',
        source: 'commitment',
        title: row.title,
        counterpart: relationships.get(row.relationship_id) ?? null,
        detail: row.side === 'supplier' ? row.owner_name : null,
        startsAt: null,
        progress: null,
        href: `/lieferanten/${row.relationship_id}/plan/zusagen#${row.id}`,
        relationshipId: row.relationship_id,
        categoryId: null,
      });
    }
  }
  const rounds = await tx.execute<{
    id: string;
    name: string;
    due_date: string;
    done: number;
    total: number;
  }>(sql`
    select s.id, s.name, s.due_date::text,
      (select count(*)::int from rating_assignment a where a.round_id = s.id and a.status = 'submitted') as done,
      (select count(*)::int from rating_assignment a where a.round_id = s.id) as total
    from segmentation_round s
    where s.org_id = ${viewer.orgId} and s.status = 'open'
      and s.due_date between ${range.from}::date and ${range.to}::date
      and (${options.rounds === 'all'} or exists (
        select 1 from rating_assignment a where a.round_id = s.id and a.rater_user_id = ${viewer.userId}))`);
  for (const row of rounds.rows) {
    items.push({
      id: `round:${row.id}`,
      date: row.due_date,
      kind: 'deadline',
      source: 'round',
      title: row.name,
      counterpart: null,
      detail: null,
      startsAt: null,
      progress: { done: row.done, total: row.total },
      href: options.rounds === 'all' ? `/portfolio/runden/${row.id}` : '/bewertungen',
      relationshipId: null,
      categoryId: null,
    });
  }
  const reviews = await tx.execute<{
    id: string;
    due_on: string;
    group_id: string;
    group_name: string;
  }>(sql`
    select r.id, r.due_on::text, g.id as group_id, g.name as group_name
    from material_group_review r
    join material_group_strategy s on s.id = r.strategy_id
    join material_group g on g.id = s.material_group_id
    where r.org_id = ${viewer.orgId} and r.held_at is null
      and r.due_on between ${range.from}::date and ${range.to}::date
      and (${viewer.admin} or g.lead_user_id = ${viewer.userId}
        or g.commodity_manager_user_id = ${viewer.userId})`);
  for (const row of reviews.rows) {
    items.push({
      id: `review:${row.id}`,
      date: row.due_on,
      kind: 'meeting',
      source: 'category_review',
      title: row.group_name,
      counterpart: row.group_name,
      detail: null,
      startsAt: null,
      progress: null,
      href: `/warengruppen/${row.group_id}/review/${row.id}`,
      relationshipId: null,
      categoryId: row.group_id,
    });
  }
  return sortTimeline(withModules(items, options.modules));
}

/** Wirkung je Lieferant für die Reihenfolge von „Als Nächstes“: Spend des jüngsten Jahres */
export async function spendWeights(
  tx: TenantTransaction,
  relationshipIds: string[],
): Promise<Map<string, number>> {
  if (relationshipIds.length === 0) return new Map();
  const rows = await tx.execute<{ relationship_id: string; amount_cents: string }>(sql`
    select distinct on (relationship_id) relationship_id, amount_cents::text
    from relationship_spend_total
    where relationship_id = any(${uuidArray(relationshipIds)})
    order by relationship_id, year desc`);
  return new Map(rows.rows.map((row) => [row.relationship_id, Number(row.amount_cents)]));
}

/**
 * Heute erledigt von der Person, nur aus Quellen mit Erledigt-Zeitpunkt: Maßnahmen, Beiträge zum
 * Lieferantenplan, Freigaben der Wirkung und abgegebene Bewertungen.
 */
export async function doneToday(
  tx: TenantTransaction,
  viewer: Viewer,
  today: string,
): Promise<number> {
  const [row] = (
    await tx.execute<{ count: number }>(sql`
      select (
        (select count(*) from action
          where owner_user_id = ${viewer.userId} and status = 'done' and done_at::date = ${today}::date)
        + (select count(*) from plan_contribution
          where assignee_user_id = ${viewer.userId} and status = 'done' and done_at::date = ${today}::date)
        + (select count(*) from initiative_validation
          where decided_by = ${viewer.userId} and decided_at::date = ${today}::date)
        + (select count(distinct a.id) from rating_assignment a join rating r on r.assignment_id = a.id
          where a.rater_user_id = ${viewer.userId} and r.submitted_at::date = ${today}::date)
      )::int as count`)
  ).rows;
  return row?.count ?? 0;
}

/** Wohin ein Entwurf von Reziproq führt; ohne bekanntes Ziel die Aktivitäten des Lieferanten */
export function preparedHref(kind: string, objectId: string, relationshipId: string): string {
  const base = `/lieferanten/${relationshipId}`;
  if (kind.startsWith('brief_') || kind === 'pre_read') {
    return `${base}/umsetzung/termine/${objectId}`;
  }
  switch (kind) {
    case 'deviation_explanation':
      return `${base}/strategie/segmentierung`;
    case 'feedback_themes':
      return `${base}/beziehung/feedback`;
    case 'plan_summary':
      return `${base}/strategie/lieferantenplan`;
    case 'hint_explanation':
      return `/warum/${objectId}`;
    default:
      return `${base}/aktivitaeten`;
  }
}

/**
 * Von Reziproq vorbereitet: offene Entwürfe der Person mit belegten Aussagen, je Objekt einmal
 * (ein Briefing besteht aus mehreren Teilen). Wie bisher nur Admins oder die SRO der Beziehung.
 */
export async function preparedDrafts(
  tx: TenantTransaction,
  viewer: Viewer,
  relationships: Map<string, string>,
): Promise<PreparedDraft[]> {
  const rows = await tx.execute<{
    object_type: string;
    object_id: string;
    relationship_id: string;
    kind: string;
    count: number;
    created_at: Date;
    subject: string | null;
  }>(sql`
    select d.object_type, d.object_id, d.relationship_id,
      (array_agg(d.kind order by d.created_at))[1] as kind,
      count(*)::int as count, max(d.created_at) as created_at,
      (select m.title from meeting m where d.object_type = 'meeting' and m.id = d.object_id) as subject
    from ai_draft d
    where d.org_id = ${viewer.orgId} and d.created_by = ${viewer.userId} and d.status = 'draft'
      and d.claims is not null and d.relationship_id is not null
      and (${viewer.admin} or exists (
        select 1 from relationship_member m
        where m.relationship_id = d.relationship_id and m.org_id = d.org_id
          and m.user_id = ${viewer.userId} and m.team_role = 'sro'))
    group by d.object_type, d.object_id, d.relationship_id
    order by max(d.created_at) desc`);
  return rows.rows
    .filter((row) => relationships.has(row.relationship_id) || viewer.admin)
    .map((row) => ({
      id: `${row.object_type}:${row.object_id}`,
      kind: row.kind,
      objectType: row.object_type,
      subject: row.subject,
      counterpart: relationships.get(row.relationship_id) ?? null,
      count: row.count,
      createdAt: new Date(row.created_at).toISOString(),
      href: preparedHref(row.kind, row.object_id, row.relationship_id),
    }));
}

/**
 * Wartet auf andere: offene Zusagen (beider Seiten), Maßnahmen und Beiträge anderer Personen in
 * den sichtbaren Beziehungen, mit Frist bis `until`; überfällige zuerst.
 */
export async function waitingOnOthers(
  tx: TenantTransaction,
  viewer: Viewer,
  relationships: Map<string, string>,
  until: string,
): Promise<WaitingItem[]> {
  const relationshipIds = ids(relationships);
  if (relationshipIds.length === 0) return [];
  const list = uuidArray(relationshipIds);
  const rows = await tx.execute<{
    id: string;
    kind: WaitingItem['kind'];
    title: string;
    owner: string;
    relationship_id: string;
    due: string;
  }>(sql`
    select id::text, 'commitment' as kind, title, owner_name as owner, relationship_id, due_on::text as due
    from commitment
    where relationship_id = any(${list}) and status = 'open' and due_on <= ${until}::date
      and owner_user_id is distinct from ${viewer.userId}
    union all
    select id::text, 'action', title, owner_name, relationship_id, due_date::text
    from action
    where relationship_id = any(${list}) and status in ('open', 'in_progress') and due_date <= ${until}::date
      and owner_user_id is distinct from ${viewer.userId}
    union all
    select c.id::text, 'contribution', coalesce(g.name, b.name, ''), coalesce(u.name, ''),
      c.relationship_id, c.due_date::text
    from plan_contribution c
    left join material_group g on g.id = c.material_group_id
    left join business_unit b on b.id = c.business_unit_id
    left join app_user u on u.id = c.assignee_user_id
    where c.relationship_id = any(${list}) and c.status = 'open' and c.due_date <= ${until}::date
      and c.assignee_user_id <> ${viewer.userId}
    order by due, id`);
  return rows.rows.map((row) => {
    const base = `/lieferanten/${row.relationship_id}`;
    return {
      id: `${row.kind}:${row.id}`,
      kind: row.kind,
      title: row.title,
      owner: row.owner,
      counterpart: relationships.get(row.relationship_id) ?? '',
      dueDate: row.due,
      href:
        row.kind === 'commitment'
          ? `${base}/plan/zusagen#${row.id}`
          : row.kind === 'action'
            ? `${base}/umsetzung/massnahmen#${row.id}`
            : `${base}/strategie/lieferantenplan`,
    };
  });
}

/** Offene Hinweise der sichtbaren Lieferanten, davon mit hoher Schwere */
export async function hintCounts(
  tx: TenantTransaction,
  viewer: Viewer,
  relationships: Map<string, string>,
): Promise<{ open: number; high: number }> {
  const relationshipIds = ids(relationships);
  if (relationshipIds.length === 0 && !viewer.admin) return { open: 0, high: 0 };
  const [row] = (
    await tx.execute<{ open: number; high: number }>(sql`
      select count(*)::int as open, count(*) filter (where severity = 'high')::int as high
      from hint
      where org_id = ${viewer.orgId} and status = 'open'
        and (${viewer.admin} or relationship_id = any(${uuidArray(relationshipIds)}))`)
  ).rows;
  return { open: row?.open ?? 0, high: row?.high ?? 0 };
}

/**
 * Lieferanten, die die Person brauchen (F-UX-06): Aufgabe mit Frist bis heute, offener Hinweis,
 * offener Widerspruch zwischen Warengruppen oder überfällige Zusage. Je Lieferant der erste Grund.
 */
export async function needsYou(
  tx: TenantTransaction,
  viewer: Viewer,
  relationships: Map<string, string>,
  due: DueItem[],
  today: string,
  relationshipOf: (item: DueItem) => string | null,
): Promise<
  { relationshipId: string; reason: 'due' | 'hint' | 'conflict' | 'commitment'; title: string }[]
> {
  const result = new Map<
    string,
    { relationshipId: string; reason: 'due' | 'hint' | 'conflict' | 'commitment'; title: string }
  >();
  const add = (
    relationshipId: string,
    reason: 'due' | 'hint' | 'conflict' | 'commitment',
    title: string,
  ) => {
    if (relationships.has(relationshipId) && !result.has(relationshipId)) {
      result.set(relationshipId, { relationshipId, reason, title });
    }
  };
  for (const item of due) {
    const relationshipId = relationshipOf(item);
    if (relationshipId && item.dueDate <= today) add(relationshipId, 'due', item.kind);
  }
  const relationshipIds = ids(relationships);
  if (relationshipIds.length > 0) {
    const list = uuidArray(relationshipIds);
    const rows = await tx.execute<{
      relationship_id: string;
      reason: 'hint' | 'conflict' | 'commitment';
      title: string;
    }>(sql`
      select relationship_id, 'hint' as reason, coalesce(title, rule_key) as title, 1 as rank, score as weight
      from hint where org_id = ${viewer.orgId} and status in ('open', 'in_progress')
        and relationship_id = any(${list})
      union all
      select relationship_id, 'conflict', rule_key, 2, 0
      from material_group_conflict where org_id = ${viewer.orgId} and status = 'open'
        and relationship_id = any(${list})
      union all
      select relationship_id, 'commitment', title, 3, 0
      from commitment where relationship_id = any(${list}) and status = 'open' and due_on < ${today}::date
      order by rank, weight desc`);
    for (const row of rows.rows) add(row.relationship_id, row.reason, row.title);
  }
  return [...result.values()];
}
