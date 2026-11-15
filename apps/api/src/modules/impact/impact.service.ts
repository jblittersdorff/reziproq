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
  type TenantTransaction,
} from '@reziproq/db';
import {
  allowedEffect,
  defaultPnlLines,
  type FreezeBaseline,
  type ImpactDetail,
  type ImpactImportPreview,
  type ImpactList,
  impactDetailSchema,
  impactImportPreviewSchema,
  impactListSchema,
  invalidLeverInputs,
  type Lever,
  leverTemplates,
  type MonthKind,
  type PnlLines,
  parseEuroToCents,
  parseKpiMonth,
  parseKpiNumber,
  pnlLinesSchema,
  type RaiseMaturity,
  type RequestValidation,
  type SaveImpactMonth,
  type SavePnlLine,
  type SetupImpact,
  type TeamRole,
} from '@reziproq/shared';
import { TenantDatabase } from '../../common/database.module.js';
import { actorOf } from '../audit/actor.js';
import {
  baselineAudit,
  impactMonthAudit,
  initiativeImpactAudit,
  maturityAudit,
  pnlLineAudit,
  validationAudit,
} from '../audit/audited-objects.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { can } from '../auth/can.js';
import { EmailService } from '../email/email.service.js';
import { normalizeHeader } from '../suppliers/import-file.js';
import { maturityOf } from './maturity.js';
import { referencesOf, sharesOf, totalsOf, valuesOf } from './sharing.js';
import { isLocked, lockedPeriods, monthsOf, recompute, validationsOf } from './values.js';

const forbidden = () => new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });
const notFound = () => new NotFoundException({ statusCode: 404, code: 'nicht_gefunden' });
const conflict = (code: string) => new ConflictException({ statusCode: 409, code });
const invalid = (code: string) => new BadRequestException({ statusCode: 400, code });

export interface ImpactScope {
  tx: TenantTransaction;
  auth: AuthContext;
  orgId: string;
  relationshipId: string;
  teamRole: TeamRole | null;
}

type ImpactRow = typeof schema.initiativeImpact.$inferSelect;

/**
 * PNL-01, PNL-03: GuV-Wirkung der gemeinsamen Initiativen beim Käufer. Hebel, GuV-Zeile,
 * Wirkungsart und Baseline sind käuferprivat; der Reifegrad ist geteilt und steigt nur mit
 * Nachweis, R5 nur über die Freigabe durch Controlling (PNL-06).
 */
@Injectable()
export class ImpactService {
  constructor(
    @Inject(TenantDatabase) private readonly tenant: TenantDatabase,
    @Inject(EmailService) private readonly email: EmailService,
  ) {}

  /** Eigene Beziehung des Käufers mit Teamrolle der Person. */
  run<T>(auth: AuthContext, relationshipId: string, work: (scope: ImpactScope) => Promise<T>) {
    const organization = auth.organization;
    if (!organization?.buyer) throw forbidden();
    return this.tenant.run({ userId: auth.userId, organizationId: organization.id }, async (tx) => {
      const [relationship] = await tx
        .select({ id: schema.relationship.id })
        .from(schema.relationship)
        .where(
          and(
            eq(schema.relationship.id, relationshipId),
            eq(schema.relationship.buyerOrgId, organization.id),
          ),
        );
      if (!relationship) throw notFound();
      const [member] = await tx
        .select({ teamRole: schema.relationshipMember.teamRole })
        .from(schema.relationshipMember)
        .where(
          and(
            eq(schema.relationshipMember.relationshipId, relationshipId),
            eq(schema.relationshipMember.orgId, organization.id),
            eq(schema.relationshipMember.userId, auth.userId),
          ),
        );
      return work({
        tx,
        auth,
        orgId: organization.id,
        relationshipId,
        teamRole: member?.teamRole ?? null,
      });
    });
  }

  /** Freigabe anfordern: SRO oder Admin (PNL-06). */
  canLead(scope: ImpactScope) {
    return this.canEdit(scope) && (scope.auth.orgRole === 'admin' || scope.teamRole === 'sro');
  }

  /** SRO und Team des Käufers, oder ein Admin; nie mit Teamrolle Leser. */
  private canEdit(scope: ImpactScope) {
    if (!can(scope.auth, 'wirkung.bearbeiten', { teamRole: scope.teamRole })) return false;
    return scope.auth.orgRole === 'admin' || scope.teamRole !== null;
  }

  async ensureLines(tx: TenantTransaction, orgId: string) {
    await tx
      .insert(schema.pnlLine)
      .values(defaultPnlLines.map((line, index) => ({ orgId, ...line, position: index + 1 })))
      .onConflictDoNothing();
    return tx
      .select()
      .from(schema.pnlLine)
      .where(eq(schema.pnlLine.orgId, orgId))
      .orderBy(asc(schema.pnlLine.position), asc(schema.pnlLine.key));
  }

  private async setupOf(tx: TenantTransaction, orgId: string, row: ImpactRow | undefined) {
    if (!row) return null;
    const lines = await this.ensureLines(tx, orgId);
    const line = lines.find((entry) => entry.key === row.pnlLineKey);
    return {
      lever: row.lever as Lever,
      leverTemplateVersion: row.leverTemplateVersion,
      pnlLine: { key: row.pnlLineKey, name: line?.name ?? row.pnlLineKey },
      effectType: row.effectType,
      effectiveFrom: row.effectiveFrom,
    };
  }

  private async latestImpact(tx: TenantTransaction, initiativeId: string) {
    const [row] = await tx
      .select()
      .from(schema.initiativeImpact)
      .where(eq(schema.initiativeImpact.initiativeId, initiativeId))
      .orderBy(desc(schema.initiativeImpact.updatedAt))
      .limit(1);
    return row;
  }

  /** Alle Initiativen des jüngsten Gemeinsamen Plans mit Wirkung und Reifegrad. */
  async list(scope: ImpactScope): Promise<ImpactList> {
    const { tx } = scope;
    const [plan] = await tx
      .select({ id: schema.jbp.id })
      .from(schema.jbp)
      .where(eq(schema.jbp.relationshipId, scope.relationshipId))
      .orderBy(desc(schema.jbp.version))
      .limit(1);
    const rows = plan
      ? await tx
          .select()
          .from(schema.initiative)
          .where(eq(schema.initiative.jbpId, plan.id))
          .orderBy(asc(schema.initiative.startsOn), asc(schema.initiative.createdAt))
      : [];
    const impacts =
      rows.length > 0
        ? await tx
            .select()
            .from(schema.initiativeImpact)
            .where(
              inArray(
                schema.initiativeImpact.initiativeId,
                rows.map((row) => row.id),
              ),
            )
        : [];
    const initiatives = [];
    for (const row of rows) {
      initiatives.push({
        id: row.id,
        title: row.title,
        source: row.source,
        maturity: (await maturityOf(tx, row.id)).level,
        impact: await this.setupOf(
          tx,
          scope.orgId,
          impacts.find((entry) => entry.initiativeId === row.id),
        ),
      });
    }
    // PNL-07: Teilung, Savings-Verweis und Summen je Wirkungsart ohne Doppelzählung.
    const ids = initiatives.map((entry) => entry.id);
    const shares = await sharesOf(tx, ids);
    const references = await referencesOf(tx, ids);
    const values = await valuesOf(tx, ids);
    return impactListSchema.parse({
      canEdit: this.canEdit(scope),
      canLead: this.canLead(scope),
      initiatives: initiatives.map((entry) => ({
        ...entry,
        share: shares.get(entry.id) ?? null,
        savingsReference: references.get(entry.id) ?? null,
      })),
      totals: totalsOf(
        ids.filter((id) => !references.has(id)).flatMap((id) => values.get(id) ?? []),
      ),
    });
  }

  private async initiative(scope: ImpactScope, initiativeId: string) {
    const [row] = await scope.tx
      .select()
      .from(schema.initiative)
      .where(
        and(
          eq(schema.initiative.id, initiativeId),
          eq(schema.initiative.relationshipId, scope.relationshipId),
        ),
      );
    if (!row) throw notFound();
    return row;
  }

  private async baselines(tx: TenantTransaction, initiativeId: string) {
    return tx
      .select()
      .from(schema.initiativeBaseline)
      .where(eq(schema.initiativeBaseline.initiativeId, initiativeId))
      .orderBy(desc(schema.initiativeBaseline.version));
  }

  async detail(scope: ImpactScope, initiativeId: string): Promise<ImpactDetail> {
    const { tx } = scope;
    const row = await this.initiative(scope, initiativeId);
    const impact = await this.latestImpact(tx, row.id);
    const baselines = await this.baselines(tx, row.id);
    const maturity = await maturityOf(tx, row.id);
    const toLevel = maturity.level + 1;
    const requirement =
      toLevel === 2
        ? 'baseline'
        : toLevel === 3
          ? 'decision'
          : toLevel === 4
            ? 'implementation'
            : 'validation';
    const { months, totals } = await monthsOf(tx, row.id);
    const validations = await validationsOf(tx, { initiativeId: row.id });
    return impactDetailSchema.parse({
      months,
      totals,
      validations,
      canRequestValidation:
        this.canLead(scope) &&
        maturity.level === 4 &&
        months.some((month) => month.actual) &&
        !validations.some((entry) => entry.status === 'requested'),
      initiative: { id: row.id, title: row.title, source: row.source, startsOn: row.startsOn },
      impact: await this.setupOf(tx, scope.orgId, impact),
      baselines: baselines.map((entry) => ({
        version: entry.version,
        leverTemplateVersion: entry.leverTemplateVersion,
        inputs: entry.inputs,
        frozenAt: entry.frozenAt.toISOString(),
        frozenByName: entry.frozenByName,
        changeReason: entry.changeReason,
      })),
      maturity,
      next:
        impact && toLevel <= 5
          ? {
              toLevel,
              requirement,
              ready:
                requirement === 'baseline'
                  ? baselines.length > 0
                  : requirement === 'decision'
                    ? await this.planApproved(tx, row.jbpId)
                    : requirement === 'implementation',
              decisions: requirement === 'decision' ? await this.decisions(scope) : [],
            }
          : null,
      canEdit: this.canEdit(scope),
    });
  }

  /** R3: Der Gemeinsame Plan ist freigegeben, sobald eine Version eingefroren ist (JBP-06). */
  private async planApproved(tx: TenantTransaction, jbpId: string) {
    const [version] = await tx
      .select({ id: schema.jbpVersion.id })
      .from(schema.jbpVersion)
      .where(eq(schema.jbpVersion.jbpId, jbpId))
      .limit(1);
    return Boolean(version);
  }

  /** R3: Beschlüsse aus Terminen der Beziehung als Nachweis. */
  private async decisions(scope: ImpactScope) {
    const rows = await scope.tx
      .select({
        id: schema.meetingDecision.id,
        text: schema.meetingDecision.text,
        meeting: schema.meeting.title,
      })
      .from(schema.meetingDecision)
      .innerJoin(schema.meeting, eq(schema.meeting.id, schema.meetingDecision.meetingId))
      .where(eq(schema.meeting.relationshipId, scope.relationshipId))
      .orderBy(desc(schema.meeting.startsAt), asc(schema.meetingDecision.position));
    return rows;
  }

  /** Wirkung einrichten oder ändern. Nur erlaubte Wirkungsarten; nach der Baseline kein Hebelwechsel. */
  async setup(scope: ImpactScope, initiativeId: string, input: SetupImpact) {
    if (!this.canEdit(scope)) throw forbidden();
    if (!allowedEffect(input.lever, input.effectType)) throw invalid('wirkungsart_nicht_erlaubt');
    const { tx } = scope;
    const row = await this.initiative(scope, initiativeId);
    const lines = await this.ensureLines(tx, scope.orgId);
    if (!lines.some((line) => line.key === input.pnlLineKey && line.active)) {
      throw invalid('guv_zeile_unbekannt');
    }
    const before = await this.latestImpact(tx, row.id);
    if (before && before.lever !== input.lever && (await this.baselines(tx, row.id)).length > 0) {
      throw conflict('hebel_nach_baseline');
    }
    const version =
      before?.lever === input.lever
        ? before.leverTemplateVersion
        : leverTemplates[input.lever].version;
    const actor = await actorOf(tx, scope.auth, scope.orgId);
    const values = {
      lever: input.lever,
      leverTemplateVersion: version,
      pnlLineKey: input.pnlLineKey,
      effectType: input.effectType,
      effectiveFrom: input.effectiveFrom,
    };
    await auditedChange(tx, actor, initiativeImpactAudit, async () => {
      if (before) {
        await tx
          .update(schema.initiativeImpact)
          .set({ ...values, updatedAt: new Date() })
          .where(eq(schema.initiativeImpact.id, before.id));
      } else {
        await tx.insert(schema.initiativeImpact).values({
          relationshipId: scope.relationshipId,
          initiativeId: row.id,
          createdBy: scope.auth.userId,
          ...values,
        });
      }
      const snapshot = (entry: typeof values) => ({
        lever: entry.lever,
        lever_template_version: entry.leverTemplateVersion,
        pnl_line_key: entry.pnlLineKey,
        effect_type: entry.effectType,
        effective_from: entry.effectiveFrom,
      });
      return {
        objectId: row.id,
        relationshipId: scope.relationshipId,
        action: before ? ('updated' as const) : ('created' as const),
        before: before
          ? snapshot({
              lever: before.lever as Lever,
              leverTemplateVersion: before.leverTemplateVersion,
              pnlLineKey: before.pnlLineKey,
              effectType: before.effectType as SetupImpact['effectType'],
              effectiveFrom: before.effectiveFrom,
            })
          : null,
        after: snapshot(values),
        result: undefined,
      };
    });
    await recompute(tx, row.id);
    return this.detail(scope, row.id);
  }

  /** Baseline einfrieren: jede Version unveränderbar; ab der zweiten mit Begründung. */
  async freeze(scope: ImpactScope, initiativeId: string, input: FreezeBaseline) {
    if (!this.canEdit(scope)) throw forbidden();
    const { tx } = scope;
    const row = await this.initiative(scope, initiativeId);
    const impact = await this.latestImpact(tx, row.id);
    if (!impact) throw conflict('wirkung_fehlt');
    const template = leverTemplates[impact.lever as Lever];
    const wrong = invalidLeverInputs(input.inputs, template.baseline);
    if (wrong.length > 0) {
      throw new BadRequestException({ statusCode: 400, code: 'eingaben_ungueltig', fields: wrong });
    }
    const previous = await this.baselines(tx, row.id);
    const version = (previous[0]?.version ?? 0) + 1;
    if (version > 1 && !input.changeReason) throw invalid('begruendung_fehlt');
    const actor = await actorOf(tx, scope.auth, scope.orgId);
    const inputs = Object.fromEntries(
      template.baseline.map((field) => [field.key, input.inputs[field.key]]),
    );
    await auditedChange(tx, actor, baselineAudit, async () => {
      await tx.insert(schema.initiativeBaseline).values({
        relationshipId: scope.relationshipId,
        initiativeId: row.id,
        version,
        leverTemplateVersion: impact.leverTemplateVersion,
        inputs,
        frozenBy: scope.auth.userId,
        frozenByName: actor.name,
        changeReason: version > 1 ? input.changeReason : null,
      });
      return {
        objectId: row.id,
        relationshipId: scope.relationshipId,
        action: 'created' as const,
        after: { version, inputs: JSON.stringify(inputs), change_reason: input.changeReason },
        result: undefined,
      };
    });
    // Eine neue Baseline ändert die Beträge offener Monate; freigegebene bleiben (PNL-06).
    await recompute(tx, row.id);
    return this.detail(scope, row.id);
  }

  /**
   * Reifegrad um eine Stufe erhöhen, nur mit Nachweis: R2 eingefrorene Baseline, R3 freigegebener
   * Plan oder Beschluss aus einem Termin, R4 Umsetzungsdatum und Nachweis. R5 nur über PNL-06.
   */
  async raise(scope: ImpactScope, initiativeId: string, input: RaiseMaturity) {
    if (!this.canEdit(scope)) throw forbidden();
    const { tx } = scope;
    const row = await this.initiative(scope, initiativeId);
    const impact = await this.latestImpact(tx, row.id);
    if (!impact) throw conflict('wirkung_fehlt');
    const maturity = await maturityOf(tx, row.id);
    if (input.toLevel !== maturity.level + 1) throw conflict('nur_eine_stufe');
    if (input.toLevel === 5) throw conflict('nur_ueber_freigabe');
    let evidence: string;
    if (input.toLevel === 2) {
      const [baseline] = await this.baselines(tx, row.id);
      if (!baseline) throw conflict('nachweis_fehlt');
      evidence = `Baseline Version ${baseline.version} eingefroren`;
    } else if (input.toLevel === 3) {
      if (input.decisionId) {
        const decision = (await this.decisions(scope)).find(
          (entry) => entry.id === input.decisionId,
        );
        if (!decision) throw conflict('nachweis_fehlt');
        evidence = `Beschluss im Termin „${decision.meeting}“: ${decision.text}`;
      } else if (await this.planApproved(tx, row.jbpId)) {
        evidence = 'Gemeinsamer Plan freigegeben';
      } else {
        throw conflict('nachweis_fehlt');
      }
    } else {
      if (!input.implementedOn || !input.evidence) throw conflict('nachweis_fehlt');
      evidence = `Umgesetzt am ${input.implementedOn}: ${input.evidence}`;
    }
    const actor = await actorOf(tx, scope.auth, scope.orgId);
    await auditedChange(tx, actor, maturityAudit, async () => {
      await tx.insert(schema.maturityStep).values({
        relationshipId: scope.relationshipId,
        ownerOrgId: scope.orgId,
        visibility: 'shared',
        initiativeId: row.id,
        fromLevel: maturity.level,
        toLevel: input.toLevel,
        evidence,
        evidenceLink: input.evidenceLink,
        decidedBy: scope.auth.userId,
        decidedByName: actor.name,
      });
      return {
        objectId: row.id,
        relationshipId: scope.relationshipId,
        action: 'updated' as const,
        before: { level: `R${maturity.level}`, evidence: null },
        after: { level: `R${input.toLevel}`, evidence },
        result: undefined,
      };
    });
    return this.detail(scope, row.id);
  }

  /** Eingaben eines Monats speichern (neue Zeile, die jüngste gilt) und neu rechnen. */
  private async writeMonth(
    scope: ImpactScope,
    initiativeId: string,
    month: string,
    kind: MonthKind,
    inputs: Record<string, string>,
    source: 'manual' | 'csv',
  ) {
    const { tx } = scope;
    const actor = await actorOf(tx, scope.auth, scope.orgId);
    await auditedChange(tx, actor, impactMonthAudit, async () => {
      await tx.insert(schema.initiativeInputMonth).values({
        relationshipId: scope.relationshipId,
        initiativeId,
        month,
        kind,
        inputs,
        source,
        enteredBy: scope.auth.userId,
        enteredByName: actor.name,
      });
      return {
        objectId: initiativeId,
        relationshipId: scope.relationshipId,
        action: 'updated' as const,
        after: { month, kind, inputs: JSON.stringify(inputs), source },
        result: undefined,
      };
    });
  }

  /** Monat erfassen (PNL-05): Felder der Vorlage; gesperrte Monate lehnt die API ab. */
  async saveMonth(scope: ImpactScope, initiativeId: string, input: SaveImpactMonth) {
    if (!this.canEdit(scope)) throw forbidden();
    const { tx } = scope;
    const row = await this.initiative(scope, initiativeId);
    const impact = await this.latestImpact(tx, row.id);
    if (!impact) throw conflict('wirkung_fehlt');
    const fields = leverTemplates[impact.lever as Lever].month;
    const wrong = invalidLeverInputs(input.inputs, fields);
    if (wrong.length > 0) {
      throw new BadRequestException({ statusCode: 400, code: 'eingaben_ungueltig', fields: wrong });
    }
    const month = `${input.month}-01`;
    if (isLocked(await lockedPeriods(tx, row.id), month)) throw conflict('monat_gesperrt');
    const inputs = Object.fromEntries(fields.map((field) => [field.key, input.inputs[field.key]]));
    await this.writeMonth(
      scope,
      row.id,
      month,
      input.kind,
      inputs as Record<string, string>,
      'manual',
    );
    await recompute(tx, row.id);
    return this.detail(scope, row.id);
  }

  /**
   * CSV-Import der Monatswerte (PNL-05): Spalten Monat, Art (Plan oder Ist) und die Eingaben der
   * Vorlage mit ihrem Schlüssel; Geld in Euro. Übernommen wird nur ohne fehlerhafte Zeilen.
   */
  async importMonths(
    scope: ImpactScope,
    initiativeId: string,
    rows: { row: number; values: Record<string, string> }[],
    apply: boolean,
  ): Promise<ImpactImportPreview> {
    if (!this.canEdit(scope)) throw forbidden();
    const { tx } = scope;
    const row = await this.initiative(scope, initiativeId);
    const impact = await this.latestImpact(tx, row.id);
    if (!impact) throw conflict('wirkung_fehlt');
    const fields = leverTemplates[impact.lever as Lever].month;
    const periods = await lockedPeriods(tx, row.id);
    const seen = new Set<string>();
    const kinds: Record<string, MonthKind> = { plan: 'plan', ist: 'actual', actual: 'actual' };
    const result = rows.map(({ row: line, values }) => {
      const normalized = Object.fromEntries(
        Object.entries(values).map(([key, value]) => [normalizeHeader(key), value.trim()]),
      );
      const month = parseKpiMonth(normalized.monat ?? normalized.month ?? '');
      const kindText = (normalized.art ?? normalized.kind ?? '').toLocaleLowerCase('de');
      const kind = kinds[kindText];
      const inputs: Record<string, string> = {};
      const bad: string[] = [];
      for (const field of fields) {
        const raw = normalized[normalizeHeader(field.key)] ?? '';
        const value =
          field.kind === 'money' ? parseEuroToCents(raw, 'de')?.toString() : parseKpiNumber(raw);
        if (value === undefined || value === null) bad.push(field.key);
        else inputs[field.key] = value;
      }
      const errors: ImpactImportPreview['rows'][number]['errors'] = [];
      if (!month) errors.push('monat_ungueltig');
      if (!kind) errors.push('art_ungueltig');
      if (bad.length > 0) errors.push('eingabe_ungueltig');
      if (month && isLocked(periods, month)) errors.push('monat_gesperrt');
      const key = `${month}|${kind}`;
      if (errors.length === 0 && seen.has(key)) errors.push('doppelt');
      if (errors.length === 0) seen.add(key);
      return {
        row: line,
        month: month ?? normalized.monat ?? normalized.month ?? '',
        kind: kind ?? kindText,
        inputs,
        errors,
        fields: bad,
      };
    });
    const invalid = result.filter((entry) => entry.errors.length > 0).length;
    const preview = impactImportPreviewSchema.parse({
      rows: result,
      valid: result.length - invalid,
      invalid,
    });
    if (!apply) return preview;
    if (invalid > 0) {
      throw new BadRequestException({ statusCode: 400, code: 'import_fehlerhaft', preview });
    }
    for (const entry of result) {
      await this.writeMonth(
        scope,
        row.id,
        entry.month,
        entry.kind as MonthKind,
        entry.inputs,
        'csv',
      );
    }
    await recompute(tx, row.id);
    return preview;
  }

  /**
   * Freigabe anfordern (PNL-06): SRO oder Admin, ab R4, mit Ist-Werten im Zeitraum. Controlling
   * bekommt eine Mail und die Aufgabe auf Start.
   */
  async requestValidation(scope: ImpactScope, initiativeId: string, input: RequestValidation) {
    if (!this.canLead(scope)) throw forbidden();
    const { tx } = scope;
    const row = await this.initiative(scope, initiativeId);
    const maturity = await maturityOf(tx, row.id);
    if (maturity.level !== 4) throw conflict('erst_ab_r4');
    const period = { from: `${input.periodFrom}-01`, to: `${input.periodTo}-01` };
    const { months } = await monthsOf(tx, row.id, period);
    if (!months.some((month) => month.actual)) throw conflict('keine_ist_werte');
    const open = await validationsOf(tx, { initiativeId: row.id, status: 'requested' });
    if (open.length > 0) throw conflict('freigabe_offen');
    const actor = await actorOf(tx, scope.auth, scope.orgId);
    const [created] = await tx
      .insert(schema.initiativeValidation)
      .values({
        relationshipId: scope.relationshipId,
        initiativeId: row.id,
        periodFrom: period.from,
        periodTo: period.to,
        requestedBy: scope.auth.userId,
        requestedByName: actor.name,
      })
      .returning({ id: schema.initiativeValidation.id });
    const controllers = await tx
      .select({
        id: schema.appUser.id,
        email: schema.appUser.email,
        name: schema.appUser.name,
        locale: schema.appUser.locale,
      })
      .from(schema.appUser)
      .where(
        and(eq(schema.appUser.organizationId, scope.orgId), eq(schema.appUser.isControlling, true)),
      );
    for (const person of controllers) {
      if (!person.email) continue;
      await auditedChange(tx, actor, validationAudit, async () => ({
        objectId: `${created?.id}:${person.id}`,
        relationshipId: scope.relationshipId,
        action: 'created' as const,
        after: { status: 'requested', period: `${input.periodFrom} – ${input.periodTo}` },
        result: undefined,
        email: this.email.prepare({
          recipient: person.email,
          template: 'approval',
          locale: person.locale ?? 'de',
          firstName: person.name.split(' ')[0] ?? person.name,
          title: `Wirkung ${row.title}`,
          link: `/wirkung/freigaben/${created?.id}`,
        }),
      }));
    }
    return this.detail(scope, row.id);
  }

  /** GuV-Zeilen der Organisation (Einstellungen); ändern darf nur der Admin. */
  lines(auth: AuthContext): Promise<PnlLines> {
    const organization = auth.organization;
    if (!organization?.buyer) throw forbidden();
    return this.tenant.run({ userId: auth.userId, organizationId: organization.id }, async (tx) =>
      pnlLinesSchema.parse({
        lines: (await this.ensureLines(tx, organization.id)).map(
          ({ key, name, position, active }) => ({
            key,
            name,
            position,
            active,
          }),
        ),
        canManage: can(auth, 'einstellungen.verwalten'),
      }),
    );
  }

  saveLine(auth: AuthContext, key: string | null, input: SavePnlLine): Promise<PnlLines> {
    const organization = auth.organization;
    if (!organization?.buyer || !can(auth, 'einstellungen.verwalten')) throw forbidden();
    return this.tenant
      .run({ userId: auth.userId, organizationId: organization.id }, async (tx) => {
        const lines = await this.ensureLines(tx, organization.id);
        const before = key ? lines.find((line) => line.key === key) : undefined;
        if (key && !before) throw notFound();
        const newKey = key ?? input.key;
        if (!newKey) throw invalid('schluessel_fehlt');
        if (!key && lines.some((line) => line.key === newKey))
          throw conflict('schluessel_vergeben');
        const actor = await actorOf(tx, auth, organization.id);
        await auditedChange(tx, actor, pnlLineAudit, async () => {
          if (before) {
            await tx
              .update(schema.pnlLine)
              .set({ name: input.name, position: input.position, active: input.active })
              .where(eq(schema.pnlLine.id, before.id));
          } else {
            await tx.insert(schema.pnlLine).values({
              orgId: organization.id,
              key: newKey,
              name: input.name,
              position: input.position,
              active: input.active,
            });
          }
          return {
            objectId: organization.id,
            relationshipId: null,
            action: before ? ('updated' as const) : ('created' as const),
            before: before
              ? {
                  key: before.key,
                  name: before.name,
                  position: before.position,
                  active: before.active,
                }
              : null,
            after: {
              key: newKey,
              name: input.name,
              position: input.position,
              active: input.active,
            },
            result: undefined,
          };
        });
      })
      .then(() => this.lines(auth));
  }
}
