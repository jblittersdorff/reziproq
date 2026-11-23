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
    await demoInbound(tx, relationships, account, today);
    await demoMails(tx, relationships, account, today);
    await demoNotifications(tx, relationships, account, today);
    await demoTranscripts(tx, relationships, account, today);
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
  await demoInbound(tx, relationships, account, today);
  await demoMails(tx, relationships, account, today);
  await demoNotifications(tx, relationships, account, today);
  await demoTranscripts(tx, relationships, account, today);
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
  await demoPastMeeting(tx, relationshipId, account);
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

/** KI-17: ein Werksbesuch vor drei Tagen mit Teilnehmern, für die Ergebnisse nach dem Termin. */
async function demoPastMeeting(
  tx: Transaction,
  relationshipId: string,
  account: { id: string; name: string },
) {
  const oem = seedBuyers.testOem.id;
  const [existing] = await tx
    .select({ id: schema.meeting.id })
    .from(schema.meeting)
    .where(
      and(eq(schema.meeting.relationshipId, relationshipId), eq(schema.meeting.type, 'site_visit')),
    );
  if (existing) return;
  const startsAt = addDays(new Date(), -3);
  startsAt.setUTCHours(8, 0, 0, 0);
  const [meeting] = await tx
    .insert(schema.meeting)
    .values({
      relationshipId,
      ownerOrgId: oem,
      type: 'site_visit',
      title: 'Werksbesuch',
      startsAt,
      durationMinutes: 120,
      status: 'held',
      createdBy: account.id,
      createdByName: account.name,
    })
    .returning({ id: schema.meeting.id });
  if (!meeting) return;
  const participant = (name: string, ownerOrgId: string, position: number) => ({
    meetingId: meeting.id,
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
 * IN-03: Ein Eingang in „Neu eingegangen“ mit zwei Lieferanten, damit Zuordnen und „Bei beiden“
 * in der Demo zu sehen sind. Teilnehmer nur als Funktionsadressen, keine erfundenen Personen.
 */
async function demoInbound(
  tx: Transaction,
  relationships: string[],
  account: { id: string; name: string },
  today: Date,
) {
  if (relationships.length < 2) return;
  const oem = seedBuyers.testOem.id;
  const uid = 'demo-lieferantenrunde@reziproq.demo';
  const [existing] = await tx
    .select({ id: schema.inboundItem.id })
    .from(schema.inboundItem)
    .where(and(eq(schema.inboundItem.orgId, oem), eq(schema.inboundItem.icalUid, uid)));
  if (existing) return;
  const startsAt = addDays(today, 6);
  startsAt.setUTCHours(9, 0, 0, 0);
  await tx.insert(schema.inboundItem).values({
    orgId: oem,
    source: 'inbound_mail',
    fromEmail: null,
    subject: 'Lieferantenrunde Gehäuse und Elektronik',
    icalUid: uid,
    details: {
      method: 'REQUEST',
      startsAt: startsAt.toISOString(),
      endsAt: new Date(startsAt.getTime() + 60 * 60 * 1000).toISOString(),
      location: 'Teams',
      onlineMeetingUrl: null,
      organizerEmail: null,
      organizerName: account.name,
      attendees: [
        { email: 'vertrieb@lieferant-eins.example', name: null, response: null },
        { email: 'vertrieb@lieferant-zwei.example', name: null, response: null },
      ],
    },
    suggestedRelationshipIds: relationships.slice(0, 2),
    suggestionKind: 'several',
    suggestionReason:
      'Teilnehmer von beiden Lieferanten. Wähle einen oder speichere den Termin bei beiden.',
    suggestedType: 'other',
    status: 'needs_review',
    ownerUserId: account.id,
    assigneeUserId: account.id,
  });
}

/**
 * IN-04: Zwei abgelegte Mails beim ersten Lieferanten (eine mit Zusammenfassung von Reziproq,
 * eine weitergeleitete) und eine weitergeleitete Mail ohne erkannten Lieferanten in „Neu
 * eingegangen“. Anhänge zeigt die Demo nicht, weil die Dateiablage zur API gehört.
 */
async function demoMails(
  tx: Transaction,
  relationships: string[],
  account: { id: string; name: string },
  today: Date,
) {
  const [first] = relationships;
  if (!first) return;
  const oem = seedBuyers.testOem.id;
  const messageId = '<demo-kapazitaet-2028@lieferant-eins.example>';
  const [existing] = await tx
    .select({ id: schema.filedMail.id })
    .from(schema.filedMail)
    .where(and(eq(schema.filedMail.orgId, oem), eq(schema.filedMail.messageId, messageId)));
  if (existing) return;
  const sent = addDays(today, -3);
  sent.setUTCHours(8, 40, 0, 0);
  const body =
    'Hallo,\n\nwir planen für 2028 eine zweite Fertigungslinie in Gliwice. Damit steigt unsere Kapazität für eure Gehäuse um 30 Prozent. ' +
    'Können wir das im nächsten Quartalsreview besprechen?\n\nViele Grüße\nTom Weber';
  const [mail] = await tx
    .insert(schema.filedMail)
    .values({
      orgId: oem,
      relationshipId: first,
      filedBy: account.id,
      visibility: 'team',
      messageId,
      fromEmail: 'tom.weber@lieferant-eins.example',
      fromName: 'Tom Weber',
      toEmails: ['einkauf@oem-eins.example'],
      sentAt: sent,
      subject: 'Kapazitätsplanung 2028',
      bodyText: body,
      source: 'addin',
    })
    .returning({ id: schema.filedMail.id });
  if (!mail) return;
  const summary =
    'Der Lieferant plant 2028 eine zweite Fertigungslinie, die Kapazität für die Gehäuse steigt um 30 Prozent. Er möchte den Plan im nächsten Quartalsreview besprechen.';
  const [draft] = await tx
    .insert(schema.aiDraft)
    .values({
      orgId: oem,
      relationshipId: null,
      kind: 'mail_summary',
      objectType: 'filed_mail',
      objectId: mail.id,
      content: summary,
      claims: [{ key: '1', text: summary }],
      model: 'reziproq',
      createdBy: account.id,
    })
    .returning({ id: schema.aiDraft.id });
  if (draft) {
    await tx.insert(schema.aiSource).values({
      orgId: oem,
      draftId: draft.id,
      claimKey: '1',
      objectType: 'filed_mail',
      objectId: mail.id,
      targetType: 'filed_mail',
      targetId: mail.id,
      kind: 'own_data',
      title: 'Kapazitätsplanung 2028',
    });
    await tx
      .update(schema.filedMail)
      .set({ summaryDraftId: draft.id })
      .where(eq(schema.filedMail.id, mail.id));
  }
  const forwarded = addDays(today, -1);
  forwarded.setUTCHours(14, 5, 0, 0);
  await tx.insert(schema.filedMail).values({
    orgId: oem,
    relationshipId: first,
    filedBy: account.id,
    visibility: 'team',
    messageId: '<demo-lieferplan-januar@lieferant-eins.example>',
    fromEmail: 'disposition@lieferant-eins.example',
    fromName: null,
    toEmails: ['einkauf@oem-eins.example'],
    sentAt: forwarded,
    subject: 'Lieferplan Januar',
    bodyText:
      'Guten Tag,\n\nim Januar liefern wir 12 Paletten am 8. und 9 Paletten am 22. Januar.\n\nFreundliche Grüße',
    source: 'forward',
  });
  await tx.insert(schema.inboundItem).values({
    orgId: oem,
    kind: 'mail',
    source: 'inbound_mail',
    fromEmail: null,
    subject: 'Einladung Fachmesse Kunststoffe',
    details: {
      method: 'REQUEST',
      startsAt: forwarded.toISOString(),
      endsAt: null,
      location: null,
      onlineMeetingUrl: null,
      organizerEmail: 'info@messe-kunststoffe.example',
      organizerName: null,
      attendees: [],
      mail: {
        messageId: '<demo-messe@messe-kunststoffe.example>',
        fromEmail: 'info@messe-kunststoffe.example',
        fromName: null,
        toEmails: [],
        sentAt: forwarded.toISOString(),
        bodyText: 'Sehr geehrte Damen und Herren,\n\nwir laden Sie zur Fachmesse Kunststoffe ein.',
        forwardedBy: account.id,
        attachments: [],
      },
    },
    suggestionKind: 'none',
    suggestionReason:
      'Absender von messe-kunststoffe.example sind noch keinem Lieferanten zugeordnet.',
    suggestedType: 'other',
    status: 'needs_review',
    ownerUserId: account.id,
    assigneeUserId: account.id,
  });
}

/**
 * IN-06: zwei Benachrichtigungen unter Profil › Benachrichtigungen › Zuletzt: eine gesendete Mail
 * zum Briefing und ein Hinweis, der für die Zusammenfassung vorgemerkt ist.
 */
async function demoNotifications(
  tx: Transaction,
  relationships: string[],
  account: { id: string; name: string },
  today: Date,
) {
  const [first] = relationships;
  if (!first) return;
  const oem = seedBuyers.testOem.id;
  const [existing] = await tx
    .select({ id: schema.notification.id })
    .from(schema.notification)
    .where(and(eq(schema.notification.orgId, oem), eq(schema.notification.userId, account.id)))
    .limit(1);
  if (existing) return;
  const sent = addDays(today, -1);
  sent.setUTCHours(8, 0, 0, 0);
  await tx.insert(schema.notification).values([
    {
      orgId: oem,
      userId: account.id,
      channel: 'mail',
      kind: 'brief_ready',
      objectType: 'relationship',
      objectId: first,
      bundleKey: `${account.id}:mail:brief_ready`,
      delivery: 'now',
      status: 'sent',
      title: 'Quartalsreview: Briefing steht',
      line: '3 Ziele, Agenda mit 6 Punkten, 8 offene Fragen',
      href: `/lieferanten/${first}/umsetzung/termine`,
      sentAt: sent,
      createdAt: sent,
    },
    {
      orgId: oem,
      userId: account.id,
      channel: 'mail',
      kind: 'hint_high',
      objectType: 'relationship',
      objectId: first,
      bundleKey: `${account.id}:mail:hint_high`,
      delivery: 'digest',
      status: 'queued',
      title: 'Liefertreue unter dem Zielwert',
      line: null,
      href: '/hinweise',
      createdAt: today,
    },
  ]);
}

/**
 * IN-05: Transkripte eingeschaltet, Betriebsvereinbarung bestätigt; beim letzten vergangenen Termin
 * des ersten Lieferanten ist „Transkript übernehmen“ an, aber in der Besprechung lief keine
 * Transkription. Im Reiter Ergebnisse stehen dann Grund, Datei hochladen und Notizen erfassen.
 */
async function demoTranscripts(
  tx: Transaction,
  relationships: string[],
  account: { id: string; name: string },
  today: Date,
) {
  const [first] = relationships;
  if (!first) return;
  const oem = seedBuyers.testOem.id;
  const settings: [(typeof schema.orgSetting.$inferInsert)['key'], unknown][] = [
    ['transcripts_enabled', true],
    ['works_agreement_confirmed_at', addDays(today, -14).toISOString().slice(0, 10)],
    ['works_agreement_confirmed_by', account.name],
    ['transcript_retention_days', 90],
  ];
  for (const [key, value] of settings) {
    await tx
      .insert(schema.orgSetting)
      .values({ orgId: oem, key, value, updatedBy: account.id })
      .onConflictDoNothing();
  }
  const [past] = await tx
    .select({ id: schema.meeting.id })
    .from(schema.meeting)
    .where(
      and(
        eq(schema.meeting.relationshipId, first),
        eq(schema.meeting.ownerOrgId, oem),
        sql`${schema.meeting.startsAt} < ${today}`,
      ),
    )
    .orderBy(desc(schema.meeting.startsAt))
    .limit(1);
  if (!past) return;
  const [existing] = await tx
    .select({ id: schema.meetingTranscript.id })
    .from(schema.meetingTranscript)
    .where(eq(schema.meetingTranscript.meetingId, past.id));
  if (existing) return;
  await tx
    .update(schema.meeting)
    .set({ transcriptOptIn: true })
    .where(eq(schema.meeting.id, past.id));
  await tx.insert(schema.meetingTranscript).values({
    orgId: oem,
    relationshipId: first,
    meetingId: past.id,
    source: 'teams',
    status: 'unavailable',
    unavailableReason: 'keine_transkription',
    attempts: 1,
    lastAttemptAt: today,
  });
}
