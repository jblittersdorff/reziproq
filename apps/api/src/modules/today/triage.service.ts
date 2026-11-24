import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  and,
  currentTime,
  eq,
  inArray,
  schema,
  sql,
  type TenantSession,
  type TenantTransaction,
} from '@reziproq/db';
import {
  type DueItem,
  daysBetween,
  dueMinutes,
  type FocusTopic,
  type FocusTopicKind,
  type FocusTopicLevel,
  focusTopicSchema,
  impactOf,
  maxVisibleFocus,
  type NextAction,
  nextActionSchema,
  type SentenceFact,
  sentenceFactSchema,
  type Today,
  todaySchema,
  triageScore,
  urgencyOf,
} from '@reziproq/shared';
import { z } from 'zod';
import { TenantDatabase } from '../../common/database.module.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { can } from '../auth/can.js';
import { HintsService } from '../hints/hints.service.js';
import { preparedHref, spendWeights, visibleRelationships } from '../start/my-day-data.js';
import { StartService } from '../start/start.service.js';
import { nextMorning } from './berlin.js';
import {
  type DraftRow,
  fromDraft,
  fromDue,
  fromHint,
  fromRun,
  keyOf,
  type Locale,
  type RunRow,
  type TriageCandidate,
  shownSentence,
} from './triage.js';

// HE-01 Dienst 1 (K1-c): Triage je Person. Sammelt die Ergebnisse aller Module (Fristen und
// Freigaben aus Start, Hinweise, Entwürfe, Handlungen von Reziproq), rechnet die Punktzahl und hält
// genau ein Fokus-Thema je Ergebnis in focus_item. Läuft bei jedem Aufruf von Heute und „Als
// Nächstes“ (so ist jedes Ereignis sofort drin) und täglich um 06:00 (TriageWorker).

const isoToday = () => currentTime().toISOString().slice(0, 10);
/** Kurz prüfen: ohne Schätzung am Entwurf eine Minute je Entwurf */
const defaultReviewSeconds = 60;
const factsSchema = z.array(sentenceFactSchema).catch([]);
const notFound = () => new NotFoundException({ statusCode: 404, code: 'nicht_gefunden' });

interface ScoredCandidate extends TriageCandidate {
  score: number;
}

interface TopicRow extends Record<string, unknown> {
  id: string;
  level: FocusTopicLevel;
  kind: FocusTopicKind;
  title: string;
  sentence: string | null;
  sentence_facts: unknown;
  object_type: string;
  object_id: string | null;
  relationship_id: string | null;
  source_type: string;
  source_id: string;
  score: string | number;
  due_at: Date | string | null;
  href: string | null;
}

const textArray = (values: string[]) => sql`${`{${values.join(',')}}`}::text[]`;
const uuidArray = (values: string[]) => sql`${`{${values.join(',')}}`}::uuid[]`;

@Injectable()
export class TriageService {
  constructor(
    @Inject(TenantDatabase) private readonly tenant: TenantDatabase,
    @Inject(StartService) private readonly start: StartService,
    @Inject(HintsService) private readonly hints: HintsService,
  ) {}

  private session(auth: AuthContext): TenantSession | null {
    return auth.organization ? { userId: auth.userId, organizationId: auth.organization.id } : null;
  }

  /**
   * Triage für eine Person: legt jedes Ergebnis als Fokus-Thema an oder aktualisiert es, schließt
   * Themen, deren Ergebnis die Module nicht mehr melden (erledigt oder nicht mehr sichtbar), und holt
   * „Später“ nach Ablauf zurück. `due` nur, wenn die Fristen schon geladen sind.
   */
  async refresh(auth: AuthContext, due?: DueItem[]): Promise<Map<string, ScoredCandidate>> {
    const session = this.session(auth);
    const organization = auth.organization;
    if (!session || !organization) return new Map();
    const today = isoToday();
    const dueItems = due ?? (await this.start.dueItems(auth));
    const hints =
      organization.buyer && can(auth, 'hinweise.sehen') ? await this.hints.openFor(auth) : [];
    const scored = await this.tenant.run(session, async (tx) => {
      const locale = await localeOf(tx, auth.userId);
      const candidates = unique([
        ...dueItems.map((item) => fromDue(item, today, locale)),
        ...hints.map((hint) => fromHint(hint, today, locale)),
        ...(await draftsOf(tx, auth)).map((draft) => fromDraft(draft, locale)),
        ...(await runsOf(tx, auth, today)).map((run) => fromRun(run, locale)),
      ]);
      // Eine Beziehung hängt nur an, wenn es sie gibt; dazu Spend und Segmentgewicht je Beziehung.
      const existing = await existingRelationships(
        tx,
        candidates.flatMap((candidate) => candidate.relationshipId ?? []),
      );
      for (const candidate of candidates) {
        if (candidate.relationshipId && !existing.has(candidate.relationshipId)) {
          candidate.relationshipId = null;
        }
      }
      const ids = [...existing];
      const spend = organization.buyer ? await spendWeights(tx, ids) : new Map<string, number>();
      const weights = organization.buyer
        ? await segmentWeights(tx, organization.id, ids)
        : new Map<string, number>();
      const rows = candidates.map((candidate) => ({
        ...candidate,
        // G-6: Auch gespeichert wird nur ein belegter Satz.
        sentence: shownSentence(candidate.sentence, candidate.facts, candidate.kind, locale),
        score: triageScore(
          impactOf({
            cents: spend.get(candidate.relationshipId ?? ''),
            severity: candidate.severity,
          }),
          urgencyOf(candidate.dueDate, today),
          weights.get(candidate.relationshipId ?? '') ?? 1,
        ),
      }));
      // In der Betreiber-Ansicht (PLT-13) entsteht nichts im Mandanten des Kunden.
      if (!auth.supportOrganization) await store(tx, session, rows);
      return rows;
    });
    return new Map(scored.map((row) => [keyOf(row), row]));
  }

  /** Heute (HE-01): „Als Nächstes“, höchstens zwei weitere Fokus-Themen, Zahlen für Kurz prüfen */
  async today(auth: AuthContext): Promise<Today> {
    const today = isoToday();
    const session = this.session(auth);
    if (!session) {
      return todaySchema.parse({
        today,
        next: null,
        more: [],
        openFocus: 0,
        review: { count: 0, minutes: 0 },
        done: { count: 0 },
        background: null,
      });
    }
    const candidates = await this.refresh(auth);
    return this.tenant.run(
      session,
      async (tx) => {
        const locale = await localeOf(tx, auth.userId);
        const own = sql`org_id = ${session.organizationId} and user_id = ${session.userId}`;
        const visible = await tx.execute<TopicRow>(sql`
          select * from next_action where ${own}
          order by score desc, due_at asc nulls last, created_at, id
          limit ${maxVisibleFocus}`);
        const [counts] = (
          await tx.execute<{ open_focus: number; done: number }>(sql`
            select (select count(*)::int from next_action where ${own}) as open_focus,
              (select count(*)::int from focus_item where ${own} and level = 'done'
                and created_at::date = ${today}::date) as done`)
        ).rows;
        const review = await tx.execute<{ source_type: string; source_id: string }>(sql`
          select source_type, source_id from focus_item
          where ${own} and level = 'review' and state = 'open'`);
        const seconds = review.rows.reduce(
          (sum, row) =>
            sum + (candidates.get(keyOf(sourceOf(row)))?.reviewSeconds ?? defaultReviewSeconds),
          0,
        );
        const topics = visible.rows.map((row) => topicOf(row, candidates, locale));
        const [running] = (
          await tx.execute<{ id: string; task: string; counterpart: string | null }>(sql`
            select r.id, a.name as task, coalesce(side.display_name, o.name) as counterpart
            from agent_run r
            join agent_version v on v.org_id = r.org_id and v.id = r.agent_version_id
            join agent a on a.org_id = v.org_id and a.id = v.agent_id
            left join relationship rel on rel.id = r.context_relationship_id
            left join organization o on o.id = case
              when rel.buyer_org_id = r.org_id then rel.supplier_org_id else rel.buyer_org_id end
            left join relationship_side side
              on side.relationship_id = rel.id and side.org_id = r.org_id
            where r.org_id = ${session.organizationId} and r.acting_user_id = ${session.userId}
              and r.status in ('queued', 'running') and not r.is_test
            order by r.created_at desc
            limit 1`)
        ).rows;
        return todaySchema.parse({
          today,
          next: topics[0] ?? null,
          more: topics.slice(1),
          openFocus: counts?.open_focus ?? 0,
          review: { count: review.rows.length, minutes: Math.ceil(seconds / 60) },
          done: { count: counts?.done ?? 0 },
          background: running
            ? { runId: running.id, task: running.task, counterpart: running.counterpart }
            : null,
        });
      },
      { readOnly: true },
    );
  }

  /**
   * „Als Nächstes“ im Format von Start und Mein Tag (NAV-10 1.1), gelesen aus der Sicht
   * `next_action`: global oder für einen Lieferanten. Ohne Zugriff auf den Lieferanten gibt es keine
   * Karte. Fokus-Themen ohne Frist im alten Format (Entwürfe) überspringt die Karte bis K1-e.
   */
  async nextAction(
    auth: AuthContext,
    options: { relationshipId?: string | undefined; due?: DueItem[] | undefined } = {},
  ): Promise<NextAction | null> {
    const session = this.session(auth);
    const organization = auth.organization;
    if (!session || !organization) return null;
    const { relationshipId } = options;
    if (relationshipId) {
      if (!organization.buyer) return null;
      const visible = await this.tenant.run(
        session,
        (tx) =>
          visibleRelationships(tx, {
            orgId: organization.id,
            userId: auth.userId,
            admin: auth.orgRole === 'admin',
          }),
        { readOnly: true },
      );
      if (!visible.has(relationshipId)) return null;
    }
    const candidates = await this.refresh(auth, options.due);
    const rows = await this.tenant.run(
      session,
      (tx) =>
        tx.execute<{ source_type: string; source_id: string }>(sql`
          select source_type, source_id from next_action
          where org_id = ${session.organizationId} and user_id = ${session.userId}
            ${relationshipId ? sql`and relationship_id = ${relationshipId}` : sql``}
          order by score desc, due_at asc nulls last, created_at, id`),
      { readOnly: true },
    );
    const today = isoToday();
    for (const row of rows.rows) {
      const item = candidates.get(keyOf(sourceOf(row)))?.dueItem;
      if (!item) continue;
      return nextActionSchema.parse({
        scope: relationshipId ? 'relationship' : 'global',
        item,
        overdueDays: daysBetween(item.dueDate, today),
        minutes: dueMinutes[item.kind] ?? null,
      });
    }
    return null;
  }

  /** „Morgen erinnern“ (HE-01 Dienst 4): bis zum nächsten Tag 07:00 nach der Uhr des Mandanten */
  async snooze(auth: AuthContext, id: string): Promise<{ snoozedUntil: string }> {
    const session = this.session(auth);
    if (!session || auth.supportOrganization) throw notFound();
    const until = nextMorning(currentTime());
    const [row] = await this.tenant.run(session, (tx) =>
      tx
        .update(schema.focusItem)
        .set({ state: 'snoozed', snoozedUntil: until })
        .where(
          and(
            eq(schema.focusItem.id, id),
            eq(schema.focusItem.orgId, session.organizationId as string),
            eq(schema.focusItem.userId, session.userId),
            eq(schema.focusItem.level, 'focus'),
            inArray(schema.focusItem.state, ['open', 'snoozed']),
          ),
        )
        .returning({ id: schema.focusItem.id }),
    );
    if (!row) throw notFound();
    return { snoozedUntil: until.toISOString() };
  }
}

const sourceOf = (row: { source_type: string; source_id: string }) => ({
  sourceType: row.source_type,
  sourceId: row.source_id,
});

/** Fokus-Thema für die Antwort: Satz geprüft (G-6), Gegenüber aus dem letzten Lauf der Triage */
function topicOf(
  row: TopicRow,
  candidates: Map<string, ScoredCandidate>,
  locale: Locale,
): FocusTopic {
  const facts: SentenceFact[] = factsSchema.parse(row.sentence_facts);
  return focusTopicSchema.parse({
    id: row.id,
    level: row.level,
    kind: row.kind,
    title: row.title,
    sentence: shownSentence(row.sentence, facts, row.kind, locale),
    facts,
    objectType: row.object_type,
    objectId: row.object_id,
    relationshipId: row.relationship_id,
    counterpart: candidates.get(keyOf(sourceOf(row)))?.counterpart ?? null,
    dueDate: row.due_at ? new Date(row.due_at).toISOString().slice(0, 10) : null,
    href: row.href,
    score: Number(row.score),
  });
}

/** Ein Ergebnis zählt einmal, auch wenn zwei Module es melden */
function unique(candidates: TriageCandidate[]): TriageCandidate[] {
  const seen = new Map<string, TriageCandidate>();
  for (const candidate of candidates) {
    if (!seen.has(keyOf(candidate))) seen.set(keyOf(candidate), candidate);
  }
  return [...seen.values()];
}

async function localeOf(tx: TenantTransaction, userId: string): Promise<Locale> {
  const [row] = await tx
    .select({ locale: schema.appUser.locale })
    .from(schema.appUser)
    .where(eq(schema.appUser.id, userId));
  return row?.locale === 'en' ? 'en' : 'de';
}

async function existingRelationships(tx: TenantTransaction, ids: string[]): Promise<Set<string>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Set();
  const rows = await tx
    .select({ id: schema.relationship.id })
    .from(schema.relationship)
    .where(inArray(schema.relationship.id, unique));
  return new Set(rows.map((row) => row.id));
}

/**
 * Segmentgewicht je Beziehung (E-K0-17): Gewicht des Segmenttyps im aktiven Modell an der Stelle
 * des Ist-Segments der letzten Gesamtentscheidung; ohne Entscheidung 1,0.
 */
async function segmentWeights(
  tx: TenantTransaction,
  orgId: string,
  relationshipIds: string[],
): Promise<Map<string, number>> {
  if (relationshipIds.length === 0) return new Map();
  const rows = await tx.execute<{ relationship_id: string; weight: number }>(sql`
    select d.relationship_id, t.triage_weight::float8 as weight
    from (
      select distinct on (relationship_id) relationship_id, ist_impact_level, ist_quality_level
      from segment_decision
      where relationship_id = any(${uuidArray(relationshipIds)}) and scope = 'total'
      order by relationship_id, version desc
    ) d
    join segment_model m on m.org_id = ${orgId} and m.status = 'active'
    join segment_type t on t.model_id = m.id
      and t.impact_level = d.ist_impact_level and t.quality_level = d.ist_quality_level`);
  return new Map(rows.rows.map((row) => [row.relationship_id, Number(row.weight)]));
}

/**
 * Offene Entwürfe der Person (KI-03): wie „Von Reziproq vorbereitet“ nur mit belegten Aussagen und
 * als Admin oder SRO der Beziehung, aber je Entwurf; dazu Anfragen zum Teilen ohne Bestätigung
 * (ZA-01), die keine Aussagen haben, für jede Person im Team.
 */
async function draftsOf(tx: TenantTransaction, auth: AuthContext): Promise<DraftRow[]> {
  const organization = auth.organization;
  if (!organization) return [];
  const admin = auth.orgRole === 'admin';
  const rows = await tx.execute<{
    id: string;
    kind: string;
    object_type: string;
    object_id: string;
    relationship_id: string | null;
    subject: string | null;
    content: string;
    claims: { key: string; text: string }[] | null;
    review_seconds: number | null;
  }>(sql`
    select d.id, d.kind, d.object_type, d.object_id, d.relationship_id, d.subject, d.content,
      d.claims, d.review_seconds
    from ai_draft d
    where d.org_id = ${organization.id} and d.created_by = ${auth.userId} and d.status = 'draft'
      and d.relationship_id is not null
      and (d.kind = 'share_request' or d.claims is not null)
      and (${admin} or exists (
        select 1 from relationship_member m
        where m.relationship_id = d.relationship_id and m.org_id = d.org_id
          and m.user_id = ${auth.userId} and (d.kind = 'share_request' or m.team_role = 'sro')))
    order by d.review_order nulls last, d.created_at`);
  const names = organization.buyer
    ? await visibleRelationships(tx, { orgId: organization.id, userId: auth.userId, admin })
    : new Map<string, string>();
  return rows.rows.map((row) => {
    const relationshipId = row.relationship_id as string;
    const meetingPage = row.kind.startsWith('capture_') && row.object_type === 'meeting';
    return {
      id: row.id,
      kind: row.kind,
      objectType: row.object_type,
      objectId: row.object_id,
      relationshipId,
      subject: row.subject,
      content: row.content,
      claims: row.claims,
      reviewSeconds: row.review_seconds,
      counterpart: names.get(relationshipId) ?? null,
      href: !organization.buyer
        ? null
        : meetingPage
          ? `/lieferanten/${relationshipId}/umsetzung/termine/${row.object_id}`
          : preparedHref(row.kind, row.object_id, relationshipId),
    };
  });
}

/**
 * Handlungen von Reziproq auf Stufe Erledigen mit Rücknahme (HE-01 Dienst 3) der letzten 30 Tage,
 * die mit den Rechten der Person liefen. Die Läufe schreiben undo_payload ab K1-e und K1-f.
 */
async function runsOf(tx: TenantTransaction, auth: AuthContext, today: string): Promise<RunRow[]> {
  const organization = auth.organization;
  if (!organization) return [];
  const rows = await tx.execute<{
    id: string;
    agent_name: string;
    relationship_id: string | null;
  }>(sql`
    select r.id, a.name as agent_name, r.context_relationship_id as relationship_id
    from agent_run r
    join agent_version v on v.org_id = r.org_id and v.id = r.agent_version_id
    join agent a on a.org_id = v.org_id and a.id = v.agent_id
    where r.org_id = ${organization.id} and r.acting_user_id = ${auth.userId}
      and r.status = 'done' and r.undo_payload is not null and r.undone_at is null
      and r.created_at >= ${today}::date - 30
    order by r.created_at desc`);
  return rows.rows.map((row) => ({
    id: row.id,
    agentName: row.agent_name,
    relationshipId: row.relationship_id,
    counterpart: null,
  }));
}

/** Schreibt die Fokus-Themen eines Laufs; der Zustand bleibt, außer ein erledigtes kehrt zurück. */
async function store(tx: TenantTransaction, session: TenantSession, rows: ScoredCandidate[]) {
  const orgId = session.organizationId as string;
  const own = and(eq(schema.focusItem.orgId, orgId), eq(schema.focusItem.userId, session.userId));
  const item = schema.focusItem;
  if (rows.length > 0) {
    await tx
      .insert(item)
      .values(
        rows.map((row) => ({
          orgId,
          userId: session.userId,
          level: row.level,
          kind: row.kind,
          title: row.title,
          sentence: row.sentence,
          sentenceFacts: row.facts,
          objectType: row.objectType,
          objectId: row.objectId,
          relationshipId: row.relationshipId,
          sourceType: row.sourceType,
          sourceId: row.sourceId,
          score: row.score,
          dueAt: row.dueDate ? new Date(`${row.dueDate}T00:00:00Z`) : null,
          href: row.href,
        })),
      )
      .onConflictDoUpdate({
        target: [item.orgId, item.userId, item.sourceType, item.sourceId],
        set: {
          level: sql`excluded.level`,
          kind: sql`excluded.kind`,
          title: sql`excluded.title`,
          sentence: sql`excluded.sentence`,
          sentenceFacts: sql`excluded.sentence_facts`,
          objectType: sql`excluded.object_type`,
          objectId: sql`excluded.object_id`,
          relationshipId: sql`excluded.relationship_id`,
          score: sql`excluded.score`,
          dueAt: sql`excluded.due_at`,
          href: sql`excluded.href`,
          // Ein erledigtes Ergebnis, das wiederkommt (z. B. wieder geöffnet), ist wieder offen.
          state: sql`case when ${item.state} = 'decided' then 'open' else ${item.state} end`,
        },
      });
  }
  // Das Modul meldet das Ergebnis nicht mehr: erledigt, entschieden oder nicht mehr sichtbar.
  await tx
    .update(item)
    .set({ state: 'decided', snoozedUntil: null })
    .where(
      and(
        own,
        inArray(item.level, ['focus', 'review']),
        inArray(item.state, ['open', 'snoozed']),
        sql`(${item.sourceType} || ':' || ${item.sourceId}::text) <> all(${textArray(rows.map(keyOf))})`,
      ),
    );
  // „Später“ ist vorbei.
  await tx
    .update(item)
    .set({ state: 'open', snoozedUntil: null })
    .where(and(own, eq(item.state, 'snoozed'), sql`${item.snoozedUntil} <= app_now()`));
}
