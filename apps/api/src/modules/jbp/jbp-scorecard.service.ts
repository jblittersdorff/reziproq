import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  and,
  asc,
  auditedChange,
  desc,
  eq,
  inArray,
  schema,
  sql,
  type TenantTransaction,
} from '@reziproq/db';
import {
  calculateCycleDeadlines,
  type DueItem,
  defaultKpiTolerance,
  type Kpi,
  type KpiDetail,
  type KpiImportPreview,
  kpiDetailSchema,
  kpiImportPreviewSchema,
  kpiTrack,
  maxScorecardKpis,
  parseKpiMonth,
  parseKpiNumber,
  type SaveKpi,
  type SaveKpiValue,
  type ScorecardView,
  scorecardViewSchema,
} from '@reziproq/shared';
import { ActionsService } from '../actions/actions.service.js';
import { InsightSummaryService } from '../ai-gateway/insight-summary.service.js';
import { actorOf } from '../audit/actor.js';
import {
  kpiValueAudit,
  scorecardAudit,
  scorecardKpiAudit,
  scorecardSignRequestAudit,
} from '../audit/audited-objects.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { can } from '../auth/can.js';
import { EmailService } from '../email/email.service.js';
import { readCycleSettings } from '../overview/cycle.js';
import { normalizeHeader } from '../suppliers/import-file.js';
import type { JbpScope } from './jbp.service.js';
import { teamPeople } from './people.js';
import { scorecardStatement } from './statement.js';

/** Toleranz „knapp“ des Kunden (JBP-09); beide Seiten lesen sie über app_kpi_tolerance. */
export async function kpiTolerance(tx: TenantTransaction, relationshipId: string) {
  const result = await tx.execute<{ tolerance: number }>(
    sql`select app_kpi_tolerance(${relationshipId}) as tolerance`,
  );
  return Number(result.rows[0]?.tolerance ?? defaultKpiTolerance);
}

/** Je Kennzahl und Monat der jüngste Wert, älteste Monate zuerst. */
export async function valuesOf(tx: TenantTransaction, kpiIds: string[]) {
  if (kpiIds.length === 0) return [];
  const rows = await tx
    .select()
    .from(schema.kpiValue)
    .where(inArray(schema.kpiValue.kpiId, kpiIds))
    .orderBy(asc(schema.kpiValue.period), desc(schema.kpiValue.enteredAt));
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = `${row.kpiId}|${row.period}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const forbidden = () => new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });
const notFound = () => new NotFoundException({ statusCode: 404, code: 'nicht_gefunden' });
const conflict = (code: string) => new ConflictException({ statusCode: 409, code });

type ScorecardRow = typeof schema.scorecard.$inferSelect;
type KpiRow = typeof schema.scorecardKpi.$inferSelect;

/** Frist zum Unterschreiben ohne Zyklus: zwei Wochen nach Anlage der Scorecard. */
const fallbackDays = 14;

const kpiSnapshot = (row: KpiRow) => ({
  name: row.name,
  unit: row.unit,
  direction: row.direction,
  baseline: row.baseline,
  target: row.target,
  target_date: row.targetDate,
  owner_name: row.ownerName,
  benefit_for: row.benefitFor,
});

/**
 * JBP-07: Scorecard mit höchstens zehn Kennzahlen. Jede Seite schlägt eigene Kennzahlen vor und
 * bearbeitet nur diese, bis unterschrieben ist. Sie gilt erst mit den Unterschriften beider Seiten
 * unter dieselbe Version; ändert sich danach eine Kennzahl, beginnt eine neue Version. Status und
 * Version ändert für beide Seiten app_scorecard_transition (Migration 0049).
 */
@Injectable()
export class JbpScorecardService {
  constructor(
    @Inject(EmailService) private readonly email: EmailService,
    @Inject(ActionsService) private readonly actions: ActionsService,
    @Inject(InsightSummaryService) private readonly summaries: InsightSummaryService,
  ) {}

  /** GET der Seite: Stand mit Aussage von Reziproq (AW-01); Änderungen antworten ohne Aussage */
  async page(scope: JbpScope): Promise<ScorecardView> {
    const view = await this.view(scope);
    return { ...view, statement: await scorecardStatement(this.summaries, scope, view) };
  }

  private canEdit(scope: JbpScope) {
    if (!can(scope.auth, 'jbp.bearbeiten', { teamRole: scope.teamRole })) return false;
    return scope.side === 'supplier' || scope.auth.orgRole === 'admin' || scope.teamRole !== null;
  }

  /** Unterschreiben: SRO (oder Admin) beim Käufer, beim Lieferanten wer den Plan bearbeitet (KAM). */
  private canSign(scope: JbpScope) {
    if (scope.side === 'supplier') return can(scope.auth, 'jbp.bearbeiten');
    return (
      can(scope.auth, 'jbp.anlegen', { teamRole: scope.teamRole }) &&
      (scope.auth.orgRole === 'admin' || scope.teamRole === 'sro')
    );
  }

  private async plan(tx: TenantTransaction, relationshipId: string) {
    const [row] = await tx
      .select({ id: schema.jbp.id })
      .from(schema.jbp)
      .where(eq(schema.jbp.relationshipId, relationshipId))
      .orderBy(desc(schema.jbp.version))
      .limit(1);
    return row ?? null;
  }

  private async scorecard(tx: TenantTransaction, planId: string): Promise<ScorecardRow | null> {
    const [row] = await tx
      .select()
      .from(schema.scorecard)
      .where(eq(schema.scorecard.jbpId, planId))
      .orderBy(asc(schema.scorecard.createdAt))
      .limit(1);
    return row ?? null;
  }

  private async signatures(tx: TenantTransaction, card: ScorecardRow) {
    return tx
      .select()
      .from(schema.scorecardSignature)
      .where(
        and(
          eq(schema.scorecardSignature.scorecardId, card.id),
          eq(schema.scorecardSignature.version, card.version),
        ),
      )
      .orderBy(asc(schema.scorecardSignature.signedAt));
  }

  /**
   * Frist aus dem Zyklus (ZYK-02); der Verweis auf den Zyklus ist käuferprivat. Läuft der Plan über
   * mehrere Zyklen (ZYK-05), gilt der jüngste.
   */
  private async deadline(tx: TenantTransaction, planId: string): Promise<string | null> {
    const [row] = await tx
      .select({ jbpDate: schema.cycle.jbpDate })
      .from(schema.jbpCycleLink)
      .innerJoin(schema.cycle, eq(schema.cycle.id, schema.jbpCycleLink.cycleId))
      .where(eq(schema.jbpCycleLink.jbpId, planId))
      .orderBy(desc(schema.cycle.startedAt))
      .limit(1);
    if (!row?.jbpDate) return null;
    const settings = await readCycleSettings(tx);
    return (
      calculateCycleDeadlines(row.jbpDate, settings).find((entry) => entry.step === 'scorecard')
        ?.dueDate ?? null
    );
  }

  async view(scope: JbpScope): Promise<ScorecardView> {
    const { tx } = scope;
    const plan = await this.plan(tx, scope.relationshipId);
    const card = plan ? await this.scorecard(tx, plan.id) : null;
    const rows = card
      ? await tx
          .select()
          .from(schema.scorecardKpi)
          .where(eq(schema.scorecardKpi.scorecardId, card.id))
          .orderBy(asc(schema.scorecardKpi.createdAt))
      : [];
    const initiatives = plan
      ? await tx
          .select({ id: schema.initiative.id, title: schema.initiative.title })
          .from(schema.initiative)
          .where(eq(schema.initiative.jbpId, plan.id))
          .orderBy(asc(schema.initiative.startsOn))
      : [];
    const signatures = card ? await this.signatures(tx, card) : [];
    const status = card?.status ?? 'draft';
    const editable = Boolean(plan) && status === 'draft' && this.canEdit(scope);
    const tolerance = plan ? await kpiTolerance(tx, scope.relationshipId) : defaultKpiTolerance;
    const values = await valuesOf(
      tx,
      rows.map((row) => row.id),
    );
    const kpis: Kpi[] = rows.map((row) => {
      const initiative = initiatives.find((entry) => entry.id === row.initiativeId);
      const own = values
        .filter((entry) => entry.kpiId === row.id)
        .map((entry) => ({ period: entry.period, value: entry.value }));
      const startDate = row.createdAt.toISOString().slice(0, 10);
      return {
        id: row.id,
        own: row.ownerOrgId === scope.orgId,
        ownerSide: row.ownerSide,
        initiative: initiative ?? null,
        name: row.name,
        unit: row.unit,
        direction: row.direction,
        baseline: row.baseline,
        target: row.target,
        targetDate: row.targetDate,
        ownerUserId: row.ownerUserId,
        ownerName: row.ownerName,
        benefitFor: row.benefitFor,
        startDate,
        values: own,
        track: kpiTrack({ ...row, startDate }, own, tolerance),
        canEnter: row.ownerOrgId === scope.orgId && this.canEdit(scope),
      };
    });
    return scorecardViewSchema.parse({
      hasPlan: Boolean(plan),
      ownSide: scope.side,
      status,
      version: card?.version ?? 1,
      kpis,
      signatures: signatures.map((row) => ({
        side: row.side,
        userName: row.userName,
        signedAt: row.signedAt.toISOString(),
      })),
      deadline: plan && scope.side === 'buyer' ? await this.deadline(tx, plan.id) : null,
      tolerancePercent: tolerance,
      canEdit: editable,
      canSign:
        status === 'draft' &&
        kpis.length > 0 &&
        this.canSign(scope) &&
        !signatures.some((row) => row.side === scope.side),
      canNewVersion: status === 'signed' && this.canSign(scope),
      people: editable
        ? await teamPeople(tx, scope.relationshipId, scope.orgId, scope.auth.userId)
        : [],
      initiatives,
    });
  }

  private async transition(tx: TenantTransaction, id: string, to: string) {
    try {
      await tx.execute(sql`select app_scorecard_transition(${id}, ${to})`);
    } catch (error) {
      const message = String((error as { cause?: { message?: string } }).cause?.message ?? error);
      if (message.includes('not_allowed')) throw conflict('uebergang_nicht_erlaubt');
      throw error;
    }
  }

  /** Prüft Recht, Plan und Sperre; legt die Scorecard beim ersten Vorschlag an. */
  private async editable(scope: JbpScope, create: boolean) {
    if (!this.canEdit(scope)) throw forbidden();
    const plan = await this.plan(scope.tx, scope.relationshipId);
    if (!plan) throw notFound();
    let card = await this.scorecard(scope.tx, plan.id);
    if (!card && create) {
      const [row] = await scope.tx
        .insert(schema.scorecard)
        .values({
          relationshipId: scope.relationshipId,
          ownerOrgId: scope.orgId,
          visibility: 'shared',
          jbpId: plan.id,
        })
        .returning();
      card = row ?? null;
    }
    if (!card) throw notFound();
    if (card.status === 'signed') throw conflict('scorecard_unterschrieben');
    return { plan, card };
  }

  private async details(scope: JbpScope, planId: string, input: SaveKpi) {
    const people = await teamPeople(scope.tx, scope.relationshipId, scope.orgId, scope.auth.userId);
    const owner = people.find((person) => person.userId === input.ownerUserId);
    if (!owner) throw new BadRequestException({ statusCode: 400, code: 'person_unbekannt' });
    if (input.initiativeId) {
      const [initiative] = await scope.tx
        .select({ id: schema.initiative.id })
        .from(schema.initiative)
        .where(
          and(eq(schema.initiative.id, input.initiativeId), eq(schema.initiative.jbpId, planId)),
        );
      if (!initiative) {
        throw new BadRequestException({ statusCode: 400, code: 'initiative_unbekannt' });
      }
    }
    return {
      initiativeId: input.initiativeId,
      name: input.name,
      unit: input.unit,
      direction: input.direction,
      baseline: input.baseline,
      target: input.target,
      targetDate: input.targetDate,
      ownerSide: scope.side,
      ownerUserId: owner.userId,
      ownerName: owner.name,
      benefitFor: input.benefitFor,
    };
  }

  /** Nach einer Unterschrift macht jede Änderung eine neue Version; die Unterschrift gilt nicht mehr. */
  private async reviseIfSigned(tx: TenantTransaction, card: ScorecardRow) {
    if ((await this.signatures(tx, card)).length > 0) await this.transition(tx, card.id, 'revise');
  }

  async createKpi(scope: JbpScope, input: SaveKpi): Promise<ScorecardView> {
    const { plan, card } = await this.editable(scope, true);
    const { tx } = scope;
    const [count] = await tx
      .select({ value: sql<number>`count(*)::int` })
      .from(schema.scorecardKpi)
      .where(eq(schema.scorecardKpi.scorecardId, card.id));
    if ((count?.value ?? 0) >= maxScorecardKpis) throw conflict('zu_viele_kennzahlen');
    const values = await this.details(scope, plan.id, input);
    const actor = await actorOf(tx, scope.auth, scope.orgId);
    await auditedChange(tx, actor, scorecardKpiAudit, async () => {
      const [row] = await tx
        .insert(schema.scorecardKpi)
        .values({
          relationshipId: scope.relationshipId,
          ownerOrgId: scope.orgId,
          visibility: 'shared',
          scorecardId: card.id,
          ...values,
        })
        .returning();
      const created = row as KpiRow;
      return {
        objectId: created.id,
        relationshipId: scope.relationshipId,
        action: 'created' as const,
        after: kpiSnapshot(created),
        result: undefined,
      };
    });
    await this.reviseIfSigned(tx, card);
    return this.view(scope);
  }

  private async ownKpi(scope: JbpScope, card: ScorecardRow, kpiId: string) {
    const [row] = await scope.tx
      .select()
      .from(schema.scorecardKpi)
      .where(and(eq(schema.scorecardKpi.id, kpiId), eq(schema.scorecardKpi.scorecardId, card.id)));
    if (!row) throw notFound();
    if (row.ownerOrgId !== scope.orgId) throw forbidden();
    return row;
  }

  async updateKpi(scope: JbpScope, kpiId: string, input: SaveKpi): Promise<ScorecardView> {
    const { plan, card } = await this.editable(scope, false);
    const before = await this.ownKpi(scope, card, kpiId);
    const values = await this.details(scope, plan.id, input);
    const { tx } = scope;
    const actor = await actorOf(tx, scope.auth, scope.orgId);
    await auditedChange(tx, actor, scorecardKpiAudit, async () => {
      await tx.update(schema.scorecardKpi).set(values).where(eq(schema.scorecardKpi.id, kpiId));
      return {
        objectId: kpiId,
        relationshipId: scope.relationshipId,
        action: 'updated' as const,
        before: kpiSnapshot(before),
        after: kpiSnapshot({ ...before, ...values }),
        result: undefined,
      };
    });
    await this.reviseIfSigned(tx, card);
    return this.view(scope);
  }

  async deleteKpi(scope: JbpScope, kpiId: string): Promise<ScorecardView> {
    const { card } = await this.editable(scope, false);
    const before = await this.ownKpi(scope, card, kpiId);
    const { tx } = scope;
    const actor = await actorOf(tx, scope.auth, scope.orgId);
    await auditedChange(tx, actor, scorecardKpiAudit, async () => {
      await tx.delete(schema.scorecardKpi).where(eq(schema.scorecardKpi.id, kpiId));
      return {
        objectId: kpiId,
        relationshipId: scope.relationshipId,
        action: 'ended' as const,
        before: kpiSnapshot(before),
        result: undefined,
      };
    });
    await this.reviseIfSigned(tx, card);
    return this.view(scope);
  }

  /**
   * Für die eigene Seite unterschreiben. Unterschreibt die zweite Seite, gilt die Scorecard. Der
   * Käufer benachrichtigt den Lieferanten per Mail (angenommene Einladungen); unterschreibt der
   * Lieferant zuerst, sieht der SRO die Aufgabe auf Start, denn der Lieferant kennt keine Adressen
   * des Käufers.
   */
  async sign(scope: JbpScope): Promise<ScorecardView> {
    if (!this.canSign(scope)) throw forbidden();
    const { tx } = scope;
    const plan = await this.plan(tx, scope.relationshipId);
    const card = plan ? await this.scorecard(tx, plan.id) : null;
    if (!plan || !card) throw notFound();
    if (card.status !== 'draft') throw conflict('scorecard_unterschrieben');
    const [kpi] = await tx
      .select({ id: schema.scorecardKpi.id })
      .from(schema.scorecardKpi)
      .where(eq(schema.scorecardKpi.scorecardId, card.id))
      .limit(1);
    if (!kpi) throw conflict('keine_kennzahlen');
    const signed = await this.signatures(tx, card);
    if (signed.some((row) => row.side === scope.side)) throw conflict('schon_unterschrieben');
    const actor = await actorOf(tx, scope.auth, scope.orgId);
    const complete = signed.some((row) => row.side !== scope.side);
    await tx.insert(schema.scorecardSignature).values({
      relationshipId: scope.relationshipId,
      ownerOrgId: scope.orgId,
      visibility: 'shared',
      scorecardId: card.id,
      version: card.version,
      side: scope.side,
      userId: scope.auth.userId,
      userName: actor.name,
    });
    await auditedChange(tx, actor, scorecardAudit, async () => {
      if (complete) await this.transition(tx, card.id, 'signed');
      return {
        objectId: card.id,
        relationshipId: scope.relationshipId,
        action: complete ? ('approved' as const) : ('updated' as const),
        before: {
          version: card.version,
          status: card.status,
          signed_by: signed.map((r) => r.side).join(', '),
        },
        after: {
          version: card.version,
          status: complete ? 'signed' : 'draft',
          signed_by: [...signed.map((r) => r.side), scope.side].join(', '),
        },
        result: undefined,
      };
    });
    if (scope.side === 'buyer' && !complete) await this.notifySupplier(scope, card);
    return this.view(scope);
  }

  private async notifySupplier(scope: JbpScope, card: ScorecardRow) {
    const { tx } = scope;
    const actor = await actorOf(tx, scope.auth, scope.orgId);
    const [buyer] = await tx
      .select({ name: schema.organization.name })
      .from(schema.organization)
      .where(eq(schema.organization.id, scope.orgId));
    const recipients = await tx
      .select({ email: schema.invitation.email, userId: schema.invitation.acceptedUserId })
      .from(schema.invitation)
      .where(
        and(
          eq(schema.invitation.relationshipId, scope.relationshipId),
          sql`${schema.invitation.acceptedUserId} is not null`,
          sql`${schema.invitation.revokedAt} is null`,
        ),
      );
    for (const recipient of recipients) {
      await auditedChange(tx, actor, scorecardSignRequestAudit, async () => ({
        objectId: `${card.id}:${recipient.userId}`,
        relationshipId: scope.relationshipId,
        action: 'created' as const,
        after: { recipient: recipient.email, version: card.version },
        result: undefined,
        email: this.email.prepare({
          recipient: recipient.email,
          template: 'approval',
          locale: 'de',
          title: `Scorecard ${buyer?.name ?? ''}`.trim(),
          link: `/kunden/${scope.relationshipId}/plan/scorecard/unterschreiben`,
        }),
      }));
    }
  }

  async newVersion(scope: JbpScope): Promise<ScorecardView> {
    if (!this.canSign(scope)) throw forbidden();
    const { tx } = scope;
    const plan = await this.plan(tx, scope.relationshipId);
    const card = plan ? await this.scorecard(tx, plan.id) : null;
    if (!plan || !card) throw notFound();
    if (card.status !== 'signed') throw conflict('scorecard_nicht_unterschrieben');
    const actor = await actorOf(tx, scope.auth, scope.orgId);
    await auditedChange(tx, actor, scorecardAudit, async () => {
      await this.transition(tx, card.id, 'new_version');
      return {
        objectId: card.id,
        relationshipId: scope.relationshipId,
        action: 'updated' as const,
        before: { version: card.version, status: card.status },
        after: { version: card.version + 1, status: 'draft' },
        result: undefined,
      };
    });
    return this.view(scope);
  }

  /** Kennzahl mit allen Ist-Werten (JBP-09); sehen dürfen beide Seiten. */
  async kpiDetail(scope: JbpScope, kpiId: string): Promise<KpiDetail> {
    const view = await this.view(scope);
    const kpi = view.kpis.find((entry) => entry.id === kpiId);
    if (!kpi) throw notFound();
    const values = await valuesOf(scope.tx, [kpiId]);
    return kpiDetailSchema.parse({
      kpi,
      values: values
        .map((row) => ({
          period: row.period,
          value: row.value,
          source: row.source,
          enteredByName: row.enteredByName,
          enteredAt: row.enteredAt.toISOString(),
        }))
        .reverse(),
      tolerancePercent: view.tolerancePercent,
    });
  }

  /** Kennzahl, für die die eigene Seite Werte erfasst; auch nach der Unterschrift. */
  private async enterable(scope: JbpScope, kpiId: string) {
    if (!this.canEdit(scope)) throw forbidden();
    const [row] = await scope.tx
      .select()
      .from(schema.scorecardKpi)
      .where(
        and(
          eq(schema.scorecardKpi.id, kpiId),
          eq(schema.scorecardKpi.relationshipId, scope.relationshipId),
        ),
      );
    if (!row) throw notFound();
    if (row.ownerOrgId !== scope.orgId) throw forbidden();
    return row;
  }

  /** Ein Wert je Monat: ein neuer ersetzt den alten; der Verlauf hält beide fest. */
  private async writeValue(
    scope: JbpScope,
    kpi: KpiRow,
    period: string,
    value: string,
    source: 'manual' | 'csv',
  ) {
    const { tx } = scope;
    const actor = await actorOf(tx, scope.auth, scope.orgId);
    const [before] = await tx
      .select()
      .from(schema.kpiValue)
      .where(and(eq(schema.kpiValue.kpiId, kpi.id), eq(schema.kpiValue.period, period)));
    await auditedChange(tx, actor, kpiValueAudit, async () => {
      if (before) {
        await tx
          .update(schema.kpiValue)
          .set({
            value,
            source,
            enteredBy: scope.auth.userId,
            enteredByName: actor.name,
            enteredAt: new Date(),
          })
          .where(eq(schema.kpiValue.id, before.id));
      } else {
        await tx.insert(schema.kpiValue).values({
          relationshipId: scope.relationshipId,
          ownerOrgId: scope.orgId,
          visibility: 'shared',
          kpiId: kpi.id,
          period,
          value,
          source,
          enteredBy: scope.auth.userId,
          enteredByName: actor.name,
        });
      }
      return {
        objectId: kpi.id,
        relationshipId: scope.relationshipId,
        action: before ? ('updated' as const) : ('created' as const),
        before: before
          ? { period: before.period, value: Number(before.value).toString(), source: before.source }
          : null,
        after: { period, value: Number(value).toString(), source },
        result: undefined,
      };
    });
  }

  async enterValue(scope: JbpScope, kpiId: string, input: SaveKpiValue): Promise<KpiDetail> {
    const kpi = await this.enterable(scope, kpiId);
    await this.writeValue(scope, kpi, `${input.month}-01`, input.value, 'manual');
    return this.kpiDetail(scope, kpiId);
  }

  /**
   * CSV-Import (JBP-09): Spalten Kennzahl, Monat, Wert. Die Vorschau markiert fehlerhafte Zeilen;
   * übernommen wird nur, wenn keine Zeile fehlerhaft ist.
   */
  async importPreview(
    scope: JbpScope,
    rows: { row: number; values: Record<string, string> }[],
  ): Promise<KpiImportPreview> {
    if (!this.canEdit(scope)) throw forbidden();
    const plan = await this.plan(scope.tx, scope.relationshipId);
    const card = plan ? await this.scorecard(scope.tx, plan.id) : null;
    const kpis = card
      ? await scope.tx
          .select()
          .from(schema.scorecardKpi)
          .where(eq(schema.scorecardKpi.scorecardId, card.id))
      : [];
    const byName = new Map(kpis.map((kpi) => [kpi.name.trim().toLocaleLowerCase('de'), kpi]));
    const seen = new Set<string>();
    // Spaltenköpfe wie in PLT-07 normalisiert: „Kennzahl“, „KPI“, „Monat“, „Month“, „Wert“, „Value“.
    const pick = (values: Record<string, string>, keys: string[]) => {
      const normalized = Object.fromEntries(
        Object.entries(values).map(([key, value]) => [normalizeHeader(key), value]),
      );
      return keys.map((key) => normalized[key]).find((value) => value !== undefined) ?? '';
    };
    const result = rows.map(({ row, values }) => {
      const kpiName = pick(values, ['kennzahl', 'kpi']).trim();
      const month = pick(values, ['monat', 'month']).trim();
      const value = pick(values, ['wert', 'value']).trim();
      const errors: KpiImportPreview['rows'][number]['errors'] = [];
      const kpi = byName.get(kpiName.toLocaleLowerCase('de'));
      if (!kpi) errors.push('kennzahl_unbekannt');
      else if (kpi.ownerOrgId !== scope.orgId) errors.push('kennzahl_andere_seite');
      const period = parseKpiMonth(month);
      if (!period) errors.push('monat_ungueltig');
      if (!parseKpiNumber(value)) errors.push('wert_ungueltig');
      // Doppelt ist nur eine sonst gültige Zeile zu Kennzahl und Monat, die schon vorkam.
      const key = `${kpi?.id}|${period}`;
      if (errors.length === 0 && seen.has(key)) errors.push('doppelt');
      if (errors.length === 0) seen.add(key);
      return { row, kpi: kpiName, month, value, errors };
    });
    const invalid = result.filter((entry) => entry.errors.length > 0).length;
    return kpiImportPreviewSchema.parse({
      rows: result,
      valid: result.length - invalid,
      invalid,
    });
  }

  async importApply(
    scope: JbpScope,
    rows: { row: number; values: Record<string, string> }[],
  ): Promise<KpiImportPreview> {
    const preview = await this.importPreview(scope, rows);
    if (preview.invalid > 0) {
      throw new BadRequestException({ statusCode: 400, code: 'import_fehlerhaft', preview });
    }
    const plan = await this.plan(scope.tx, scope.relationshipId);
    const card = plan ? await this.scorecard(scope.tx, plan.id) : null;
    const kpis = card
      ? await scope.tx
          .select()
          .from(schema.scorecardKpi)
          .where(eq(schema.scorecardKpi.scorecardId, card.id))
      : [];
    for (const entry of preview.rows) {
      const kpi = kpis.find(
        (candidate) =>
          candidate.name.trim().toLocaleLowerCase('de') === entry.kpi.toLocaleLowerCase('de'),
      ) as KpiRow;
      await this.writeValue(
        scope,
        kpi,
        parseKpiMonth(entry.month) as string,
        parseKpiNumber(entry.value) as string,
        'csv',
      );
    }
    return preview;
  }

  /** Start (JBP-07): Scorecard mit Kennzahlen, die die eigene Seite noch nicht unterschrieben hat. */
  async dueItems(auth: AuthContext): Promise<DueItem[]> {
    const items: DueItem[] = [];
    await this.actions.eachRelationship(
      auth,
      async (tx, entry) => {
        const side = entry.orgId === entry.buyerOrgId ? 'buyer' : 'supplier';
        if (side === 'supplier' && !can(auth, 'jbp.bearbeiten')) return;
        if (side === 'buyer' && auth.orgRole !== 'admin') {
          const [member] = await tx
            .select({ teamRole: schema.relationshipMember.teamRole })
            .from(schema.relationshipMember)
            .where(
              and(
                eq(schema.relationshipMember.relationshipId, entry.relationshipId),
                eq(schema.relationshipMember.userId, auth.userId),
              ),
            );
          if (member?.teamRole !== 'sro') return;
        }
        const plan = await this.plan(tx, entry.relationshipId);
        const card = plan ? await this.scorecard(tx, plan.id) : null;
        if (!plan || !card || card.status !== 'draft') return;
        const [kpi] = await tx
          .select({ id: schema.scorecardKpi.id })
          .from(schema.scorecardKpi)
          .where(eq(schema.scorecardKpi.scorecardId, card.id))
          .limit(1);
        if (!kpi) return;
        if ((await this.signatures(tx, card)).some((row) => row.side === side)) return;
        const fallback = new Date(card.createdAt.getTime() + fallbackDays * 86_400_000)
          .toISOString()
          .slice(0, 10);
        items.push({
          id: card.id,
          kind: 'signature',
          supplier: entry.counterpart,
          detail: null,
          dueDate: (side === 'buyer' ? await this.deadline(tx, plan.id) : null) ?? fallback,
          href: `${entry.base}/plan/scorecard/unterschreiben`,
        });
      },
      'jbp.sehen',
    );
    return items;
  }
}
