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
  desc,
  eq,
  inArray,
  schema,
  sql,
  type TenantSession,
  type TenantTransaction,
} from '@reziproq/db';
import {
  type DismissHint,
  type Hint,
  type HintList,
  type HintRuleKey,
  type HintSettings,
  hintDetailSchema,
  hintListSchema,
  hintSchema,
} from '@reziproq/shared';
import { TenantDatabase } from '../../common/database.module.js';
import { actorOf } from '../audit/actor.js';
import { actionInternalAudit } from '../audit/audited-objects.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { can } from '../auth/can.js';
import { PortfolioService } from '../portfolio/portfolio.service.js';
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
export function fixPath(ruleKey: HintRuleKey, relationshipId: string | null, subject?: string) {
  const base = relationshipId ? `/lieferanten/${relationshipId}` : '';
  switch (ruleKey) {
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
const actionTitles: Record<HintRuleKey, string> = {
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

const subjectOf = (row: Pick<HintRow, 'ruleKey' | 'fingerprint'>) =>
  row.ruleKey === 'too_many_focus' || row.ruleKey === 'cadence_missed'
    ? row.fingerprint.split('#')[0]
    : undefined;
const storedFingerprint = (finding: HintFinding) =>
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

  /** Regeln prüfen und die Hinweise der Organisation auf den Stand bringen. */
  async refresh(tx: TenantTransaction, orgId: string, today = isoToday()) {
    const findings = await evaluateRules({
      tx,
      orgId,
      today,
      maxFocusPerSro: await this.maxFocusPerSro(tx, orgId),
      deviations: await this.portfolio.deviationsIn(tx, orgId),
    });
    const existing = await tx.select().from(schema.hint).where(eq(schema.hint.orgId, orgId));
    const seen = new Set<string>();
    for (const finding of findings) {
      const key = identity(finding.ruleKey, finding.relationshipId, finding.subject);
      seen.add(key);
      const fingerprint = storedFingerprint(finding);
      const same = existing.filter(
        (row) => identity(row.ruleKey, row.relationshipId, subjectOf(row)) === key,
      );
      const exact = same.find((row) => row.fingerprint === fingerprint);
      if (exact) {
        // Gleiche Lage: offen bleibt offen (Zahlen auffrischen), entschieden bleibt entschieden.
        if (exact.status === 'open') {
          await tx
            .update(schema.hint)
            .set({ detail: finding.detail })
            .where(eq(schema.hint.id, exact.id));
        }
        continue;
      }
      const open = same.find((row) => row.status === 'open');
      if (open) {
        await tx
          .update(schema.hint)
          .set({ fingerprint, detail: finding.detail })
          .where(eq(schema.hint.id, open.id));
        continue;
      }
      // Neue oder geänderte Lage: ein neuer offener Hinweis, auch nach Verwerfen.
      await tx.insert(schema.hint).values({
        orgId,
        relationshipId: finding.relationshipId,
        ruleKey: finding.ruleKey,
        fingerprint,
        detail: finding.detail,
      });
    }
    // Lage behoben: offene Hinweise ohne Fund verschwinden; Entschiedenes bleibt im Verlauf.
    const gone = existing.filter(
      (row) =>
        row.status === 'open' &&
        !seen.has(identity(row.ruleKey, row.relationshipId, subjectOf(row))),
    );
    if (gone.length > 0) {
      await tx.delete(schema.hint).where(
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
    const actions = rows.length
      ? await tx
          .select({
            sourceId: schema.actionPrivateSource.sourceId,
            actionId: schema.actionPrivateSource.actionId,
            relationshipId: schema.actionPrivateSource.relationshipId,
          })
          .from(schema.actionPrivateSource)
          .where(
            and(
              eq(schema.actionPrivateSource.sourceType, 'hint'),
              inArray(
                schema.actionPrivateSource.sourceId,
                rows.map((row) => row.id),
              ),
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
      const allowed = decide && row.status === 'open' && (admin || isSro);
      const action = actions.find((entry) => entry.sourceId === row.id);
      return hintSchema.parse({
        id: row.id,
        ruleKey: row.ruleKey,
        relationshipId: row.relationshipId,
        supplier: names.find((entry) => entry.id === row.relationshipId)?.name ?? null,
        detail: hintDetailSchema.parse(row.detail ?? {}),
        status: row.status,
        reason: row.reason,
        createdAt: row.createdAt.toISOString(),
        decidedAt: row.decidedAt?.toISOString() ?? null,
        decidedByName: people.find((person) => person.id === row.decidedBy)?.name ?? null,
        href: fixPath(row.ruleKey, row.relationshipId, subject),
        canAccept: allowed && row.relationshipId !== null,
        canDismiss: allowed,
        actionHref: action
          ? `/lieferanten/${action.relationshipId}/umsetzung/massnahmen/${action.actionId}`
          : null,
      });
    });
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
      const sorted = [...rows].sort(
        (a, b) => Number(a.status !== 'open') - Number(b.status !== 'open'),
      );
      return hintListSchema.parse({
        hints: await this.view(tx, auth, sorted),
        checkedAt: new Date().toISOString(),
      });
    });
  }

  async get(auth: AuthContext, id: string): Promise<Hint> {
    const { session } = this.buyer(auth);
    return this.tenant.run(session, async (tx) => {
      const [row] = await tx.select().from(schema.hint).where(eq(schema.hint.id, id));
      if (!row) throw notFound();
      const [hint] = await this.view(tx, auth, [row]);
      return hint as Hint;
    });
  }

  private async decidable(tx: TenantTransaction, auth: AuthContext, id: string) {
    const [row] = await tx.select().from(schema.hint).where(eq(schema.hint.id, id));
    if (!row) throw notFound();
    const [hint] = await this.view(tx, auth, [row]);
    return { row, hint: hint as Hint };
  }

  /** Annehmen: interne Maßnahme mit privater Quelle „Hinweis“. */
  async accept(auth: AuthContext, id: string): Promise<Hint> {
    const { orgId, session } = this.buyer(auth);
    return this.tenant.run(session, async (tx) => {
      const { row, hint } = await this.decidable(tx, auth, id);
      if (!hint.canAccept || !row.relationshipId) throw forbidden();
      const actor = await actorOf(tx, auth, orgId);
      const due = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);
      const relationshipId = row.relationshipId;
      await auditedChange(tx, actor, actionInternalAudit, async () => {
        const [action] = await tx
          .insert(schema.action)
          .values({
            relationshipId,
            ownerOrgId: orgId,
            visibility: 'internal',
            title: actionTitles[row.ruleKey],
            ownerSide: 'buyer',
            ownerUserId: auth.userId,
            ownerName: actor.name,
            dueDate: due,
            sourceType: 'manual',
            createdBy: auth.userId,
            createdByName: actor.name,
          })
          .returning();
        if (!action) throw new Error('Maßnahme nicht angelegt');
        // Die Quelle ist privat und verweist auf die Maßnahme, nie umgekehrt (PLT-04).
        await tx.insert(schema.actionPrivateSource).values({
          actionId: action.id,
          relationshipId,
          orgId,
          sourceType: 'hint',
          sourceId: row.id,
        });
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
          .set({ status: 'accepted', decidedBy: auth.userId, decidedAt: new Date() })
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
            decidedAt: new Date(),
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
          set: { value: input.maxFocusPerSro, updatedBy: auth.userId, updatedAt: new Date() },
        });
      return { maxFocusPerSro: await this.maxFocusPerSro(tx, orgId) };
    });
  }
}

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}
