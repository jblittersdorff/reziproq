import { and, desc, eq, ne, sql } from 'drizzle-orm';
import type { Database } from './client.js';
import * as schema from './schema/index.js';
import { seedBuyers, seedSupplierOrg } from './seed.js';

type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

export interface DemoStoryResult {
  created: boolean;
  relationships: string[];
}

const pad = (value: number) => String(value).padStart(2, '0');
const isoDay = (date: Date) => date.toISOString().slice(0, 10);
const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

/**
 * pnpm demo:setup: eine zusammenhängende Geschichte für den Test-OEM, damit jede Seite Inhalt hat.
 * Zwei Fokuslieferanten (der Test-Lieferant und der mit dem größten Spend) mit Gemeinsamem Plan,
 * Initiativen und vom Controlling bestätigten Monaten, Zusagen, Scorecard mit einer Kennzahl hinter
 * Plan, einem QBR in sieben Tagen, Jahresziel und Ziel je Lieferant. Läuft nur einmal: Hat der
 * Test-Lieferant schon einen Gemeinsamen Plan, bleibt alles, wie es ist.
 */
export async function demoStory(
  tx: Transaction,
  account: { id: string; name: string },
  today = new Date(),
): Promise<DemoStoryResult> {
  const oem = seedBuyers.testOem.id;
  const [first] = await tx
    .select({ id: schema.relationship.id })
    .from(schema.relationship)
    .where(
      and(
        eq(schema.relationship.buyerOrgId, oem),
        eq(schema.relationship.supplierOrgId, seedSupplierOrg.id),
      ),
    );
  if (!first) return { created: false, relationships: [] };
  const [second] = await tx
    .select({ id: schema.relationship.id })
    .from(schema.relationship)
    .innerJoin(
      schema.relationshipSpend,
      eq(schema.relationshipSpend.relationshipId, schema.relationship.id),
    )
    .where(and(eq(schema.relationship.buyerOrgId, oem), ne(schema.relationship.id, first.id)))
    .groupBy(schema.relationship.id)
    .orderBy(desc(sql`sum(${schema.relationshipSpend.amountCents})`))
    .limit(1);
  const relationships = [first.id, ...(second ? [second.id] : [])];
  const [existing] = await tx
    .select({ id: schema.jbp.id })
    .from(schema.jbp)
    .where(eq(schema.jbp.relationshipId, first.id));
  if (existing) {
    await demoEarlyWarning(tx, first.id, account, today);
    await demoBriefing(tx, first.id, account);
    return { created: false, relationships };
  }

  const who = { createdBy: account.id, createdByName: account.name };
  const year = today.getUTCFullYear();
  const month = today.getUTCMonth() + 1;

  // Fokus und aktiv
  for (const relationshipId of relationships) {
    await tx
      .update(schema.relationship)
      .set({ status: 'active' })
      .where(eq(schema.relationship.id, relationshipId));
    await tx
      .insert(schema.relationshipSide)
      .values({
        relationshipId,
        orgId: oem,
        isFocus: true,
        focusReason: 'Demo: strategisch wichtig',
      })
      .onConflictDoUpdate({
        target: [schema.relationshipSide.relationshipId, schema.relationshipSide.orgId],
        set: { isFocus: true, focusReason: 'Demo: strategisch wichtig' },
      });
  }

  // Spend beim Test-Lieferanten, falls die Beispieldaten keinen haben (Grundlage der Wertpotenziale)
  const [spend] = await tx
    .select({ id: schema.relationshipSpend.id })
    .from(schema.relationshipSpend)
    .where(eq(schema.relationshipSpend.relationshipId, first.id))
    .limit(1);
  if (!spend) {
    await tx.insert(schema.relationshipSpend).values([
      { relationshipId: first.id, year: year - 1, amountCents: 240_000_000 },
      { relationshipId: first.id, year, amountCents: 210_000_000 },
    ]);
  }

  // Gemeinsame Pläne: beim Test-Lieferanten freigegeben, beim zweiten noch Entwurf
  const plans = new Map<string, string>();
  for (const [index, relationshipId] of relationships.entries()) {
    const [plan] = await tx
      .insert(schema.jbp)
      .values({
        relationshipId,
        ownerOrgId: oem,
        status: index === 0 ? 'approved' : 'draft',
        ...who,
      })
      .returning({ id: schema.jbp.id });
    if (plan) plans.set(relationshipId, plan.id);
  }

  // Initiativen mit Monatswerten; das Controlling hat die Monate bis zum letzten Quartalsende bestätigt
  const lastMonth = Math.max(1, month - 1);
  const confirmedUntil = Math.max(1, Math.floor((month - 1) / 3) * 3);
  const initiatives = [
    { relationshipId: first.id, title: 'Kupferklausel', perMonth: 3_000_000, effectType: 'ebit' },
    ...(second
      ? [
          {
            relationshipId: second.id,
            title: 'Logistik bündeln',
            perMonth: 1_500_000,
            effectType: 'ebit',
          },
          {
            relationshipId: second.id,
            title: 'Konsignationslager',
            perMonth: 0,
            effectType: 'cash',
          },
        ]
      : []),
  ];
  for (const entry of initiatives) {
    const jbpId = plans.get(entry.relationshipId);
    if (!jbpId) continue;
    const [initiative] = await tx
      .insert(schema.initiative)
      .values({
        relationshipId: entry.relationshipId,
        ownerOrgId: oem,
        jbpId,
        title: entry.title,
        goal: `${entry.title} gemeinsam umsetzen`,
        benefitBuyer: 'Geringere Kosten',
        benefitSupplier: 'Planbarkeit',
        ownerBuyerName: account.name,
        ownerSupplierName: 'Key Account',
        startsOn: `${year}-01-01`,
        endsOn: `${year}-12-31`,
        ...who,
      })
      .returning({ id: schema.initiative.id });
    if (!initiative) continue;
    const value = (m: number, kind: 'plan' | 'actual', valueCents: number) => ({
      relationshipId: entry.relationshipId,
      ownerOrgId: oem,
      visibility: 'internal' as const,
      initiativeId: initiative.id,
      month: `${year}-${pad(m)}-01`,
      kind,
      valueCents,
      effectType: entry.effectType,
    });
    if (entry.effectType === 'cash') {
      await tx.insert(schema.initiativeValue).values(value(12, 'plan', 8_000_000));
      continue;
    }
    const rows = [];
    for (let m = 1; m <= lastMonth; m += 1) rows.push(value(m, 'actual', entry.perMonth));
    for (let m = lastMonth + 1; m <= 12; m += 1) rows.push(value(m, 'plan', entry.perMonth));
    await tx.insert(schema.initiativeValue).values(rows);
    if (confirmedUntil >= 3) {
      await tx.insert(schema.initiativeValidation).values({
        relationshipId: entry.relationshipId,
        initiativeId: initiative.id,
        periodFrom: `${year}-01-01`,
        periodTo: isoDay(new Date(Date.UTC(year, confirmedUntil, 0))),
        status: 'approved',
        requestedBy: account.id,
        requestedByName: account.name,
        decidedBy: account.id,
        decidedByName: account.name,
        decidedAt: today,
      });
    }
  }

  // Zusagen beim Test-Lieferanten: eingehalten, überfällig, bis zum QBR fällig, später
  const firstPlan = plans.get(first.id) as string;
  const commitment = (
    title: string,
    dueOn: Date,
    side: 'buyer' | 'supplier',
    status: 'open' | 'kept',
  ) => ({
    relationshipId: first.id,
    ownerOrgId: oem,
    jbpId: firstPlan,
    side,
    title,
    ownerName: side === 'buyer' ? account.name : 'Key Account',
    dueOn: isoDay(dueOn),
    status,
    ...who,
  });
  await tx
    .insert(schema.commitment)
    .values([
      commitment('Rahmenvertrag verlängern', addDays(today, -60), 'buyer', 'kept'),
      commitment('Forecast für sechs Monate teilen', addDays(today, -5), 'buyer', 'open'),
      commitment('Kapazitätsplan 2027 liefern', addDays(today, 3), 'supplier', 'open'),
      commitment('Zweitquelle für Gehäuse prüfen', addDays(today, 40), 'supplier', 'open'),
    ]);

  // Scorecard: Liefertreue hinter Plan, Reklamationen auf Kurs
  const [scorecard] = await tx
    .insert(schema.scorecard)
    .values({ relationshipId: first.id, ownerOrgId: oem, jbpId: firstPlan })
    .returning({ id: schema.scorecard.id });
  if (scorecard) {
    const kpis = [
      {
        name: 'Liefertreue',
        unit: '%',
        direction: 'higher' as const,
        baseline: '88',
        target: '97',
        latest: '89',
      },
      {
        name: 'Reklamationen',
        unit: 'ppm',
        direction: 'lower' as const,
        baseline: '1200',
        target: '600',
        latest: '700',
      },
    ];
    for (const kpi of kpis) {
      const [row] = await tx
        .insert(schema.scorecardKpi)
        .values({
          relationshipId: first.id,
          ownerOrgId: oem,
          scorecardId: scorecard.id,
          name: kpi.name,
          unit: kpi.unit,
          direction: kpi.direction,
          baseline: kpi.baseline,
          target: kpi.target,
          targetDate: `${year}-12-31`,
          ownerSide: 'supplier',
          ownerName: 'Key Account',
          benefitFor: 'both',
          createdAt: new Date(Date.UTC(year, 0, 15)),
        })
        .returning({ id: schema.scorecardKpi.id });
      if (!row) continue;
      await tx.insert(schema.kpiValue).values({
        relationshipId: first.id,
        ownerOrgId: oem,
        kpiId: row.id,
        period: `${year}-${pad(lastMonth)}-01`,
        value: kpi.latest,
        source: 'manual',
        enteredBy: account.id,
        enteredByName: account.name,
      });
    }
  }

  // QBR in sieben Tagen
  const qbr = addDays(today, 7);
  qbr.setUTCHours(9, 0, 0, 0);
  await tx.insert(schema.meeting).values({
    relationshipId: first.id,
    ownerOrgId: oem,
    type: 'quarterly_review',
    title: 'Quartalsreview',
    startsAt: qbr,
    ...who,
  });

  // Jahresziel, Ziel des Test-Lieferanten, öffentliche Recherche (lokal mit Testquellen)
  const settings = [
    { key: 'goal_ebit_year' as const, value: { [String(year)]: 60_000_000 } },
    { key: 'ai_public_research' as const, value: true },
  ];
  for (const setting of settings) {
    await tx
      .insert(schema.orgSetting)
      .values({ orgId: oem, key: setting.key, value: setting.value, updatedBy: account.id })
      .onConflictDoUpdate({
        target: [schema.orgSetting.orgId, schema.orgSetting.key],
        set: { value: setting.value, updatedBy: account.id },
      });
  }
  await tx
    .insert(schema.relationshipEbitTarget)
    .values({
      orgId: oem,
      relationshipId: first.id,
      year,
      ebitTargetCents: 40_000_000,
      proposedBy: account.id,
      approvedBy: account.id,
      approvedAt: today,
    })
    .onConflictDoNothing();
  await demoEarlyWarning(tx, first.id, account, today);
  await demoBriefing(tx, first.id, account);
  return { created: true, relationships };
}

/**
 * KI-07: Der Quartalsreview in sieben Tagen bekommt Dauer und Teilnehmer beider Seiten, damit das
 * Termin-Briefing eine Agenda mit Zeiten und „Wer führt“ zeigt. Ergänzt nur, was fehlt.
 */
async function demoBriefing(
  tx: Transaction,
  relationshipId: string,
  account: { id: string; name: string },
) {
  const oem = seedBuyers.testOem.id;
  const [qbr] = await tx
    .select({ id: schema.meeting.id })
    .from(schema.meeting)
    .where(
      and(
        eq(schema.meeting.relationshipId, relationshipId),
        eq(schema.meeting.type, 'quarterly_review'),
        eq(schema.meeting.status, 'planned'),
      ),
    )
    .orderBy(desc(schema.meeting.startsAt))
    .limit(1);
  if (!qbr) return;
  const present = await tx
    .select({ id: schema.meetingParticipant.id })
    .from(schema.meetingParticipant)
    .where(eq(schema.meetingParticipant.meetingId, qbr.id));
  if (present.length > 0) return;
  await tx.update(schema.meeting).set({ durationMinutes: 90 }).where(eq(schema.meeting.id, qbr.id));
  const participant = (name: string, ownerOrgId: string, position: number) => ({
    meetingId: qbr.id,
    relationshipId,
    ownerOrgId,
    visibility: 'shared' as const,
    name,
    position,
  });
  await tx
    .insert(schema.meetingParticipant)
    .values([
      participant(account.name, oem, 1),
      participant('Key Account', seedSupplierOrg.id, 1),
      participant('Qualitätsleitung', seedSupplierOrg.id, 2),
    ]);
}

/**
 * KI-16: Frühwarnung sichtbar machen, auch in einer schon angelegten Geschichte. Die Liefertreue des
 * Test-Lieferanten liegt drei Monate in Folge unter Ziel und fällt; eine Zusage des Lieferanten ist
 * drei Wochen überfällig. Ergänzt nur, was fehlt; ein zweiter Aufruf ändert nichts.
 */
async function demoEarlyWarning(
  tx: Transaction,
  relationshipId: string,
  account: { id: string; name: string },
  today: Date,
) {
  const oem = seedBuyers.testOem.id;
  const [kpi] = await tx
    .select({ id: schema.scorecardKpi.id, scorecardId: schema.scorecardKpi.scorecardId })
    .from(schema.scorecardKpi)
    .where(
      and(
        eq(schema.scorecardKpi.relationshipId, relationshipId),
        eq(schema.scorecardKpi.name, 'Liefertreue'),
      ),
    );
  if (kpi) {
    const existing = await tx
      .select({ period: schema.kpiValue.period })
      .from(schema.kpiValue)
      .where(eq(schema.kpiValue.kpiId, kpi.id));
    const values = ['89', '91', '93'];
    for (const [index, value] of values.entries()) {
      const month = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1 - index, 1));
      const period = isoDay(month);
      if (existing.some((row) => row.period === period)) continue;
      await tx.insert(schema.kpiValue).values({
        relationshipId,
        ownerOrgId: oem,
        kpiId: kpi.id,
        period,
        value,
        source: 'manual',
        enteredBy: account.id,
        enteredByName: account.name,
      });
    }
  }
  const title = 'Liefertreue-Bericht des Vormonats';
  const [plan] = await tx
    .select({ id: schema.jbp.id })
    .from(schema.jbp)
    .where(eq(schema.jbp.relationshipId, relationshipId));
  const [present] = await tx
    .select({ id: schema.commitment.id })
    .from(schema.commitment)
    .where(
      and(eq(schema.commitment.relationshipId, relationshipId), eq(schema.commitment.title, title)),
    );
  if (plan && !present) {
    await tx.insert(schema.commitment).values({
      relationshipId,
      ownerOrgId: oem,
      jbpId: plan.id,
      side: 'supplier',
      title,
      ownerName: 'Key Account',
      dueOn: isoDay(addDays(today, -21)),
      status: 'open',
      createdBy: account.id,
      createdByName: account.name,
    });
  }
}
