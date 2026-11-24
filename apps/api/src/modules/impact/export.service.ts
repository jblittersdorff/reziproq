import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import {
  and,
  asc,
  currentTime,
  desc,
  eq,
  inArray,
  schema,
  type TenantTransaction,
} from '@reziproq/db';
import {
  amountInRange,
  effectTypes,
  fiscalYearOf,
  fiscalYearRange,
  type ImpactView,
} from '@reziproq/shared';
import ExcelJS from 'exceljs';
import { TenantDatabase } from '../../common/database.module.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { can } from '../auth/can.js';
import {
  factsOf,
  focusRelationships,
  type InitiativeFacts,
  PortfolioService,
  pipelineOf,
  rangeOf,
} from './portfolio.service.js';

const forbidden = () => new ForbiddenException({ statusCode: 403, code: 'keine_berechtigung' });

const effectNames: Record<string, string> = {
  ebit: 'EBIT',
  cost_avoidance: 'Kostenvermeidung',
  cash: 'Cash',
  strategic: 'Strategisch',
};
const leverNames: Record<string, string> = {
  price: 'Preis',
  cost_avoidance: 'Kostenvermeidung',
  quality: 'Qualität',
  logistics: 'Logistik',
  working_capital: 'Working Capital',
  innovation: 'Innovation',
  risk: 'Risiko',
};
/** Euro mit zwei Nachkommastellen; intern bleiben die Beträge Cent. */
const euro = (cents: number) => Math.round(cents) / 100;
const euroFormat = '#,##0.00 "€"';
const inputsText = (inputs: unknown) =>
  Object.entries((inputs ?? {}) as Record<string, unknown>)
    // Feste Reihenfolge; jsonb sortiert die Schlüssel sonst nach Länge.
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${String(value)}`)
    .join('; ');
const date = (value: Date | string | null) =>
  value === null ? '' : (typeof value === 'string' ? value : value.toISOString()).slice(0, 10);

export interface ExportSelection {
  view: ImpactView;
  fiscalYear?: number | undefined;
  businessUnitId?: string | undefined;
  /** Nur diese Beziehung (Lieferant › Wirkung) */
  relationshipId?: string | undefined;
}

/**
 * PNL-11: Excel-Export für das Controlling. Controlling und Admins bekommen die ganze Auswahl, ein
 * SRO nur seine Beziehungen. Jede Zahl lässt sich mit Rechenweg und Baseline nachrechnen; es gibt
 * nirgends eine Summe über Wirkungsarten.
 */
@Injectable()
export class ExportService {
  constructor(
    @Inject(TenantDatabase) private readonly tenant: TenantDatabase,
    @Inject(PortfolioService) private readonly portfolio: PortfolioService,
  ) {}

  async export(auth: AuthContext, selection: ExportSelection) {
    const organization = auth.organization;
    if (!organization?.buyer || !can(auth, 'wirkung.sehen')) throw forbidden();
    return this.tenant.run({ userId: auth.userId, organizationId: organization.id }, async (tx) => {
      const startMonth = await this.portfolio.startMonth(tx, organization.id);
      const fiscalYear =
        selection.fiscalYear ?? fiscalYearOf(currentTime().toISOString().slice(0, 10), startMonth);
      const relationships = await this.scope(tx, auth, organization.id, selection);
      const facts = await factsOf(
        tx,
        relationships.map((entry) => entry.id),
        true,
      );
      const names = new Map(relationships.map((entry) => [entry.id, entry.name]));
      const workbook = await this.workbook(tx, organization.id, facts, names, {
        view: selection.view,
        fiscalYear,
        startMonth,
      });
      const label =
        selection.relationshipId && relationships[0]
          ? relationships[0].name
          : selection.view === 'geschaeftsjahr'
            ? `GJ ${fiscalYear}`
            : 'Jahreswirkung';
      const fileName =
        `Wirkung ${organization.name} ${label} ${currentTime().toISOString().slice(0, 10)}.xlsx`
          .replace(/[^\p{L}\p{N} ._-]/gu, '')
          .replace(/\s+/g, '_');
      return { fileName, buffer: Buffer.from(await workbook.xlsx.writeBuffer()) };
    });
  }

  /** Beziehungen der Auswahl; ohne Controlling oder Admin nur die, in denen die Person SRO ist. */
  private async scope(
    tx: TenantTransaction,
    auth: AuthContext,
    orgId: string,
    selection: ExportSelection,
  ) {
    let relationships = await focusRelationships(tx, orgId);
    if (selection.relationshipId) {
      const all = await tx
        .select({ id: schema.relationship.id, name: schema.organization.name })
        .from(schema.relationship)
        .innerJoin(
          schema.organization,
          eq(schema.organization.id, schema.relationship.supplierOrgId),
        )
        .where(
          and(
            eq(schema.relationship.id, selection.relationshipId),
            eq(schema.relationship.buyerOrgId, orgId),
          ),
        );
      const known = relationships.find((entry) => entry.id === selection.relationshipId);
      relationships = known ? [known] : all;
    }
    if (selection.businessUnitId) {
      const assigned = await tx
        .select({ relationshipId: schema.relationshipBusinessUnit.relationshipId })
        .from(schema.relationshipBusinessUnit)
        .where(eq(schema.relationshipBusinessUnit.businessUnitId, selection.businessUnitId));
      const ids = new Set(assigned.map((row) => row.relationshipId));
      relationships = relationships.filter((entry) => ids.has(entry.id));
    }
    if (auth.isControlling || auth.orgRole === 'admin') return relationships;
    const own = await tx
      .select({ relationshipId: schema.relationshipMember.relationshipId })
      .from(schema.relationshipMember)
      .where(
        and(
          eq(schema.relationshipMember.userId, auth.userId),
          eq(schema.relationshipMember.orgId, orgId),
          eq(schema.relationshipMember.teamRole, 'sro'),
        ),
      );
    if (own.length === 0) throw forbidden();
    const ids = new Set(own.map((row) => row.relationshipId));
    return relationships.filter((entry) => ids.has(entry.id));
  }

  private async workbook(
    tx: TenantTransaction,
    orgId: string,
    allFacts: InitiativeFacts[],
    names: Map<string, string>,
    window: { view: ImpactView; fiscalYear: number; startMonth: number },
  ) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Reziproq';
    const facts = allFacts.filter((fact) => fact.effectType);
    const counted = facts.filter((fact) => !fact.excluded);
    const ids = facts.map((fact) => fact.id);
    const amount = (fact: InitiativeFacts, year = window.fiscalYear) =>
      amountInRange(fact.values, ...rangeOf(fact, window.view, year, window.startMonth));
    const header = (
      sheet: ExcelJS.Worksheet,
      columns: { header: string; key: string; width: number; money?: boolean }[],
    ) => {
      sheet.columns = columns.map(({ header, key, width }) => ({ header, key, width }));
      sheet.getRow(1).font = { bold: true };
      for (const column of columns) {
        if (column.money) sheet.getColumn(column.key).numFmt = euroFormat;
      }
    };

    // Übersicht: je Wirkungsart eine Zeile; nie eine Summe über Arten (keine Gesamtzeile).
    const overview = workbook.addWorksheet('Übersicht');
    overview.addRow([
      window.view === 'geschaeftsjahr'
        ? `Wirkung im Geschäftsjahr ab ${window.fiscalYear}-${String(window.startMonth).padStart(2, '0')}`
        : 'Jahreswirkung: zwölf Monate ab Wirkungsbeginn',
    ]);
    overview.addRow([
      'Je Monat das Ist, wo es eines gibt, sonst der Plan. Ohne Initiativen im Savings-Tracking.',
    ]);
    overview.addRow([]);
    const levelHeader = overview.addRow(['Wirkungsart', 'R1', 'R2', 'R3', 'R4', 'R5']);
    levelHeader.font = { bold: true };
    for (const entry of pipelineOf(counted, (fact) => amount(fact))) {
      const row = overview.addRow([
        effectNames[entry.effectType],
        ...entry.levels.map((level) => euro(level.amountCents)),
      ]);
      for (let column = 2; column <= 6; column++) row.getCell(column).numFmt = euroFormat;
    }
    overview.addRow([]);
    const years = [window.fiscalYear - 1, window.fiscalYear, window.fiscalYear + 1];
    const yearHeader = overview.addRow(['Wirkungsart', ...years.map((year) => `GJ ab ${year}`)]);
    yearHeader.font = { bold: true };
    for (const effectType of effectTypes) {
      const ofType = counted.filter((fact) => fact.effectType === effectType);
      if (ofType.length === 0) continue;
      const row = overview.addRow([
        effectNames[effectType],
        ...years.map((year) =>
          euro(
            ofType.reduce(
              (sum, fact) =>
                sum + amountInRange(fact.values, ...fiscalYearRange(year, window.startMonth)),
              0,
            ),
          ),
        ),
      ]);
      for (let column = 2; column <= 4; column++) row.getCell(column).numFmt = euroFormat;
    }
    overview.getColumn(1).width = 28;
    for (let column = 2; column <= 6; column++) overview.getColumn(column).width = 16;

    const impacts = ids.length
      ? await tx
          .select()
          .from(schema.initiativeImpact)
          .where(inArray(schema.initiativeImpact.initiativeId, ids))
          .orderBy(desc(schema.initiativeImpact.updatedAt))
      : [];
    const lines = await tx
      .select({ key: schema.pnlLine.key, name: schema.pnlLine.name })
      .from(schema.pnlLine)
      .where(eq(schema.pnlLine.orgId, orgId));
    const references = ids.length
      ? await tx
          .select()
          .from(schema.savingsReference)
          .where(inArray(schema.savingsReference.initiativeId, ids))
      : [];
    const impactOf = (id: string) => impacts.find((row) => row.initiativeId === id);

    const initiatives = workbook.addWorksheet('Initiativen');
    header(initiatives, [
      { header: 'Beziehung', key: 'relationship', width: 30 },
      { header: 'Initiative', key: 'initiative', width: 32 },
      { header: 'Hebel', key: 'lever', width: 18 },
      { header: 'GuV-Zeile', key: 'line', width: 26 },
      { header: 'Wirkungsart', key: 'effect', width: 16 },
      { header: 'Reifegrad', key: 'maturity', width: 10 },
      { header: 'Savings-Referenz', key: 'reference', width: 24 },
      { header: 'Wirkung im Zeitraum', key: 'amount', width: 18, money: true },
    ]);
    for (const fact of facts) {
      const impact = impactOf(fact.id);
      const reference = references.find((row) => row.initiativeId === fact.id);
      initiatives.addRow({
        relationship: names.get(fact.relationshipId) ?? '',
        initiative: fact.title,
        lever: impact ? (leverNames[impact.lever] ?? impact.lever) : '',
        line: impact
          ? (lines.find((line) => line.key === impact.pnlLineKey)?.name ?? impact.pnlLineKey)
          : '',
        effect: fact.effectType ? effectNames[fact.effectType] : '',
        maturity: `R${fact.maturity}`,
        reference: reference ? `${reference.system} ${reference.reference} (zählt nicht)` : '',
        amount: euro(amount(fact)),
      });
    }

    const months = workbook.addWorksheet('Monatswerte');
    header(months, [
      { header: 'Beziehung', key: 'relationship', width: 30 },
      { header: 'Initiative', key: 'initiative', width: 32 },
      { header: 'Wirkungsart', key: 'effect', width: 16 },
      { header: 'Monat', key: 'month', width: 12 },
      { header: 'Art', key: 'kind', width: 8 },
      { header: 'Betrag', key: 'amount', width: 16, money: true },
    ]);
    for (const fact of facts) {
      for (const value of [...fact.values].sort(
        (a, b) => a.month.localeCompare(b.month) || a.kind.localeCompare(b.kind),
      )) {
        months.addRow({
          relationship: names.get(fact.relationshipId) ?? '',
          initiative: fact.title,
          effect: fact.effectType ? effectNames[fact.effectType] : '',
          month: value.month.slice(0, 7),
          kind: value.kind === 'actual' ? 'Ist' : 'Plan',
          amount: euro(value.valueCents),
        });
      }
    }

    // Rechenweg: Regel mit Version und die Eingaben je Monat (jüngste Eingabe je Monat und Art).
    const inputs = ids.length
      ? await tx
          .select()
          .from(schema.initiativeInputMonth)
          .where(inArray(schema.initiativeInputMonth.initiativeId, ids))
          .orderBy(
            asc(schema.initiativeInputMonth.month),
            desc(schema.initiativeInputMonth.enteredAt),
          )
      : [];
    const steps = workbook.addWorksheet('Rechenweg');
    header(steps, [
      { header: 'Initiative', key: 'initiative', width: 32 },
      { header: 'Rechenregel', key: 'lever', width: 18 },
      { header: 'Version', key: 'version', width: 9 },
      { header: 'Monat', key: 'month', width: 12 },
      { header: 'Art', key: 'kind', width: 8 },
      { header: 'Eingaben', key: 'inputs', width: 44 },
      { header: 'Erfasst von', key: 'by', width: 20 },
      { header: 'Betrag', key: 'amount', width: 16, money: true },
    ]);
    const seen = new Set<string>();
    for (const input of inputs) {
      const key = `${input.initiativeId}:${input.month}:${input.kind}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const fact = facts.find((entry) => entry.id === input.initiativeId);
      const impact = impactOf(input.initiativeId);
      const value = fact?.values.find(
        (entry) => entry.month === input.month && entry.kind === input.kind,
      );
      steps.addRow({
        initiative: fact?.title ?? '',
        lever: impact ? (leverNames[impact.lever] ?? impact.lever) : '',
        version: impact?.leverTemplateVersion ?? '',
        month: input.month.slice(0, 7),
        kind: input.kind === 'actual' ? 'Ist' : 'Plan',
        inputs: inputsText(input.inputs),
        by: input.enteredByName,
        amount: value ? euro(value.valueCents) : null,
      });
    }

    const baselines = ids.length
      ? await tx
          .select()
          .from(schema.initiativeBaseline)
          .where(inArray(schema.initiativeBaseline.initiativeId, ids))
          .orderBy(
            asc(schema.initiativeBaseline.initiativeId),
            asc(schema.initiativeBaseline.version),
          )
      : [];
    const baselineSheet = workbook.addWorksheet('Baseline');
    header(baselineSheet, [
      { header: 'Initiative', key: 'initiative', width: 32 },
      { header: 'Version', key: 'version', width: 9 },
      { header: 'Regelversion', key: 'leverVersion', width: 12 },
      { header: 'Eingaben', key: 'inputs', width: 44 },
      { header: 'Eingefroren am', key: 'date', width: 14 },
      { header: 'Von', key: 'by', width: 20 },
      { header: 'Begründung', key: 'reason', width: 40 },
    ]);
    for (const baseline of baselines) {
      baselineSheet.addRow({
        initiative: facts.find((fact) => fact.id === baseline.initiativeId)?.title ?? '',
        version: baseline.version,
        leverVersion: baseline.leverTemplateVersion,
        inputs: inputsText(baseline.inputs),
        date: date(baseline.frozenAt),
        by: baseline.frozenByName,
        reason: baseline.changeReason ?? '',
      });
    }

    const validations = ids.length
      ? await tx
          .select()
          .from(schema.initiativeValidation)
          .where(inArray(schema.initiativeValidation.initiativeId, ids))
          .orderBy(asc(schema.initiativeValidation.periodFrom))
      : [];
    const validationSheet = workbook.addWorksheet('Freigaben');
    header(validationSheet, [
      { header: 'Initiative', key: 'initiative', width: 32 },
      { header: 'Von', key: 'from', width: 12 },
      { header: 'Bis', key: 'to', width: 12 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Angefordert von', key: 'requestedBy', width: 20 },
      { header: 'Angefordert am', key: 'requestedAt', width: 14 },
      { header: 'Entschieden von', key: 'decidedBy', width: 20 },
      { header: 'Entschieden am', key: 'decidedAt', width: 14 },
      { header: 'Kommentar', key: 'comment', width: 40 },
    ]);
    const statusNames: Record<string, string> = {
      requested: 'angefragt',
      approved: 'freigegeben',
      rejected: 'zurückgewiesen',
    };
    for (const validation of validations) {
      validationSheet.addRow({
        initiative: facts.find((fact) => fact.id === validation.initiativeId)?.title ?? '',
        from: validation.periodFrom,
        to: validation.periodTo,
        status: statusNames[validation.status] ?? validation.status,
        requestedBy: validation.requestedByName,
        requestedAt: date(validation.requestedAt),
        decidedBy: validation.decidedByName ?? '',
        decidedAt: date(validation.decidedAt),
        comment: validation.comment ?? '',
      });
    }
    return workbook;
  }
}
