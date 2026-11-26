import { eq } from 'drizzle-orm';
import type { Database } from './client.js';
import {
  commitment,
  meeting,
  meetingAgendaItem,
  meetingDecision,
  meetingParticipant,
  meetingSnapshot,
  task,
} from './schema/index.js';

type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

const day = 24 * 60 * 60 * 1000;

/**
 * Beispieldaten für QBR-01: ein abgeschlossenes Quartalsreview mit Protokoll, Beschlüssen und
 * eingefrorenem Stand und ein kommendes mit Agenda beider Seiten. Wiederholbar: Gibt es den Termin
 * schon, bleibt er, wie er ist.
 */
export async function seedMeetings(
  tx: Transaction,
  input: {
    relationshipId: string;
    buyerOrgId: string;
    supplierOrgId: string;
    pastId: string;
    nextId: string;
    actionIds: [string, string, string];
    createdBy: string;
    createdByName: string;
    now: Date;
  },
) {
  const base = { relationshipId: input.relationshipId, visibility: 'shared' as const };
  const atTen = (offset: number) => {
    const date = new Date(input.now.getTime() + offset * day);
    date.setUTCHours(9, 0, 0, 0);
    return date;
  };

  const [past] = await tx
    .insert(meeting)
    .values({
      ...base,
      id: input.pastId,
      ownerOrgId: input.buyerOrgId,
      type: 'quarterly_review',
      title: 'Quartalsreview Q3',
      startsAt: atTen(-30),
      location: 'Werk Nord',
      protocol:
        'Liefertreue bei 96 %, Ziel 98 %. Engpass bei Leiterplatten bis Ende des Quartals. Die Zweitquelle für Gehäuse wird geprüft.',
      createdBy: input.createdBy,
      createdByName: input.createdByName,
    })
    .onConflictDoNothing()
    .returning({ id: meeting.id });
  if (past) {
    const own = { ...base, meetingId: past.id, ownerOrgId: input.buyerOrgId };
    const theirs = { ...base, meetingId: past.id, ownerOrgId: input.supplierOrgId };
    await tx.insert(meetingParticipant).values([
      { ...own, name: input.createdByName, position: 1 },
      { ...theirs, name: 'Key Account Manager', position: 1 },
    ]);
    await tx.insert(meetingAgendaItem).values([
      { ...own, title: 'Rückblick auf das Quartal', position: 1 },
      { ...own, title: 'Kennzahlen und Scorecard', position: 2 },
      { ...theirs, title: 'Kapazitäten Leiterplatten', position: 1 },
    ]);
    await tx.insert(meetingDecision).values([
      { ...own, text: 'Zweitquelle für Gehäuse bis zum nächsten Review prüfen.', position: 1 },
      { ...theirs, text: 'Wöchentlicher Bericht zur Leiterplatten-Lage.', position: 1 },
    ]);
    // Abschließen wie die API: erst der Status, dann der eingefrorene Stand.
    await tx.update(meeting).set({ status: 'closed' }).where(eq(meeting.id, past.id));
    await tx.insert(meetingSnapshot).values({
      ...base,
      meetingId: past.id,
      ownerOrgId: input.buyerOrgId,
      content: { sections: [] },
    });
  }

  // QBR-03, ZQ-01 (K2-a.3): Aus dem abgeschlossenen Review eine überfällige Zusage des Käufers,
  // eine Aufgabe (früher interne Maßnahme) und eine Zusage des Lieferanten. Feste IDs halten den
  // Seed wiederholbar.
  const iso = (offset: number) =>
    new Date(input.now.getTime() + offset * day).toISOString().slice(0, 10);
  const itemBase = {
    relationshipId: input.relationshipId,
    createdBy: input.createdBy,
    createdByName: input.createdByName,
  };
  await tx
    .insert(commitment)
    .values([
      {
        ...itemBase,
        id: input.actionIds[0],
        ownerOrgId: input.buyerOrgId,
        visibility: 'shared',
        side: 'buyer',
        title: 'Zweitquelle für Gehäuse prüfen',
        ownerUserId: input.createdBy,
        ownerName: input.createdByName,
        dueOn: iso(-3),
        sourceType: 'meeting',
        sourceRef: input.pastId,
      },
      {
        ...itemBase,
        id: input.actionIds[2],
        ownerOrgId: input.supplierOrgId,
        visibility: 'shared',
        side: 'supplier',
        title: 'Wöchentlicher Bericht zur Leiterplatten-Lage',
        ownerUserId: null,
        ownerName: 'Key Account Manager',
        dueOn: iso(14),
        sourceType: 'meeting',
        sourceRef: input.pastId,
        createdBy: 'demo-test-lieferant-1',
        createdByName: 'Key Account Manager',
      },
    ])
    .onConflictDoNothing();
  await tx
    .insert(task)
    .values({
      ...itemBase,
      id: input.actionIds[1],
      orgId: input.buyerOrgId,
      title: 'Preisspielraum für 2027 klären',
      ownerUserId: input.createdBy,
      ownerName: input.createdByName,
      dueDate: iso(10),
      sourceType: 'manual',
      sourceId: null,
    })
    .onConflictDoNothing();

  const [next] = await tx
    .insert(meeting)
    .values({
      ...base,
      id: input.nextId,
      ownerOrgId: input.buyerOrgId,
      type: 'quarterly_review',
      title: 'Quartalsreview Q4',
      startsAt: atTen(21),
      location: 'Werk Nord',
      createdBy: input.createdBy,
      createdByName: input.createdByName,
    })
    .onConflictDoNothing()
    .returning({ id: meeting.id });
  if (next) {
    const own = { ...base, meetingId: next.id, ownerOrgId: input.buyerOrgId };
    const theirs = { ...base, meetingId: next.id, ownerOrgId: input.supplierOrgId };
    await tx.insert(meetingAgendaItem).values([
      { ...own, title: 'Rückblick auf das Quartal', position: 1 },
      { ...own, title: 'Kennzahlen und Scorecard', position: 2 },
      { ...own, title: 'Offene Maßnahmen', position: 3 },
      { ...own, title: 'Ausblick und nächste Schritte', position: 4 },
      { ...theirs, title: 'Neue Kapazitäten 2027', position: 1 },
    ]);
  }
}
