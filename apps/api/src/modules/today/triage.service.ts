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
  type AllAssign,
  type AllHint,
  type AllTopic,
  type AllWaiting,
  artOf,
  backedSentence,
  type DueItem,
  daysBetween,
  dueMinutes,
  type FocusTopic,
  type FocusTopicKind,
  type FocusTopicLevel,
  focusTopicSchema,
  type Hint,
  impactOf,
  maxVisibleFocus,
  type NextAction,
  nextActionSchema,
  relationshipOfHref,
  type SentenceFact,
  sentenceFactSchema,
  type TodayAll,
  type TodayDraft,
  type TodayPage,
  todayAllSchema,
  todayPageSchema,
  triageScore,
  urgencyOf,
} from '@reziproq/shared';
import { z } from 'zod';
import { TenantDatabase } from '../../common/database.module.js';
import { workerLevelFor } from '../agents/worker-levels.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { can } from '../auth/can.js';
import { CalendarIntakeService } from '../calendar/calendar.service.js';
import { HintsService } from '../hints/hints.service.js';
import {
  preparedHref,
  spendWeights,
  visibleRelationships,
  waitingOnOthers,
} from '../start/my-day-data.js';
import { StartService } from '../start/start.service.js';
import { berlinDate, berlinTime, nextMorning } from './berlin.js';
import {
  summarySentence,
  summarySources,
  summaryTemplate,
  uuidIn,
  weekAndWaiting,
} from './today-page.js';
import {
  type DraftRow,
  fromDraft,
  fromDue,
  fromHint,
  fromInbound,
  fromRun,
  type InboundRow,
  keyOf,
  type Locale,
  type RunRow,
  shownSentence,
  type TriageCandidate,
} from './triage.js';

// HE-01 Dienst 1 (K1-c): Triage je Person. Sammelt die Ergebnisse aller Module (Fristen und
// Freigaben aus Start, Hinweise, Entwürfe, Handlungen von Reziproq), rechnet die Punktzahl und hält
// genau ein Fokus-Thema je Ergebnis in focus_item. Läuft bei jedem Aufruf von Heute und „Als
// Nächstes“ (so ist jedes Ereignis sofort drin) und täglich um 06:00 (TriageWorker).
// K1-e: Heute rechnet mit dem Datum in Berlin nach der Uhr des Mandanten; dazu die Seite Heute mit
// den Ansichten Fokus und Alles.

const isoToday = () => berlinDate(currentTime());
/** „Seit gestern 18:00“ in Berlin: Beginn von „Erledigt im Hintergrund“ (Vorlage Erledigt) */
const doneSince = (today: string) => {
  const yesterday = new Date(`${today}T12:00:00Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  return berlinTime(yesterday.toISOString().slice(0, 10), 18);
};
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
  state: string;
  created_at: Date | string;
}

const textArray = (values: string[]) => sql`${`{${values.join(',')}}`}::text[]`;
const uuidArray = (values: string[]) => sql`${`{${values.join(',')}}`}::uuid[]`;

@Injectable()
export class TriageService {
  constructor(
    @Inject(TenantDatabase) private readonly tenant: TenantDatabase,
    @Inject(StartService) private readonly start: StartService,
    @Inject(HintsService) private readonly hints: HintsService,
    @Inject(CalendarIntakeService) private readonly intake: CalendarIntakeService,
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
    return (await this.collect(auth, due)).candidates;
  }

  /**
   * Wie `refresh`, dazu alle offenen Hinweise, die die Person sieht. Ein Hinweis wird nur dann ihr
   * Fokus-Thema, wenn sie darüber entscheidet (SRO der Beziehung oder Admin, K1-e); die übrigen
   * stehen in der Ansicht Alles unter „Hinweise“.
   */
  private async collect(
    auth: AuthContext,
    due?: DueItem[],
  ): Promise<{ candidates: Map<string, ScoredCandidate>; hints: Hint[] }> {
    const session = this.session(auth);
    const organization = auth.organization;
    if (!session || !organization) return { candidates: new Map(), hints: [] };
    const today = isoToday();
    const dueItems = due ?? (await this.start.dueItems(auth));
    const hints =
      organization.buyer && can(auth, 'hinweise.sehen') ? await this.hints.openFor(auth) : [];
    const scored = await this.tenant.run(session, async (tx) => {
      const locale = await localeOf(tx, auth.userId);
      // MA-01 (K1-f): Stufe der Aufgabe Postfach für diese Person
      const inboxLevel = await workerLevelFor(
        tx,
        { orgId: organization.id, userId: auth.userId },
        'inbox',
      );
      const candidates = unique([
        ...dueItems.map((item) => fromDue(item, today, locale)),
        ...hints.filter((hint) => hint.canDismiss).map((hint) => fromHint(hint, today, locale)),
        ...(await draftsOf(tx, auth)).map((draft) => fromDraft(draft, locale)),
        ...(await runsOf(tx, auth, today)).map((run) => fromRun(run, locale)),
        ...(organization.buyer && can(auth, 'termine.sehen') ? await inboundOf(tx, auth) : []).map(
          (item) => fromInbound(item, locale, inboxLevel),
        ),
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
    return { candidates: new Map(scored.map((row) => [keyOf(row), row])), hints };
  }

  /**
   * Heute (HE-01), Ansicht Fokus: „Als Nächstes“, höchstens zwei weitere Fokus-Themen, „Das
   * Wichtigste“, Kurz prüfen, Erledigt, „Diese Woche“, „Wartet auf andere“ und die Zahlen für „Alles
   * anzeigen“. Die Seitenleiste liest daraus die Zahl an Heute und „Im Hintergrund“.
   */
  async today(auth: AuthContext): Promise<TodayPage> {
    const today = isoToday();
    const session = this.session(auth);
    if (!session || !auth.organization) return todayPageSchema.parse(emptyPage(today));
    const { candidates, hints } = await this.collect(auth);
    return this.tenant.run(
      session,
      async (tx) => {
        const view = await this.load(tx, auth, session, candidates, today);
        const open = view.topics.filter((topic) => !topic.snoozed);
        const shown = open.slice(0, maxVisibleFocus).map(plainTopic);
        const more = shown.slice(1);
        const summary = summarySentence(view.locale, {
          done: view.done.count,
          more: more.length,
          hasNext: shown.length > 0,
        });
        const { week, waiting } = weekAndWaiting(today, view.topics, view.waiting);
        return todayPageSchema.parse({
          today,
          next: shown[0] ?? null,
          more,
          openFocus: open.length,
          review: { count: view.drafts.length, minutes: Math.ceil(view.reviewSeconds / 60) },
          done: view.done,
          background: view.background,
          summary: {
            // G-6: nur ein Satz, dessen Zahlen belegt sind
            sentence: backedSentence(summary.sentence, summary.facts, summaryTemplate(view.locale)),
            facts: summary.facts,
            sources: summarySources(shown, {
              drafts: view.drafts.length,
              done: view.done.count,
            }),
          },
          drafts: view.drafts,
          week,
          waiting,
          waitingTotal: view.waiting.length,
          counts: {
            forYou: view.topics.length,
            others: view.waiting.length,
            hints: hints.filter((hint) => !hint.canDismiss).length,
            commitments: view.commitments.open,
          },
        });
      },
      { readOnly: true },
    );
  }

  /**
   * Heute, Ansicht Alles (HE-01, E-K0-26): jedes offene Fokus-Thema der Person (Für dich), die
   * Entwürfe, was bei anderen liegt, die übrigen Hinweise, nicht zugeordneter Eingang und die Zusagen
   * und Aufgaben der Beziehungen. Keine Regel der Triage blendet hier etwas aus; die Filter wählt
   * die Person.
   */
  async all(auth: AuthContext): Promise<TodayAll> {
    const today = isoToday();
    const session = this.session(auth);
    const organization = auth.organization;
    if (!session || !organization) return todayAllSchema.parse(emptyAll(today));
    const { candidates, hints } = await this.collect(auth);
    const inbox =
      organization.buyer && can(auth, 'termine.sehen') ? (await this.intake.inbox(auth)).open : [];
    return this.tenant.run(
      session,
      async (tx) => {
        const view = await this.load(tx, auth, session, candidates, today);
        const others: AllHint[] = hints
          .filter((hint) => !hint.canDismiss)
          .map((hint) => ({
            id: hint.id,
            title: hint.title,
            ruleKey: hint.ruleKey,
            supplier: hint.supplier,
            relationshipId: hint.relationshipId,
            severity: hint.severity,
            materialGroup: hint.materialGroup,
            openSince: hint.createdAt,
            suggestedAction: hint.suggestedAction,
            // Warum zum Hinweis (K1-e.4): Beleg, Begründung, Regel und die Entscheidung
            href: `/warum/${hint.id}`,
          }));
        const assign: AllAssign[] = inbox.map((item) => {
          const review = view.reviewBySource.get(`inbound:${item.id}`);
          // Stufe Vorschlagen (MA-01, K1-f): Kurz prüfen öffnet genau diesen Eintrag
          const suggestion = view.suggestBySource.get(`inbound:${item.id}`);
          const entry = review ?? suggestion;
          return {
            id: item.id,
            kind: item.kind,
            subject: item.subject,
            startsAt: item.startsAt,
            suggestionKind: item.suggestionKind,
            suggestions: item.suggestions,
            // Zuordnen ist ein Entwurf in Kurz prüfen (K1-e.2)
            href: entry ? `/kurz-pruefen?entwurf=${entry}` : '/kurz-pruefen',
            inReview: Boolean(review),
          };
        });
        const names = new Map<string, string>();
        const groups = new Set<string>();
        const note = (id: string | null, name: string | null, group: string | null) => {
          if (id && name) names.set(id, name);
          if (group) groups.add(group);
        };
        for (const topic of view.topics)
          note(topic.relationshipId, topic.counterpart, topic.materialGroup);
        for (const item of view.waiting)
          note(item.relationshipId, item.counterpart, item.materialGroup);
        for (const hint of others) note(hint.relationshipId, hint.supplier, hint.materialGroup);
        return todayAllSchema.parse({
          today,
          forYou: view.topics,
          drafts: { rows: view.drafts, minutes: Math.ceil(view.reviewSeconds / 60) },
          others: view.waiting,
          hints: others,
          assign,
          commitments: view.commitments,
          doneCount: view.done.count,
          relationships: [...names]
            .map(([id, name]) => ({ id, name }))
            .sort((a, b) => a.name.localeCompare(b.name)),
          materialGroups: [...groups].sort((a, b) => a.localeCompare(b)),
        });
      },
      { readOnly: true },
    );
  }

  /**
   * Ein Fokus-Thema der Person für Warum und Mappe (K1-e.4): nach der Triage, mit Zustand, Zeitpunkt
   * und Platz unter den offenen Fokus-Themen. null, wenn es nicht ihres ist.
   */
  async topicFor(auth: AuthContext, id: string) {
    const session = this.session(auth);
    if (!session) return null;
    const { candidates } = await this.collect(auth);
    return this.tenant.run(
      session,
      async (tx) => {
        const own = sql`org_id = ${session.organizationId} and user_id = ${session.userId}`;
        const [row] = (
          await tx.execute<TopicRow>(sql`select * from focus_item where ${own} and id = ${id}`)
        ).rows;
        if (!row) return null;
        const locale = await localeOf(tx, auth.userId);
        const groups = row.relationship_id
          ? await primaryGroups(tx, [row.relationship_id])
          : new Map<string, string>();
        const order = await tx.execute<{ id: string }>(sql`
          select id from focus_item where ${own} and level = 'focus' and state = 'open'
          order by score desc, due_at asc nulls last, created_at, id`);
        const position = order.rows.findIndex((entry) => entry.id === row.id);
        return {
          topic: topicOf(row, candidates, locale, groups),
          state: row.state as 'open' | 'decided' | 'snoozed' | 'dismissed',
          createdAt: new Date(row.created_at),
          rank: position >= 0 ? position + 1 : null,
          sourceType: row.source_type,
          sourceId: row.source_id,
        };
      },
      { readOnly: true },
    );
  }

  /** Gemeinsame Daten beider Ansichten, gelesen in einer Transaktion nach der Triage */
  private async load(
    tx: TenantTransaction,
    auth: AuthContext,
    session: TenantSession,
    candidates: Map<string, ScoredCandidate>,
    today: string,
  ) {
    const organization = auth.organization;
    const orgId = session.organizationId as string;
    const locale = await localeOf(tx, auth.userId);
    const viewer = { orgId, userId: auth.userId, admin: auth.orgRole === 'admin' };
    const relationships = organization?.buyer
      ? await visibleRelationships(tx, viewer)
      : new Map<string, string>();
    const groups = await primaryGroups(tx, [...relationships.keys()]);
    const own = sql`org_id = ${orgId} and user_id = ${session.userId}`;

    // Für dich: offene Fokus-Themen nach Punktzahl, zurückgestellte am Ende
    const topicRows = await tx.execute<TopicRow>(sql`
      select * from focus_item where ${own} and level = 'focus' and state in ('open', 'snoozed')
        and source_type <> 'inbound'
      order by (state = 'snoozed'), score desc, due_at asc nulls last, created_at, id`);
    // Vorschläge zum Zuordnen (Stufe Vorschlagen, MA-01) stehen nur in Alles unter „Zuordnen“
    const suggestRows = await tx.execute<{ id: string; source_id: string }>(sql`
      select id, source_id from focus_item
      where ${own} and level = 'focus' and state = 'open' and source_type = 'inbound'`);
    const suggestBySource = new Map(
      suggestRows.rows.map((row) => [`inbound:${row.source_id}`, row.id] as const),
    );
    const topics: AllTopic[] = topicRows.rows.map((row, index) => ({
      ...topicOf(row, candidates, locale, groups),
      rank: index + 1,
      snoozed: row.state === 'snoozed',
    }));

    // Kurz prüfen: offene Entwürfe in der Reihenfolge der Entwürfe
    const draftRows = await tx.execute<TopicRow & { draft_created_at: Date | string | null }>(sql`
      select f.*, d.created_at as draft_created_at
      from focus_item f
      left join ai_draft d on f.source_type = 'ai_draft' and d.id = f.source_id
      where f.org_id = ${orgId} and f.user_id = ${session.userId}
        and f.level = 'review' and f.state = 'open'
      order by d.review_order nulls last, coalesce(d.created_at, f.created_at), f.id`);
    let reviewSeconds = 0;
    const reviewBySource = new Map<string, string>();
    const drafts: TodayDraft[] = draftRows.rows.map((row) => {
      const candidate = candidates.get(keyOf(sourceOf(row)));
      reviewSeconds += candidate?.reviewSeconds ?? defaultReviewSeconds;
      reviewBySource.set(`${row.source_type}:${row.source_id}`, row.id);
      return {
        id: row.id,
        title: row.title,
        counterpart: candidate?.counterpart ?? null,
        relationshipId: row.relationship_id,
        createdAt: new Date(row.draft_created_at ?? row.created_at).toISOString(),
        // Kurz prüfen beginnt bei diesem Entwurf (K1-e.2)
        href: `/kurz-pruefen?entwurf=${row.id}`,
      };
    });

    // Erledigt im Hintergrund seit gestern 18:00, je Aufgabe von Reziproq
    const since = doneSince(today);
    // Seit K1-e.3 aus den Läufen: alles, was Reziproq für die Person getan hat, ohne Zurückgenommenes
    const doneRows = await tx.execute<{ title: string; count: number }>(sql`
      select a.name as title, count(*)::int as count
      from agent_run r
      join agent_version v on v.org_id = r.org_id and v.id = r.agent_version_id
      join agent a on a.org_id = v.org_id and a.id = v.agent_id
      where r.org_id = ${orgId} and r.acting_user_id = ${session.userId} and not r.is_test
        and r.status in ('done', 'failed') and r.undone_at is null
        and coalesce(r.finished_at, r.created_at) >= ${since.toISOString()}::timestamptz
      group by a.name order by count desc, a.name`);
    const done = {
      since: since.toISOString(),
      count: doneRows.rows.reduce((sum, row) => sum + row.count, 0),
      tasks: doneRows.rows.map((row) => ({ task: row.title, count: row.count })),
    };

    // Bei anderen: offene Zusagen, Maßnahmen und Beiträge anderer Personen, ohne Zeitgrenze
    const focusObjects = new Set(topics.flatMap((topic) => topic.objectId ?? []));
    const waiting: AllWaiting[] = (
      organization?.buyer ? await waitingOnOthers(tx, viewer, relationships, '9999-12-31') : []
    ).flatMap((item) => {
      const relationshipId = relationshipOfHref(item.href);
      if (!relationshipId) return [];
      const objectId = uuidIn(item.id);
      return [
        {
          ...item,
          relationshipId,
          materialGroup: groups.get(relationshipId) ?? null,
          inFocus: objectId !== null && focusObjects.has(objectId),
        },
      ];
    });

    // Zusagen und Aufgaben beider Seiten, je Beziehung in der Akte
    const commitments = await openCommitments(tx, relationships);

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
        where r.org_id = ${orgId} and r.acting_user_id = ${session.userId}
          and r.status in ('queued', 'running') and not r.is_test
        order by r.created_at desc
        limit 1`)
    ).rows;
    return {
      locale,
      topics,
      drafts,
      reviewBySource,
      suggestBySource,
      reviewSeconds,
      done,
      waiting,
      commitments,
      background: running
        ? { runId: running.id, task: running.task, counterpart: running.counterpart }
        : null,
    };
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
  groups: Map<string, string> = new Map(),
): FocusTopic {
  const facts: SentenceFact[] = factsSchema.parse(row.sentence_facts);
  const candidate = candidates.get(keyOf(sourceOf(row)));
  // Nur Fristen und Freigaben der Module; der Hinweis hat seine Ersatzfrist nur für „Als Nächstes“.
  const item = candidate?.sourceType === 'due' ? candidate.dueItem : null;
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
    counterpart: candidate?.counterpart ?? null,
    dueDate: row.due_at ? new Date(row.due_at).toISOString().slice(0, 10) : null,
    href: row.href,
    score: Number(row.score),
    item,
    art: artOf({ kind: row.kind, objectType: row.object_type, item }),
    severity: candidate?.severity ?? null,
    materialGroup: row.relationship_id ? (groups.get(row.relationship_id) ?? null) : null,
  });
}

/** Fokus-Thema ohne Platz und Zustand der Ansicht Alles */
function plainTopic(topic: AllTopic): FocusTopic {
  const { rank: _rank, snoozed: _snoozed, ...rest } = topic;
  return rest;
}

/** Leere Seite für Personen ohne Organisation */
function emptyPage(today: string) {
  return {
    today,
    next: null,
    more: [],
    openFocus: 0,
    review: { count: 0, minutes: 0 },
    done: { since: doneSince(today).toISOString(), count: 0, tasks: [] },
    background: null,
    summary: {
      sentence: summarySentence('de', { done: 0, more: 0, hasNext: false }).sentence,
      facts: [],
      sources: [],
    },
    drafts: [],
    week: [],
    waiting: [],
    waitingTotal: 0,
    counts: { forYou: 0, others: 0, hints: 0, commitments: 0 },
  };
}

function emptyAll(today: string) {
  return {
    today,
    forYou: [],
    drafts: { rows: [], minutes: 0 },
    others: [],
    hints: [],
    assign: [],
    commitments: { open: 0, relationships: 0, next: null },
    doneCount: 0,
    relationships: [],
    materialGroups: [],
  };
}

/** Hauptwarengruppe je Beziehung (Filter „Warengruppe“) */
async function primaryGroups(
  tx: TenantTransaction,
  relationshipIds: string[],
): Promise<Map<string, string>> {
  if (relationshipIds.length === 0) return new Map();
  const rows = await tx.execute<{ relationship_id: string; name: string }>(sql`
    select l.relationship_id, g.name
    from relationship_material_group l
    join material_group g on g.id = l.material_group_id
    where l.relationship_id = any(${uuidArray(relationshipIds)}) and l.is_primary`);
  return new Map(rows.rows.map((row) => [row.relationship_id, row.name]));
}

/**
 * Zusagen und Aufgaben (E-K0-26): offene Zusagen beider Seiten und offene Maßnahmen in den
 * Beziehungen der Person; die nächste Frist mit Titel und Gegenüber.
 */
async function openCommitments(
  tx: TenantTransaction,
  relationships: Map<string, string>,
): Promise<TodayAll['commitments']> {
  const ids = [...relationships.keys()];
  if (ids.length === 0) return { open: 0, relationships: 0, next: null };
  const rows = await tx.execute<{ relationship_id: string; title: string; due: string }>(sql`
    select relationship_id, title, due_on::text as due from commitment
    where relationship_id = any(${uuidArray(ids)}) and status = 'open'
    union all
    -- ZQ-01 (K2-a.3): früher Maßnahmen, jetzt Aufgaben
    select relationship_id, title, due_date::text from task
    where relationship_id = any(${uuidArray(ids)}) and status in ('open', 'in_progress')
    order by due, title`);
  const [first] = rows.rows;
  return {
    open: rows.rows.length,
    relationships: new Set(rows.rows.map((row) => row.relationship_id)).size,
    next: first
      ? {
          title: first.title,
          counterpart: relationships.get(first.relationship_id) ?? '',
          dueDate: first.due,
        }
      : null,
  };
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
    run_id: string | null;
  }>(sql`
    select d.id, d.kind, d.object_type, d.object_id, d.relationship_id, d.subject, d.content,
      d.claims, d.review_seconds, d.run_id
    from ai_draft d
    where d.org_id = ${organization.id} and d.created_by = ${auth.userId} and d.status = 'draft'
      -- MA-01 (K1-f.2): Ein bindendes Werkzeug ohne Token kann auch ohne Beziehung wirken
      -- (z. B. Wertbericht senden); es gehört der Person, für die der Lauf handelte.
      and (d.relationship_id is not null or d.kind = 'binding_request')
      and (d.kind in ('share_request', 'binding_request') or d.claims is not null)
      -- Die Begründung eines Hinweises gehört zum Hinweis (Warum), nicht in Kurz prüfen (K1-e.2).
      -- Ergebnisse eigener Agenten: KI-09 ist aus (E-K0-13, K1-f.5).
      and d.kind not in ('hint_explanation', 'agent_result')
      and (${admin} or d.kind = 'binding_request' or exists (
        select 1 from relationship_member m
        where m.relationship_id = d.relationship_id and m.org_id = d.org_id
          and m.user_id = ${auth.userId} and (d.kind = 'share_request' or m.team_role = 'sro')))
    order by d.review_order nulls last, d.created_at`);
  const names = organization.buyer
    ? await visibleRelationships(tx, { orgId: organization.id, userId: auth.userId, admin })
    : new Map<string, string>();
  return rows.rows.map((row) => {
    const relationshipId = row.relationship_id;
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
      counterpart: relationshipId ? (names.get(relationshipId) ?? null) : null,
      href: !organization.buyer
        ? null
        : row.kind === 'binding_request'
          ? // Warum zum Lauf: was er tun wollte und wo er an der Leitplanke endete (K1-f.2)
            row.run_id
            ? `/warum/${row.run_id}`
            : relationshipId
              ? preparedHref(row.kind, row.object_id, relationshipId)
              : null
          : !relationshipId
            ? null
            : meetingPage
              ? `/lieferanten/${relationshipId}/umsetzung/termine/${row.object_id}`
              : preparedHref(row.kind, row.object_id, relationshipId),
    };
  });
}

/**
 * Eingänge, die die Person zuordnen soll (IN-03): wie Neu eingegangen eigene, als SRO zugewiesene,
 * beim Admin auch Eingänge ohne Person. Genau eine vorgeschlagene Beziehung hängt an.
 */
async function inboundOf(tx: TenantTransaction, auth: AuthContext): Promise<InboundRow[]> {
  const organization = auth.organization;
  if (!organization) return [];
  const admin = auth.orgRole === 'admin';
  const rows = await tx.execute<{
    id: string;
    kind: 'meeting' | 'mail';
    subject: string;
    suggestion_kind: string;
    suggested: string[] | null;
  }>(sql`
    select i.id, i.kind, i.subject, i.suggestion_kind, i.suggested_relationship_ids as suggested
    from inbound_item i
    where i.org_id = ${organization.id} and i.status = 'needs_review'
      and (i.assignee_user_id = ${auth.userId} or i.owner_user_id = ${auth.userId}
        or (${admin} and i.assignee_user_id is null))
    order by i.received_at desc
    limit 100`);
  const names = await visibleRelationships(tx, {
    orgId: organization.id,
    userId: auth.userId,
    admin,
  });
  return rows.rows.map((row) => {
    const single =
      row.suggestion_kind === 'supplier' && row.suggested?.length === 1 ? row.suggested[0] : null;
    return {
      id: row.id,
      kind: row.kind,
      subject: row.subject,
      relationshipId: single ?? null,
      counterpart: single ? (names.get(single) ?? null) : null,
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
