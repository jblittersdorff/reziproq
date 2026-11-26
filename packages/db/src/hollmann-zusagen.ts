import { commitment, jbp } from './schema/index.js';
import type { TenantTransaction } from './tenant.js';

// DM-01 K2 (K2-a.5): Zusagen 2026 zwischen Hollmann und Rheintal, wie in der Vorlage L-Ueberblick
// und im Seed von DM-01: Hollmann hält 9 von 10 (90 %), Rheintal 7 von 9 (78 %), beide Seiten sehen
// dieselben Zahlen (E-K2-3). Dazu sechs offene Zusagen: der 8D-Bericht seit 05.11. überfällig, die
// Musterteile Starrflex nur von Hollmann eingetragen und bestätigt („Rheintal bestätigt noch“, zählt
// nicht, T2-05). Gehaltene tragen einen Beleg (ZQ-01 Regel 2), zuletzt gehalten hat Hollmann
// „Abrufmengen 6 Monate im Voraus“. Alle Personen sind synthetisch (G-10).

type Person = { id: string; name: string };

export interface CommitmentRefs {
  nid: (n: number) => string;
  hollmannOrgId: string;
  rheintal: { orgId: string; relationshipId: string };
  janLuka: Person;
  hollmann: Record<'idaRoth' | 'jonasFeld' | 'saraOst', Person>;
  rheintalPeople: Record<'kimKaiser' | 'tomWeber' | 'nilsOtt' | 'leaBrandt' | 'miaKuhn', Person>;
}

/** Mittags in UTC, in Berlin immer derselbe Tag, auch in der Sommerzeit */
const day = (date: string) => new Date(`${date}T11:00:00.000Z`);

type Evidence = 'delivery_advice' | 'goods_receipt' | 'document' | 'confirmation';

interface Closed {
  title: string;
  owner: Person;
  due: string;
  /** Beleg bei gehaltenen, null bei verfehlten */
  evidence: Evidence | null;
  /** Tag der Buchung; ohne Angabe die Frist */
  done?: string;
}

export async function seedCommitments(tx: TenantTransaction, refs: CommitmentRefs) {
  const { nid, hollmannOrgId, rheintal, janLuka } = refs;
  const { idaRoth, jonasFeld, saraOst } = refs.hollmann;
  const { kimKaiser, tomWeber, nilsOtt, leaBrandt, miaKuhn } = refs.rheintalPeople;
  const rheintalOrgId = rheintal.orgId;

  // Gemeinsamer Plan 2026, aus dem die offene Zusage „Abnahmeplan SMT-Linie“ stammt
  const plan2026 = nid(850);
  await tx.insert(jbp).values({
    id: plan2026,
    relationshipId: rheintal.relationshipId,
    ownerOrgId: hollmannOrgId,
    visibility: 'shared',
    status: 'approved',
    createdBy: janLuka.id,
    createdByName: janLuka.name,
    createdAt: day('2025-12-05'),
  });

  const hollmannClosed: Closed[] = [
    {
      title: 'Forecast Q1 an Rheintal senden',
      owner: jonasFeld,
      due: '2026-01-16',
      evidence: 'document',
    },
    {
      title: 'Zeichnung Rev. B freigeben',
      owner: janLuka,
      due: '2026-02-13',
      evidence: 'document',
    },
    {
      title: 'Lieferantenaudit Werk Pforzheim planen',
      owner: idaRoth,
      due: '2026-03-20',
      evidence: 'confirmation',
    },
    {
      title: 'Prognose Q2 teilen',
      owner: jonasFeld,
      due: '2026-04-10',
      evidence: null,
      done: '2026-04-13',
    },
    {
      title: 'Rückmeldung zu den Musterteilen Rev. B',
      owner: idaRoth,
      due: '2026-05-08',
      evidence: 'document',
    },
    { title: 'Prognose Q3 teilen', owner: jonasFeld, due: '2026-07-10', evidence: 'document' },
    {
      title: 'Ansprechpartner Qualität benennen',
      owner: saraOst,
      due: '2026-08-14',
      evidence: 'confirmation',
    },
    {
      title: 'Bedarfsvorschau 2027 teilen',
      owner: jonasFeld,
      due: '2026-09-30',
      evidence: 'document',
    },
    { title: 'Prognose Q4 teilen', owner: jonasFeld, due: '2026-10-09', evidence: 'document' },
    {
      title: 'Abrufmengen 6 Monate im Voraus',
      owner: jonasFeld,
      due: '2026-11-20',
      evidence: 'document',
    },
  ];
  const rheintalClosed: Closed[] = [
    { title: 'Kapazitätsmeldung Q1', owner: tomWeber, due: '2026-01-23', evidence: 'document' },
    {
      title: 'Musterteile Rev. B liefern',
      owner: kimKaiser,
      due: '2026-03-06',
      evidence: 'goods_receipt',
    },
    { title: '8D-Bericht Charge 4655', owner: nilsOtt, due: '2026-04-17', evidence: 'document' },
    { title: 'Kapazitätsmeldung Q2', owner: tomWeber, due: '2026-04-24', evidence: 'document' },
    {
      title: 'Ersatzlieferung Charge 4590',
      owner: tomWeber,
      due: '2026-05-22',
      evidence: null,
      done: '2026-05-26',
    },
    {
      title: 'Lieferavis 48 Stunden vor Versand',
      owner: leaBrandt,
      due: '2026-06-30',
      evidence: 'delivery_advice',
    },
    { title: 'Kapazitätsmeldung Q3', owner: tomWeber, due: '2026-07-24', evidence: 'document' },
    {
      title: 'Eilabrufe binnen 5 Tagen bestätigen',
      owner: miaKuhn,
      due: '2026-09-11',
      evidence: null,
      done: '2026-09-14',
    },
    // DM-01: Kapazitätsmeldung Q4 vom 18.11.
    {
      title: 'Kapazitätsmeldung Q4',
      owner: tomWeber,
      due: '2026-11-20',
      evidence: 'document',
      done: '2026-11-18',
    },
  ];
  const closed = (side: 'buyer' | 'supplier', entries: Closed[], first: number) =>
    entries.map((entry, index) => {
      const done = day(entry.done ?? entry.due);
      const byBuyer = side === 'buyer';
      return {
        id: nid(first + index),
        relationshipId: rheintal.relationshipId,
        ownerOrgId: byBuyer ? hollmannOrgId : rheintalOrgId,
        visibility: 'shared' as const,
        side,
        title: entry.title,
        ownerUserId: entry.owner.id,
        ownerName: entry.owner.name,
        dueOn: entry.due,
        status: entry.evidence ? ('kept' as const) : ('missed' as const),
        // Gebucht hat die jeweils andere Seite, mit Beleg und Zeitpunkt (ZQ-01 Regel 2)
        fulfilledEvidence: entry.evidence
          ? {
              kind: entry.evidence,
              byUserId: byBuyer ? tomWeber.id : janLuka.id,
              byName: byBuyer ? tomWeber.name : janLuka.name,
              at: done.toISOString(),
            }
          : null,
        doneAt: done,
        sourceType: 'manual' as const,
        confirmState: 'both_confirmed' as const,
        createdBy: byBuyer ? janLuka.id : tomWeber.id,
        createdByName: byBuyer ? janLuka.name : tomWeber.name,
        createdAt: day('2026-01-08'),
      };
    });

  const open = (
    n: number,
    entry: {
      title: string;
      side: 'buyer' | 'supplier';
      owner: Person;
      due: string;
      /** Organisation, die die Zusage eingetragen hat */
      byOrg: string;
      confirm: 'both_confirmed' | 'buyer_confirmed';
      sourceType: 'manual' | 'feedback' | null;
      jbpId?: string;
      measure?: string;
      createdAt: string;
    },
  ) => ({
    id: nid(n),
    relationshipId: rheintal.relationshipId,
    ownerOrgId: entry.byOrg,
    visibility: 'shared' as const,
    side: entry.side,
    jbpId: entry.jbpId ?? null,
    title: entry.title,
    measure: entry.measure ?? null,
    ownerUserId: entry.owner.id,
    ownerName: entry.owner.name,
    dueOn: entry.due,
    status: 'open' as const,
    sourceType: entry.sourceType,
    confirmState: entry.confirm,
    createdBy: entry.byOrg === hollmannOrgId ? janLuka.id : tomWeber.id,
    createdByName: entry.byOrg === hollmannOrgId ? janLuka.name : tomWeber.name,
    createdAt: day(entry.createdAt),
  });

  await tx.insert(commitment).values([
    ...closed('buyer', hollmannClosed, 800),
    ...closed('supplier', rheintalClosed, 820),
    // Die sechs offenen Zusagen der Akte (L-Ueberblick, „Zusagen · 6 offen“)
    open(840, {
      title: '8D-Bericht Charge 4711',
      side: 'supplier',
      owner: nilsOtt,
      due: '2026-11-05',
      byOrg: rheintalOrgId,
      confirm: 'both_confirmed',
      sourceType: 'manual',
      createdAt: '2026-10-22',
    }),
    open(841, {
      title: 'Beitrag Machbarkeit Lieferzeit',
      side: 'supplier',
      owner: tomWeber,
      due: '2026-11-27',
      byOrg: rheintalOrgId,
      confirm: 'both_confirmed',
      sourceType: 'manual',
      createdAt: '2026-11-12',
    }),
    open(842, {
      title: 'Prognose monatlich teilen',
      side: 'buyer',
      owner: idaRoth,
      due: '2026-12-15',
      byOrg: hollmannOrgId,
      confirm: 'both_confirmed',
      // Aus der Feedback-Lücke; die Welle selbst kommt mit K2-f in den Seed
      sourceType: 'feedback',
      measure: 'monatlich ab 15.12.',
      createdAt: '2026-11-04',
    }),
    open(843, {
      title: 'Musterteile Starrflex liefern',
      side: 'supplier',
      owner: kimKaiser,
      due: '2026-12-15',
      // Von Hollmann eingetragen; Rheintal hat noch nicht bestätigt
      byOrg: hollmannOrgId,
      confirm: 'buyer_confirmed',
      sourceType: 'manual',
      createdAt: '2026-11-19',
    }),
    open(844, {
      title: 'Prognose 2028 teilen',
      side: 'buyer',
      owner: idaRoth,
      due: '2027-01-31',
      byOrg: hollmannOrgId,
      confirm: 'both_confirmed',
      sourceType: 'manual',
      createdAt: '2026-10-15',
    }),
    open(845, {
      title: 'Abnahmeplan SMT-Linie',
      side: 'supplier',
      owner: kimKaiser,
      due: '2027-02-28',
      byOrg: rheintalOrgId,
      confirm: 'both_confirmed',
      // Aus dem Gemeinsamen Plan 2026 (Zusage des Plans, ohne eigene Herkunft)
      sourceType: null,
      jbpId: plan2026,
      createdAt: '2025-12-05',
    }),
  ]);
}
