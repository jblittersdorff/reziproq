import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  and,
  auditedChange,
  auditedObject,
  currentTime,
  desc,
  eq,
  inArray,
  schema,
  sql,
  type TenantSession,
  type TenantTransaction,
} from '@reziproq/db';
import {
  type AnyHintRuleKey,
  type DismissHint,
  earlyWarningRuleKeys,
  type Hint,
  type HintEvidence,
  type HintList,
  type HintRuleSettings,
  type HintSettings,
  hintDetailSchema,
  hintEvidenceSchema,
  hintListSchema,
  hintSchema,
  numbersIn,
} from '@reziproq/shared';
import { generateText } from 'ai';
import { TenantDatabase } from '../../common/database.module.js';
import { NotificationBus } from '../../common/notification-bus.js';
import { env } from '../../config/env.js';
import { createBuyerDraft, ownDraftSource } from '../ai-drafts/evidence.js';
import { estimateTokens, ModelGateway } from '../ai-gateway/model-gateway.js';
import { actorOf } from '../audit/actor.js';
import { taskAudit } from '../audit/audited-objects.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { can } from '../auth/can.js';
import { PortfolioService } from '../portfolio/portfolio.service.js';
import {
  evaluateEarlyWarning,
  fakePublicEvents,
  fs01Severity,
  type PublicEvent,
  scoreOf,
  thresholdsOf,
} from './early-warning-rules.js';
import { evaluateRules, type HintFinding, maxFocusPerSroOf } from './hint-rules.js';

const forbidden = () => new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });
const notFound = () => new NotFoundException({ statusCode: 404, code: 'nicht_gefunden' });

/** Verlauf der Hinweise: nur die eigene Seite, mit Begründung beim Verwerfen. */
export const hintAudit = auditedObject({
  type: 'hint',
  visibility: 'internal',
  fields: ['status', 'reason'],
});

type HintRow = typeof schema.hint.$inferSelect;

/** Wohin „Beheben“ führt */
export function fixPath(ruleKey: AnyHintRuleKey, relationshipId: string | null, subject?: string) {
  const base = relationshipId ? `/lieferanten/${relationshipId}` : '';
  switch (ruleKey) {
    // KI-16: der nächste Schritt öffnet das passende Formular
    case 'performance_drop':
      return `${base}/umsetzung/massnahmen/neu`;
    case 'supplier_commitment_overdue':
      return `${base}/plan/zusagen`;
    case 'dependency':
      return subject ? `/warengruppen/${subject}` : '/warengruppen';
    case 'feedback_drop':
      return `${base}/beziehung/feedback`;
    case 'public_event':
      return base || '/beziehungen';
    case 'segment_spend_only':
    case 'unexplained_deviation':
      return `${base}/strategie/segmentierung`;
    case 'weak_focus':
      return '/portfolio/fokus';
    case 'too_many_focus':
      return subject ? `/portfolio/zyklen?sro=${encodeURIComponent(subject)}` : '/portfolio/zyklen';
    case 'no_operational_function':
      return `${base}/beziehung/team`;
    case 'cadence_missed':
      return `${base}/umsetzung/termine/neu`;
    case 'no_feedback':
      return `${base}/beziehung/feedback`;
    case 'plan_missing':
      return `${base}/strategie/lieferantenplan`;
    case 'right_without_obligation':
      return `${base}/beziehung/spielregeln`;
    case 'buyer_commitments_overdue':
      return `${base}/plan/zusagen`;
  }
}

/** Titel der internen Maßnahme beim Annehmen */
const actionTitles: Partial<Record<AnyHintRuleKey, string>> = {
  segment_spend_only: 'Segment mit weiteren Kriterien bewerten',
  weak_focus: 'Fokus begründen',
  unexplained_deviation: 'Abweichung in der Bewertung klären',
  too_many_focus: 'Fokuslieferanten verteilen',
  no_operational_function: 'Operative Funktion ins Team holen',
  cadence_missed: 'Termin im vereinbarten Takt planen',
  no_feedback: 'Feedback einholen',
  plan_missing: 'Lieferantenplan freigeben',
  right_without_obligation: 'Pflichten zu den Rechten ergänzen',
  buyer_commitments_overdue: 'Überfällige Zusagen erfüllen',
};

const withSubject = new Set<string>([
  'too_many_focus',
  'cadence_missed',
  'performance_drop',
  'dependency',
  'feedback_drop',
  'public_event',
]);
const subjectOf = (row: Pick<HintRow, 'ruleKey' | 'fingerprint'>) =>
  withSubject.has(row.ruleKey) && row.fingerprint.includes('#')
    ? row.fingerprint.split('#')[0]
    : undefined;
const storedFingerprint = (finding: Pick<HintFinding, 'subject' | 'fingerprint'>) =>
  finding.subject ? `${finding.subject}#${finding.fingerprint}` : finding.fingerprint;
const identity = (ruleKey: string, relationshipId: string | null, subject?: string) =>
  `${ruleKey}|${relationshipId ?? ''}|${subject ?? ''}`;

/**
 * FS-01: Hinweise. Die Regeln laufen täglich und beim Öffnen der Liste in der Mandanten-Session
 * des Käufers; jede Lage wird zu höchstens einem offenen Hinweis. Annehmen erzeugt eine interne
 * Maßnahme mit privater Quelle (kein Fremdschlüssel von geteilt auf privat), Verwerfen verlangt
 * eine Begründung. Der Lieferant sieht nie Hinweise.
 */
@Injectable()
export class HintsService {
  constructor(
    @Inject(TenantDatabase) private readonly tenant: TenantDatabase,
    @Inject(PortfolioService) private readonly portfolio: PortfolioService,
    @Inject(ModelGateway) private readonly gateway: ModelGateway,
    @Inject(NotificationBus) private readonly bus: NotificationBus,
  ) {}

  private buyer(auth: AuthContext) {
    const organization = auth.organization;
    if (!organization?.buyer) throw forbidden();
    return {
      orgId: organization.id,
      session: { userId: auth.userId, organizationId: organization.id } as TenantSession,
    };
  }

  async maxFocusPerSro(tx: TenantTransaction, orgId: string) {
    const [row] = await tx
      .select({ value: schema.orgSetting.value })
      .from(schema.orgSetting)
      .where(
        and(
          eq(schema.orgSetting.orgId, orgId),
          eq(schema.orgSetting.key, 'hint_max_focus_per_sro'),
        ),
      );
    return maxFocusPerSroOf(row?.value);
  }

  /** KI-16: Regeln an oder aus und Schwellen der Organisation */
  async ruleSettings(tx: TenantTransaction, orgId: string) {
    const rows = await tx
      .select({ key: schema.orgSetting.key, value: schema.orgSetting.value })
      .from(schema.orgSetting)
      .where(
        and(
          eq(schema.orgSetting.orgId, orgId),
          inArray(schema.orgSetting.key, ['hint_rules', 'hint_thresholds', 'ai_public_research']),
        ),
      );
    const value = (key: string) => rows.find((row) => row.key === key)?.value;
    const rules = (value('hint_rules') ?? {}) as Record<string, boolean>;
    return {
      enabled: rules,
      thresholds: thresholdsOf(value('hint_thresholds')),
      research: value('ai_public_research') === true,
    };
  }

  /**
   * Meldungen der öffentlichen Recherche (KI-16). Wie die Marktsignale in KI-11 gibt es in diesem
   * Release nur den lokalen Testanbieter; in der Produktion bleibt die Quelle leer. Tests ersetzen sie.
   */
  publicEventSource: (
    relationships: { id: string; name: string }[],
    today: string,
  ) => PublicEvent[] = (relationships, today) =>
    env.NODE_ENV === 'production' ? [] : fakePublicEvents(relationships, today);

  /**
   * Regeln prüfen und die Hinweise der Organisation auf den Stand bringen (FS-01, KI-16). Gleiche
   * Lage frischt Beleg und last_seen_at auf; neue oder schlimmere Lage bringt einen offenen Hinweis,
   * auch nach Verwerfen; ist die Bedingung nicht mehr erfüllt, wird der Hinweis resolved.
   */
  async refresh(tx: TenantTransaction, orgId: string, today = isoToday()) {
    const settings = await this.ruleSettings(tx, orgId);
    const fs01 = (
      await evaluateRules({
        tx,
        orgId,
        today,
        maxFocusPerSro: await this.maxFocusPerSro(tx, orgId),
        deviations: await this.portfolio.deviationsIn(tx, orgId),
      })
    ).filter((finding) => settings.enabled[finding.ruleKey] !== false);

    // Beziehungen mit Fokus, Spendanteil und Business Impact für Schwere und score
    const relationships = await tx.execute<{
      id: string;
      name: string;
      is_focus: boolean | null;
      share: string | null;
      impact: number | null;
    }>(sql`
      with spend as (
        select s.relationship_id, sum(s.amount_cents) as amount from relationship_spend s
        join relationship r on r.id = s.relationship_id and r.buyer_org_id = ${orgId}
        where s.kind = 'actual' and s.year = (
          select max(s2.year) from relationship_spend s2 join relationship r2 on r2.id = s2.relationship_id
          where r2.buyer_org_id = ${orgId} and s2.kind = 'actual' and s2.year <= extract(year from ${today}::date))
        group by s.relationship_id
      )
      select r.id, coalesce(side.display_name, o.name) as name, side.is_focus,
        (sp.amount::numeric / nullif(sum(sp.amount) over (), 0))::text as share,
        (select d.ist_impact_level from segment_decision d where d.relationship_id = r.id and d.scope = 'total'
          order by d.version desc limit 1) as impact
      from relationship r join organization o on o.id = r.supplier_org_id
      left join relationship_side side on side.relationship_id = r.id and side.org_id = ${orgId}
      left join spend sp on sp.relationship_id = r.id
      where r.buyer_org_id = ${orgId} and r.status = 'active'`);
    const info = new Map(relationships.rows.map((row) => [row.id, row]));
    const focus = new Set(relationships.rows.filter((row) => row.is_focus).map((row) => row.id));
    const early = await evaluateEarlyWarning({
      tx,
      orgId,
      today,
      enabled: settings.enabled,
      thresholds: settings.thresholds,
      focus,
      relationshipIds: [...info.keys()],
      // Ohne öffentliche Recherche gibt es keine Meldungen und keine Anfragen nach außen.
      publicEvents:
        settings.research && settings.enabled.public_event !== false
          ? this.publicEventSource(
              relationships.rows.map((row) => ({ id: row.id, name: row.name })),
              today,
            )
          : [],
    });

    const findings = [
      ...fs01.map((finding) => ({
        ...finding,
        severity: fs01Severity[finding.ruleKey]?.severity ?? ('low' as const),
        title: null as string | null,
        evidence: {},
        suggestedAction: fs01Severity[finding.ruleKey]?.action ?? 'Annehmen',
      })),
      ...early,
    ];
    const existing = await tx.select().from(schema.hint).where(eq(schema.hint.orgId, orgId));
    const now = currentTime();
    const active = (row: HintRow) => row.status === 'open' || row.status === 'in_progress';
    const seen = new Set<string>();
    const highHints: {
      id: string;
      relationshipId: string;
      title: string;
      supplier: string | null;
    }[] = [];
    for (const finding of findings) {
      const key = identity(finding.ruleKey, finding.relationshipId, finding.subject);
      seen.add(key);
      const fingerprint = storedFingerprint(finding);
      const relation = finding.relationshipId ? info.get(finding.relationshipId) : undefined;
      const values = {
        detail: finding.detail,
        severity: finding.severity,
        score: scoreOf({
          severity: finding.severity,
          spendShare: Number(relation?.share ?? 0),
          impactLevel: relation?.impact ?? null,
          focus: Boolean(relation?.is_focus),
        }),
        title: finding.title,
        evidence: finding.evidence,
        suggestedAction: finding.suggestedAction,
        lastSeenAt: now,
      };
      const same = existing.filter(
        (row) => identity(row.ruleKey, row.relationshipId, subjectOf(row)) === key,
      );
      const exact = same.find((row) => row.fingerprint === fingerprint);
      if (exact) {
        if (active(exact)) {
          await tx.update(schema.hint).set(values).where(eq(schema.hint.id, exact.id));
        } else if (exact.status === 'resolved') {
          // Die Bedingung ist zurück: derselbe Hinweis wird wieder offen.
          await tx
            .update(schema.hint)
            .set({ ...values, status: 'open', resolvedAt: null, resolvedReason: null })
            .where(eq(schema.hint.id, exact.id));
        }
        // Entschieden (angenommen, verworfen) bleibt entschieden, solange die Lage gleich ist.
        continue;
      }
      const open = same.find(active);
      if (open) {
        await tx
          .update(schema.hint)
          .set({ ...values, fingerprint, explanationDraftId: null })
          .where(eq(schema.hint.id, open.id));
        continue;
      }
      // Neue oder geänderte Lage: ein neuer offener Hinweis, auch nach Verwerfen.
      const [created] = await tx
        .insert(schema.hint)
        .values({
          orgId,
          relationshipId: finding.relationshipId,
          ruleKey: finding.ruleKey,
          fingerprint,
          ...values,
          firstSeenAt: now,
        })
        .returning({ id: schema.hint.id });
      // IN-06: Hinweis mit hoher Schwere an den SRO des Lieferanten
      if (created && finding.severity === 'high' && finding.relationshipId) {
        highHints.push({
          id: created.id,
          relationshipId: finding.relationshipId,
          title: finding.title ?? 'Neuer Hinweis mit hoher Schwere',
          supplier: relation?.name ?? null,
        });
      }
    }
    for (const hint of highHints) {
      const sros = await tx
        .select({ userId: schema.relationshipMember.userId })
        .from(schema.relationshipMember)
        .where(
          and(
            eq(schema.relationshipMember.relationshipId, hint.relationshipId),
            eq(schema.relationshipMember.orgId, orgId),
            eq(schema.relationshipMember.teamRole, 'sro'),
          ),
        );
      this.bus.defer({
        orgId,
        userIds: sros.map((row) => row.userId),
        kind: 'hint_high',
        objectType: 'hint',
        objectId: hint.id,
        title: hint.title,
        line: hint.supplier,
        // HE-01 (K1-e.4): Warum zum Hinweis
        href: `/warum/${hint.id}`,
        relationshipId: hint.relationshipId,
      });
    }
    // KI-16: Lage behoben: offene Hinweise werden resolved, nicht gelöscht.
    const gone = existing.filter(
      (row) => active(row) && !seen.has(identity(row.ruleKey, row.relationshipId, subjectOf(row))),
    );
    if (gone.length > 0) {
      await tx
        .update(schema.hint)
        .set({
          status: 'resolved',
          resolvedAt: now,
          resolvedReason: 'Bedingung nicht mehr erfüllt',
        })
        .where(
          inArray(
            schema.hint.id,
            gone.map((row) => row.id),
          ),
        );
    }
  }

  private async view(tx: TenantTransaction, auth: AuthContext, rows: HintRow[]): Promise<Hint[]> {
    const relationshipIds = [
      ...new Set(rows.map((row) => row.relationshipId).filter((id): id is string => Boolean(id))),
    ];
    const names = relationshipIds.length
      ? await tx
          .select({
            id: schema.relationship.id,
            name: sql<string>`coalesce(${schema.relationshipSide.displayName}, ${schema.organization.name})`,
          })
          .from(schema.relationship)
          .innerJoin(
            schema.organization,
            eq(schema.organization.id, schema.relationship.supplierOrgId),
          )
          .leftJoin(
            schema.relationshipSide,
            and(
              eq(schema.relationshipSide.relationshipId, schema.relationship.id),
              eq(schema.relationshipSide.orgId, schema.relationship.buyerOrgId),
            ),
          )
          .where(inArray(schema.relationship.id, relationshipIds))
      : [];
    const sros = relationshipIds.length
      ? await tx
          .select({
            relationshipId: schema.relationshipMember.relationshipId,
            userId: schema.relationshipMember.userId,
          })
          .from(schema.relationshipMember)
          .where(
            and(
              inArray(schema.relationshipMember.relationshipId, relationshipIds),
              eq(schema.relationshipMember.teamRole, 'sro'),
              eq(schema.relationshipMember.orgId, auth.organization?.id ?? ''),
            ),
          )
      : [];
    const deciders = [...new Set(rows.map((row) => row.decidedBy).filter(Boolean))] as string[];
    const people = deciders.length
      ? await tx
          .select({ id: schema.appUser.id, name: schema.appUser.name })
          .from(schema.appUser)
          .where(inArray(schema.appUser.id, deciders))
      : [];
    // ZQ-01 (K2-a.3): Aus einem Hinweis wurde eine Aufgabe (Quelle hint) oder, vor der Migration
    // geteilt, eine Zusage mit privater Quelle; beides sieht nur die eigene Seite
    const hintIds = rows.map((row) => row.id);
    const actions = rows.length
      ? [
          ...(
            await tx
              .select({
                sourceId: schema.task.sourceId,
                actionId: schema.task.id,
                relationshipId: schema.task.relationshipId,
              })
              .from(schema.task)
              .where(
                and(eq(schema.task.sourceType, 'hint'), inArray(schema.task.sourceId, hintIds)),
              )
          ).map((row) => ({ ...row, sourceId: row.sourceId as string })),
          ...(await tx
            .select({
              sourceId: schema.commitmentPrivateSource.sourceId,
              actionId: schema.commitmentPrivateSource.commitmentId,
              relationshipId: schema.commitmentPrivateSource.relationshipId,
            })
            .from(schema.commitmentPrivateSource)
            .where(
              and(
                eq(schema.commitmentPrivateSource.sourceType, 'hint'),
                inArray(schema.commitmentPrivateSource.sourceId, hintIds),
              ),
            )),
        ]
      : [];
    // KI-16: Begründung als Entwurf (KI-03), nur wenn er nicht verworfen ist
    const draftIds = rows
      .map((row) => row.explanationDraftId)
      .filter((id): id is string => Boolean(id));
    const drafts = draftIds.length
      ? await tx
          .select({
            id: schema.aiDraft.id,
            content: schema.aiDraft.content,
            status: schema.aiDraft.status,
          })
          .from(schema.aiDraft)
          .where(inArray(schema.aiDraft.id, draftIds))
      : [];
    const explanations = new Map(
      rows.flatMap((row) => {
        const draft = drafts.find((entry) => entry.id === row.explanationDraftId);
        return draft && draft.status !== 'discarded' ? [[row.id, draft.content] as const] : [];
      }),
    );
    const focusRows = relationshipIds.length
      ? await tx
          .select({ id: schema.relationshipSide.relationshipId })
          .from(schema.relationshipSide)
          .where(
            and(
              inArray(schema.relationshipSide.relationshipId, relationshipIds),
              eq(schema.relationshipSide.orgId, auth.organization?.id ?? ''),
              eq(schema.relationshipSide.isFocus, true),
            ),
          )
      : [];
    const focusIds = new Set(focusRows.map((row) => row.id));
    const ownRows = relationshipIds.length
      ? await tx
          .select({ id: schema.relationshipMember.relationshipId })
          .from(schema.relationshipMember)
          .where(
            and(
              inArray(schema.relationshipMember.relationshipId, relationshipIds),
              eq(schema.relationshipMember.userId, auth.userId),
            ),
          )
      : [];
    const ownIds = new Set(ownRows.map((row) => row.id));
    const groups = relationshipIds.length
      ? await tx
          .select({
            relationshipId: schema.relationshipMaterialGroup.relationshipId,
            name: schema.materialGroup.name,
          })
          .from(schema.relationshipMaterialGroup)
          .innerJoin(
            schema.materialGroup,
            eq(schema.materialGroup.id, schema.relationshipMaterialGroup.materialGroupId),
          )
          .where(
            and(
              inArray(schema.relationshipMaterialGroup.relationshipId, relationshipIds),
              eq(schema.relationshipMaterialGroup.isPrimary, true),
            ),
          )
      : [];
    const decide = can(auth, 'hinweise.entscheiden');
    const admin = auth.orgRole === 'admin';
    return rows.map((row) => {
      const subject = subjectOf(row);
      const isSro = row.relationshipId
        ? sros.some(
            (entry) => entry.relationshipId === row.relationshipId && entry.userId === auth.userId,
          )
        : subject === auth.userId;
      const allowed =
        decide && (row.status === 'open' || row.status === 'in_progress') && (admin || isSro);
      const action = actions.find((entry) => entry.sourceId === row.id);
      return hintSchema.parse({
        id: row.id,
        ruleKey: row.ruleKey,
        relationshipId: row.relationshipId,
        supplier: names.find((entry) => entry.id === row.relationshipId)?.name ?? null,
        detail: hintDetailSchema.parse(row.detail ?? {}),
        status: row.status,
        severity: row.severity,
        score: row.score,
        title: row.title,
        evidence: hintEvidenceSchema.parse(row.evidence ?? {}),
        explanation: explanations.get(row.id) ?? null,
        suggestedAction: row.suggestedAction,
        feedback: row.feedback,
        lastSeenAt: row.lastSeenAt.toISOString(),
        resolvedReason: row.resolvedReason,
        isFocus: focusIds.has(row.relationshipId ?? ''),
        isOwn: row.relationshipId ? ownIds.has(row.relationshipId) : subject === auth.userId,
        materialGroup:
          (typeof (row.detail as { group?: unknown } | null)?.group === 'string'
            ? (row.detail as { group: string }).group
            : null) ??
          groups.find((entry) => entry.relationshipId === row.relationshipId)?.name ??
          null,
        reason: row.reason,
        createdAt: row.createdAt.toISOString(),
        decidedAt: row.decidedAt?.toISOString() ?? null,
        decidedByName: people.find((person) => person.id === row.decidedBy)?.name ?? null,
        // KI-16: „Maßnahme anlegen“ öffnet das Formular mit Titel und Begründung des Hinweises
        href:
          row.ruleKey === 'performance_drop' && row.relationshipId
            ? `${fixPath(row.ruleKey, row.relationshipId, subject)}?hinweis=${row.id}`
            : fixPath(row.ruleKey, row.relationshipId, subject),
        canAccept: allowed && row.relationshipId !== null,
        canDismiss: allowed,
        actionHref: action
          ? `/lieferanten/${action.relationshipId}/umsetzung/massnahmen/${action.actionId}`
          : null,
      });
    });
  }

  /**
   * KI-16: Admin und Lead einer Warengruppe sehen alle Hinweise, ein Commodity Manager die zu
   * Lieferanten seiner Warengruppen, alle anderen nur die ihrer Beziehungen (Team) und die an sie
   * selbst gerichteten ohne Beziehung.
   */
  private async visibleTo(tx: TenantTransaction, auth: AuthContext, rows: HintRow[]) {
    if (auth.orgRole === 'admin') return rows;
    const groups = await tx
      .select({ id: schema.materialGroup.id, leadUserId: schema.materialGroup.leadUserId })
      .from(schema.materialGroup)
      .where(
        sql`${schema.materialGroup.leadUserId} = ${auth.userId}
          or ${schema.materialGroup.commodityManagerUserId} = ${auth.userId}`,
      );
    if (groups.some((group) => group.leadUserId === auth.userId)) return rows;
    const team = await tx
      .select({ id: schema.relationshipMember.relationshipId })
      .from(schema.relationshipMember)
      .where(eq(schema.relationshipMember.userId, auth.userId));
    const viaGroups = groups.length
      ? await tx
          .select({ id: schema.relationshipMaterialGroup.relationshipId })
          .from(schema.relationshipMaterialGroup)
          .where(
            inArray(
              schema.relationshipMaterialGroup.materialGroupId,
              groups.map((group) => group.id),
            ),
          )
      : [];
    const allowed = new Set([...team, ...viaGroups].map((row) => row.id));
    return rows.filter((row) =>
      row.relationshipId ? allowed.has(row.relationshipId) : subjectOf(row) === auth.userId,
    );
  }

  /**
   * BZ-01 (K2-b.3): offene und übernommene Hinweise, die die Person sieht, für die graue Zeile der
   * Seite Lieferanten. Läuft in der Session des Aufrufers und prüft die Regeln nicht neu.
   */
  async activeIn(tx: TenantTransaction, auth: AuthContext, orgId: string): Promise<HintRow[]> {
    const rows = await tx
      .select()
      .from(schema.hint)
      .where(
        and(eq(schema.hint.orgId, orgId), inArray(schema.hint.status, ['open', 'in_progress'])),
      )
      .orderBy(desc(schema.hint.score));
    return this.visibleTo(tx, auth, rows);
  }

  /**
   * HE-01 (K1-c): offene Hinweise, die die Person sieht, für die Triage. Liest nur, prüft die Regeln
   * nicht neu (das macht der tägliche Job und die Liste).
   */
  async openFor(auth: AuthContext): Promise<Hint[]> {
    const { orgId, session } = this.buyer(auth);
    return this.tenant.run(
      session,
      async (tx) => {
        const rows = await tx
          .select()
          .from(schema.hint)
          .where(and(eq(schema.hint.orgId, orgId), eq(schema.hint.status, 'open')))
          .orderBy(desc(schema.hint.score));
        return this.view(tx, auth, await this.visibleTo(tx, auth, rows));
      },
      { readOnly: true },
    );
  }

  /** Liste: prüft die Regeln und zeigt offene zuerst, dann Entschiedenes. */
  async list(auth: AuthContext, today = isoToday()): Promise<HintList> {
    const { orgId, session } = this.buyer(auth);
    return this.tenant.run(session, async (tx) => {
      await this.refresh(tx, orgId, today);
      const rows = await tx
        .select()
        .from(schema.hint)
        .where(eq(schema.hint.orgId, orgId))
        .orderBy(desc(schema.hint.createdAt));
      const visible = await this.visibleTo(tx, auth, rows);
      // KI-16: offene und laufende zuerst, dann nach score (Fokus zählt im score doppelt)
      const rank = (row: HintRow) =>
        row.status === 'open' || row.status === 'in_progress' ? 0 : 1;
      const sorted = [...visible].sort((a, b) => rank(a) - rank(b) || b.score - a.score);
      return hintListSchema.parse({
        hints: await this.view(tx, auth, sorted),
        checkedAt: currentTime().toISOString(),
      });
    });
  }

  async get(auth: AuthContext, id: string): Promise<Hint> {
    const { session } = this.buyer(auth);
    return this.tenant.run(session, async (tx) => {
      const [row] = await tx.select().from(schema.hint).where(eq(schema.hint.id, id));
      if (!row || (await this.visibleTo(tx, auth, [row])).length === 0) throw notFound();
      const [hint] = await this.view(tx, auth, [row]);
      return hint as Hint;
    });
  }

  private async decidable(tx: TenantTransaction, auth: AuthContext, id: string) {
    const [row] = await tx.select().from(schema.hint).where(eq(schema.hint.id, id));
    if (!row || (await this.visibleTo(tx, auth, [row])).length === 0) throw notFound();
    const [hint] = await this.view(tx, auth, [row]);
    return { row, hint: hint as Hint };
  }

  /** Annehmen: Aufgabe der eigenen Seite mit der Quelle „Hinweis“ (früher interne Maßnahme, ZQ-01). */
  async accept(auth: AuthContext, id: string): Promise<Hint> {
    const { orgId, session } = this.buyer(auth);
    return this.tenant.run(session, async (tx) => {
      const { row, hint } = await this.decidable(tx, auth, id);
      if (!hint.canAccept || !row.relationshipId) throw forbidden();
      const actor = await actorOf(tx, auth, orgId);
      const due = new Date(currentTime().getTime() + 14 * 86_400_000).toISOString().slice(0, 10);
      const relationshipId = row.relationshipId;
      await auditedChange(tx, actor, taskAudit, async () => {
        // Die Aufgabe ist privat wie der Hinweis; sie trägt ihn als Quelle (PLT-04)
        const [action] = await tx
          .insert(schema.task)
          .values({
            relationshipId,
            orgId,
            title:
              actionTitles[row.ruleKey] ?? row.suggestedAction ?? row.title ?? 'Hinweis klären',
            ownerUserId: auth.userId,
            ownerName: actor.name,
            dueDate: due,
            sourceType: 'hint',
            sourceId: row.id,
            createdBy: auth.userId,
            createdByName: actor.name,
          })
          .returning();
        if (!action) throw new Error('Aufgabe nicht angelegt');
        return {
          relationshipId,
          objectId: action.id,
          action: 'created' as const,
          before: null,
          after: {
            title: action.title,
            owner_name: action.ownerName,
            due_date: action.dueDate,
            status: action.status,
          },
          result: action,
        };
      });
      await auditedChange(tx, actor, hintAudit, async () => {
        await tx
          .update(schema.hint)
          .set({ status: 'accepted', decidedBy: auth.userId, decidedAt: currentTime() })
          .where(eq(schema.hint.id, row.id));
        return {
          relationshipId,
          objectId: row.id,
          action: 'updated' as const,
          before: { status: 'open' },
          after: { status: 'accepted' },
          result: null,
        };
      });
      const [updated] = await tx.select().from(schema.hint).where(eq(schema.hint.id, row.id));
      return (await this.view(tx, auth, [updated as HintRow]))[0] as Hint;
    });
  }

  /** Verwerfen mit Begründung; sie steht im Verlauf. */
  async dismiss(auth: AuthContext, id: string, input: DismissHint): Promise<Hint> {
    const { orgId, session } = this.buyer(auth);
    if (!input.reason.trim())
      throw new BadRequestException({ statusCode: 400, code: 'begruendung_fehlt' });
    return this.tenant.run(session, async (tx) => {
      const { row, hint } = await this.decidable(tx, auth, id);
      if (!hint.canDismiss) throw forbidden();
      const actor = await actorOf(tx, auth, orgId);
      await auditedChange(tx, actor, hintAudit, async () => {
        await tx
          .update(schema.hint)
          .set({
            status: 'dismissed',
            reason: input.reason,
            decidedBy: auth.userId,
            decidedAt: currentTime(),
          })
          .where(eq(schema.hint.id, row.id));
        return {
          relationshipId: row.relationshipId,
          objectId: row.id,
          action: 'updated' as const,
          before: { status: 'open', reason: null },
          after: { status: 'dismissed', reason: input.reason },
          result: null,
        };
      });
      const [updated] = await tx.select().from(schema.hint).where(eq(schema.hint.id, row.id));
      return (await this.view(tx, auth, [updated as HintRow]))[0] as Hint;
    });
  }

  async settings(auth: AuthContext): Promise<HintSettings> {
    const { orgId, session } = this.buyer(auth);
    return this.tenant.run(session, async (tx) => ({
      maxFocusPerSro: await this.maxFocusPerSro(tx, orgId),
    }));
  }

  async saveSettings(auth: AuthContext, input: HintSettings): Promise<HintSettings> {
    const { orgId, session } = this.buyer(auth);
    return this.tenant.run(session, async (tx) => {
      await tx
        .insert(schema.orgSetting)
        .values({
          orgId,
          key: 'hint_max_focus_per_sro',
          value: input.maxFocusPerSro,
          updatedBy: auth.userId,
        })
        .onConflictDoUpdate({
          target: [schema.orgSetting.orgId, schema.orgSetting.key],
          set: { value: input.maxFocusPerSro, updatedBy: auth.userId, updatedAt: currentTime() },
        });
      return { maxFocusPerSro: await this.maxFocusPerSro(tx, orgId) };
    });
  }

  /** Nur für Tests: feste Antwort des Testanbieters für Begründungen */
  testExplanation: ((fallback: string) => string) | undefined;

  /**
   * KI-16, Agent hint_explainer: zwei Sätze, warum der Hinweis wichtig ist, mit den Werten aus dem
   * Beleg. Eine Zahl, die nicht im Beleg steht, verwirft den Text. Höchstens 200 Hinweise je Tag.
   */
  async explain(tx: TenantTransaction, orgId: string, limit = 200) {
    const rows = await tx
      .select()
      .from(schema.hint)
      .where(
        and(
          eq(schema.hint.orgId, orgId),
          inArray(schema.hint.status, ['open', 'in_progress']),
          inArray(schema.hint.ruleKey, [...earlyWarningRuleKeys]),
          sql`${schema.hint.explanationDraftId} is null`,
        ),
      )
      .orderBy(desc(schema.hint.score))
      .limit(limit);
    let written = 0;
    for (const row of rows) {
      const evidence = hintEvidenceSchema.parse(row.evidence ?? {}) as HintEvidence;
      const sources = [
        ...(evidence.refs ?? []).map((ref) =>
          ownDraftSource(ref.objectType, ref.objectId, ref.title),
        ),
        ...(evidence.sources ?? []).map((source) => ({
          kind: 'public' as const,
          objectType: null,
          objectId: null,
          title: source.title,
          publishedAt: source.publishedOn,
          excerpt: null,
          url: source.url,
        })),
      ];
      const [first, ...rest] = sources;
      if (!first) continue;
      const allowedText = [
        row.title ?? '',
        evidence.metric ?? '',
        evidence.threshold ?? '',
        evidence.period ?? '',
        ...(evidence.values ?? []).flatMap((value) => [value.label, value.value]),
      ].join(' ');
      const allowed = new Set(numbersIn(allowedText));
      const values = (evidence.values ?? [])
        .map((value) => `${value.label}: ${value.value}`)
        .join(', ');
      const fallback = `${row.title ?? 'Hinweis'}. Werte laut Beleg: ${values || evidence.threshold || 'siehe Quelle'}.`;
      const [sro] = row.relationshipId
        ? await tx
            .select({ userId: schema.relationshipMember.userId })
            .from(schema.relationshipMember)
            .where(
              and(
                eq(schema.relationshipMember.relationshipId, row.relationshipId),
                eq(schema.relationshipMember.orgId, orgId),
                eq(schema.relationshipMember.teamRole, 'sro'),
              ),
            )
            .limit(1)
        : [];
      const actingUser = sro?.userId ?? 'system:hints';
      let text = '';
      try {
        const system =
          'Erkläre in zwei Sätzen, warum dieser Hinweis wichtig ist. Nenne nur Werte aus dem Beleg und schlage keinen anderen Schritt vor.';
        const prompt = JSON.stringify({ title: row.title, evidence });
        text = await this.gateway.call(
          { orgId, userId: actingUser, feature: 'hint_explanation' },
          async (model) => {
            if (!model) {
              const value = this.testExplanation ? this.testExplanation(fallback) : fallback;
              return {
                value,
                usage: {
                  inputTokens: estimateTokens(system + prompt),
                  outputTokens: estimateTokens(value),
                },
              };
            }
            const result = await generateText({ model, system, prompt, maxOutputTokens: 160 });
            return {
              value: result.text.trim(),
              usage: {
                inputTokens: result.usage.inputTokens ?? 0,
                outputTokens: result.usage.outputTokens ?? 0,
              },
            };
          },
        );
      } catch {
        continue;
      }
      // Jede Zahl im Text muss im Beleg vorkommen, sonst wird der Text verworfen.
      if (!text || !numbersIn(text).every((value) => allowed.has(value))) continue;
      const draftId = await createBuyerDraft(
        tx,
        {
          orgId,
          relationshipId: row.relationshipId,
          kind: 'hint_explanation',
          objectType: 'hint',
          objectId: row.id,
          content: text,
          model: 'reziproq',
          createdBy: actingUser,
        },
        [{ text, sources: [first, ...rest] }],
      );
      await tx
        .update(schema.hint)
        .set({ explanationDraftId: draftId })
        .where(eq(schema.hint.id, row.id));
      written += 1;
    }
    return written;
  }

  /** In Arbeit: der Hinweis bleibt sichtbar, ist aber übernommen */
  async start(auth: AuthContext, id: string): Promise<Hint> {
    const { session } = this.buyer(auth);
    return this.tenant.run(session, async (tx) => {
      const { row, hint } = await this.decidable(tx, auth, id);
      if (!hint.canDismiss || row.status !== 'open') throw forbidden();
      await tx
        .update(schema.hint)
        .set({ status: 'in_progress', ownerUserId: auth.userId })
        .where(eq(schema.hint.id, id));
      const [updated] = await tx.select().from(schema.hint).where(eq(schema.hint.id, id));
      const [view] = await this.view(tx, auth, [updated as HintRow]);
      return view as Hint;
    });
  }

  /** „War dieser Hinweis hilfreich?“ */
  async rate(auth: AuthContext, id: string, helpful: boolean): Promise<Hint> {
    const { session } = this.buyer(auth);
    return this.tenant.run(session, async (tx) => {
      await this.decidable(tx, auth, id);
      await tx
        .update(schema.hint)
        .set({ feedback: helpful ? 'helpful' : 'not_helpful' })
        .where(eq(schema.hint.id, id));
      const [updated] = await tx.select().from(schema.hint).where(eq(schema.hint.id, id));
      const [view] = await this.view(tx, auth, [updated as HintRow]);
      return view as Hint;
    });
  }

  /** KI-16: Regeln, Schwellen und Bewertung je Regel (Einstellungen KI) */
  async ruleSettingsView(auth: AuthContext): Promise<HintRuleSettings> {
    const { orgId, session } = this.buyer(auth);
    return this.tenant.run(
      session,
      async (tx) => {
        const settings = await this.ruleSettings(tx, orgId);
        const ratings = await tx.execute<{
          rule_key: AnyHintRuleKey;
          helpful: string;
          not_helpful: string;
        }>(sql`
          select rule_key, count(*) filter (where feedback = 'helpful')::text as helpful,
            count(*) filter (where feedback = 'not_helpful')::text as not_helpful
          from hint where org_id = ${orgId} and feedback is not null group by rule_key`);
        return {
          rules: settings.enabled,
          thresholds: settings.thresholds as unknown as Record<string, Record<string, number>>,
          ratings: ratings.rows.map((row) => ({
            ruleKey: row.rule_key,
            helpful: Number(row.helpful),
            notHelpful: Number(row.not_helpful),
          })),
        };
      },
      { readOnly: true },
    );
  }

  async saveRuleSettings(
    auth: AuthContext,
    input: Pick<HintRuleSettings, 'rules' | 'thresholds'>,
  ): Promise<HintRuleSettings> {
    const { orgId, session } = this.buyer(auth);
    await this.tenant.run(session, async (tx) => {
      for (const [key, value] of [
        ['hint_rules', input.rules],
        ['hint_thresholds', input.thresholds],
      ] as const) {
        await tx
          .insert(schema.orgSetting)
          .values({ orgId, key, value, updatedBy: auth.userId })
          .onConflictDoUpdate({
            target: [schema.orgSetting.orgId, schema.orgSetting.key],
            set: { value, updatedBy: auth.userId, updatedAt: currentTime() },
          });
      }
    });
    return this.ruleSettingsView(auth);
  }
}

function isoToday() {
  return currentTime().toISOString().slice(0, 10);
}
