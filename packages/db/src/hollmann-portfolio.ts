import { and, eq, sql } from 'drizzle-orm';
import {
  businessUnit,
  commitment,
  organization,
  rating,
  ratingAssignment,
  relationship,
  relationshipBusinessUnit,
  relationshipSide,
  relationshipSpend,
  segmentationRound,
  segmentCriterion,
  segmentDecision,
  segmentModel,
  segmentType,
} from './schema/index.js';
import type { TenantTransaction } from './tenant.js';

// DM-01, BZ-01 (K2-b.2): Portfolio von Hollmann für die Seite Lieferanten (Vorlagen Lieferanten
// und K2-Segmente).
// - Segmentmodell 2 × 2 „Versorgungsrisiko × Wertbeitrag“ (E-K0-33): Strategisch, Entwickeln,
//   Absichern, Hebeln.
// - 46 Lieferanten im Portfolio: 16 aktive Beziehungen und 30 importierte ohne Anbindung (Entwurf,
//   E-K2-10). 38 bewertet: Strategisch 8 (18,4 Mio. €), Entwickeln 9 (4,3), Hebeln 9 (9,1),
//   Absichern 12 (6,2); ohne Bewertung 8, darunter Pearl River.
// - Kessler ist strittig: In der offenen Runde 2027 liegen seine drei Bewertungen bei Qualität bei
//   2, 4 und 5 (25, 75 und 100 Punkte), nach der letzten Entscheidung (SEG-07).
// - Acht Fokuslieferanten (E-K0-09), Zusagequoten wie in der Vorlage, offene Zusagen bei 11
//   Beziehungen. Alle Namen sind ausgedacht (G-10).

type Person = { id: string; name: string };
type GroupKey = 'lp' | 'gu' | 'dt' | 'el' | 'ku' | 'se' | 'lo' | 'vp' | 'ka';
type Segment = 'strategisch' | 'entwickeln' | 'absichern' | 'hebeln';

export interface PortfolioRefs {
  nid: (n: number) => string;
  hollmannOrgId: string;
  people: Record<'janLuka' | 'saraOst' | 'idaRoth' | 'jonasFeld', Person>;
  /** Organisation und Beziehung eines der 16 aktiven Lieferanten */
  supplier: (key: string) => { orgId: string; relationshipId: string; name: string };
}

const mio = (value: number) => Math.round(value * 100_000_000);
const day = (date: string) => new Date(`${date}T11:00:00.000Z`);

/** Feld der Matrix: Zeile Versorgungsrisiko (impact), Spalte Wertbeitrag (quality) */
const cells: Record<Segment, { impact: number; quality: number }> = {
  strategisch: { impact: 2, quality: 2 },
  entwickeln: { impact: 2, quality: 1 },
  absichern: { impact: 1, quality: 2 },
  hebeln: { impact: 1, quality: 1 },
};

/** Segmente der 15 bewerteten aktiven Beziehungen; Pearl River ist ohne Bewertung */
const activeSegments: Record<string, Segment> = {
  rheintal: 'strategisch',
  silesia: 'strategisch',
  nordwerk: 'strategisch',
  saar: 'strategisch',
  alpenKunststoff: 'entwickeln',
  kessler: 'entwickeln',
  lombardia: 'hebeln',
  moravia: 'hebeln',
  moldau: 'hebeln',
  weser: 'hebeln',
  alpenSensorik: 'absichern',
  baltic: 'absichern',
  hanse: 'absichern',
  donau: 'absichern',
  elbe: 'absichern',
};

/** Fokuslieferanten (E-K0-09), „Strategisch · 8“ in der Liste */
const focusKeys = [
  'rheintal',
  'silesia',
  'kessler',
  'nordwerk',
  'saar',
  'pearlRiver',
  'lombardia',
  'alpenSensorik',
];

/** 30 importierte Lieferanten ohne Anbindung: Name, Land, Warengruppe, Spend 2026, Segment */
const imported: [string, string, GroupKey, number, Segment | null][] = [
  ['Ostwald Getriebe', 'DE', 'dt', 2.4, 'strategisch'],
  ['Brenner Elektromotoren', 'AT', 'el', 2.2, 'strategisch'],
  ['Tatra Schmiede', 'CZ', 'gu', 1.95, 'strategisch'],
  ['Wisła Odlewnia', 'PL', 'gu', 1.5, 'strategisch'],
  ['Vogel Federn', 'DE', 'dt', 0.3, 'entwickeln'],
  ['Lumen Optik', 'DE', 'se', 0.25, 'entwickeln'],
  ['Inntal Kunststoff', 'AT', 'ku', 0.2, 'entwickeln'],
  ['Brno Formenbau', 'CZ', 'ku', 0.2, 'entwickeln'],
  ['Pavia Componenti', 'IT', 'dt', 0.15, 'entwickeln'],
  ['Main Sensortechnik', 'DE', 'se', 0.15, 'entwickeln'],
  ['Donaudraht', 'HU', 'ka', 0.15, 'entwickeln'],
  ['Ruhr Stahlguss', 'DE', 'gu', 0.85, 'hebeln'],
  ['Rhône Usinage', 'FR', 'dt', 0.6, 'hebeln'],
  ['Tisza Kábel', 'HU', 'ka', 0.5, 'hebeln'],
  ['Ostsee Schaltungen', 'DE', 'lp', 0.5, 'hebeln'],
  ['Murtal Präzision', 'AT', 'dt', 0.4, 'hebeln'],
  ['Harz Etiketten', 'DE', 'vp', 0.24, 'absichern'],
  ['Lech Transport', 'DE', 'lo', 0.2, 'absichern'],
  ['Masuren Kühlteile', 'PL', 'ku', 0.18, 'absichern'],
  ['Isar Normteile', 'DE', 'dt', 0.17, 'absichern'],
  ['Sava Logistika', 'SI', 'lo', 0.16, 'absichern'],
  ['Neckar Lacke', 'DE', 'ku', 0.15, 'absichern'],
  ['Mosel Schrauben', 'DE', 'dt', 0.14, 'absichern'],
  ['Altmühl Elektronik', 'DE', 'el', 0.35, null],
  ['Weichsel Plast', 'PL', 'ku', 0.3, null],
  ['Etsch Fusioni', 'IT', 'gu', 0.28, null],
  ['Oder Verpackung', 'DE', 'vp', 0.12, null],
  ['Saale Kabel', 'DE', 'ka', 0.1, null],
  ['Drau Sensorik', 'AT', 'se', 0.09, null],
  ['Wiener Spedition', 'AT', 'lo', 0.08, null],
];

/** Zusagequoten 2026 je Seite wie in der Vorlage: [gehalten, fällig] */
const quotas: Record<
  string,
  { buyer: [number, number]; supplier: [number, number]; contact: string }
> = {
  silesia: { buyer: [5, 5], supplier: [3, 5], contact: 'Ewa Nowak' },
  kessler: { buyer: [7, 8], supplier: [4, 5], contact: 'Uwe Kessler' },
  alpenKunststoff: { buyer: [4, 4], supplier: [11, 12], contact: 'Lena Huber' },
  lombardia: { buyer: [5, 6], supplier: [6, 7], contact: 'Marco Ricci' },
  alpenSensorik: { buyer: [3, 3], supplier: [4, 4], contact: 'Paul Gruber' },
  moravia: { buyer: [3, 4], supplier: [2, 3], contact: 'Petra Dvořák' },
};

const buyerTitles = [
  'Forecast für das Quartal teilen',
  'Zeichnungsstand freigeben',
  'Rahmenmengen bestätigen',
  'Rückmeldung zu den Musterteilen',
  'Prüfplan abstimmen',
  'Abrufplan für sechs Monate senden',
  'Lieferantentag ausrichten',
  'Änderungsantrag entscheiden',
];
const supplierTitles = [
  'Kapazitätsmeldung abgeben',
  'Lieferavis 48 Stunden vor Versand',
  'Musterteile liefern',
  '8D-Bericht vorlegen',
  'Ersatzlieferung stellen',
  'Prüfbericht senden',
  'Preisblatt für 2027 vorlegen',
  'Liefertermine bestätigen',
  'Verpackungsvorschrift umsetzen',
  'Erstbemusterung abschließen',
  'Zertifikat erneuern',
  'Notfallplan aktualisieren',
];

/** Offene Zusagen bei 11 Beziehungen (Rheintal hat seine sechs aus K2-a.5), alle nach dem 7.12. */
const openCommitments: [string, 'buyer' | 'supplier', string, string][] = [
  ['silesia', 'supplier', 'Ursachenanalyse Liefertreue vorlegen', '2026-12-11'],
  ['kessler', 'buyer', 'Zeichnungen für die Baureihe 2027 freigeben', '2026-12-18'],
  ['alpenKunststoff', 'supplier', 'Werkzeugplan für die neue Baureihe', '2026-12-15'],
  ['lombardia', 'supplier', 'Kapazitätsmeldung Q1 2027', '2027-01-15'],
  ['moravia', 'buyer', 'Feedback-Welle starten', '2026-12-10'],
  ['nordwerk', 'supplier', 'Scorecard-Werte Oktober bestätigen', '2026-12-09'],
  ['baltic', 'supplier', 'Transportplan Winter vorlegen', '2026-12-14'],
  ['saar', 'buyer', 'Bedarfsvorschau 2027 teilen', '2027-01-20'],
  ['moldau', 'supplier', 'Prüfbericht Lagenaufbau senden', '2026-12-17'],
  ['weser', 'supplier', 'Angebot Mehrlagen-Leiterplatten', '2027-01-29'],
];

/** Ansprechpartner der übrigen Lieferanten mit offener Zusage */
const otherContacts: Record<string, string> = {
  nordwerk: 'Jens Peters',
  baltic: 'Tomas Vaitkus',
  moldau: 'Jana Svobodová',
  weser: 'Ole Hansen',
};

export async function seedPortfolio(tx: TenantTransaction, refs: PortfolioRefs) {
  const { nid, hollmannOrgId, people } = refs;

  // ——— Segmentmodell 2 × 2 (E-K0-33), aktiv seit der Runde 2026
  const modelId = nid(1200);
  await tx.insert(segmentModel).values({
    id: modelId,
    orgId: hollmannOrgId,
    version: 1,
    status: 'active',
    gridSize: 2,
    impactLabel: 'Versorgungsrisiko',
    qualityLabel: 'Wertbeitrag',
    lowMax: 50,
    midMax: 100,
    createdAt: day('2026-01-12'),
    activatedAt: day('2026-01-15'),
  });
  await tx.insert(segmentCriterion).values([
    {
      modelId,
      axis: 'impact',
      key: 'versorgungsrisiko',
      name: 'Versorgungsrisiko',
      description:
        'Wie schwer sich Ausfall, Engpass oder Wechsel des Lieferanten auffangen lassen.',
      weight: 100,
      position: 1,
    },
    {
      modelId,
      axis: 'quality',
      key: 'wertbeitrag',
      name: 'Wertbeitrag',
      description: 'Beitrag zu Kosten, Produkt und Ergebnis von Hollmann.',
      weight: 35.71,
      position: 1,
    },
    {
      modelId,
      axis: 'quality',
      key: 'qualitaet',
      name: 'Qualität',
      description: 'Liefertreue, Fehlerquote und Reaktion auf Reklamationen.',
      weight: 35.71,
      position: 2,
    },
    {
      modelId,
      axis: 'quality',
      key: 'innovation',
      name: 'Innovation',
      description: 'Beitrag zu neuen Baureihen, Verfahren und Werkstoffen.',
      weight: 28.58,
      position: 3,
    },
  ]);
  await tx.insert(segmentType).values([
    {
      modelId,
      impactLevel: cells.strategisch.impact,
      qualityLevel: cells.strategisch.quality,
      name: 'Strategisch',
      description:
        'Hohes Versorgungsrisiko und hoher Wertbeitrag: gemeinsam planen und entwickeln.',
      triageWeight: 2,
    },
    {
      modelId,
      impactLevel: cells.entwickeln.impact,
      qualityLevel: cells.entwickeln.quality,
      name: 'Entwickeln',
      description:
        'Hohes Versorgungsrisiko, noch geringer Wertbeitrag: den Lieferanten gezielt entwickeln.',
      triageWeight: 1,
    },
    {
      modelId,
      impactLevel: cells.absichern.impact,
      qualityLevel: cells.absichern.quality,
      name: 'Absichern',
      description:
        'Geringes Versorgungsrisiko, hoher Wertbeitrag: Leistung sichern und Abhängigkeit vermeiden.',
      triageWeight: 1,
    },
    {
      modelId,
      impactLevel: cells.hebeln.impact,
      qualityLevel: cells.hebeln.quality,
      name: 'Hebeln',
      description:
        'Geringes Versorgungsrisiko und geringer Wertbeitrag: Mengen bündeln und Konditionen hebeln.',
      triageWeight: 1,
    },
  ]);

  // ——— Business Unit für Bewertungen (Pflicht je Zuteilung)
  const unitId = nid(1210);
  await tx
    .insert(businessUnit)
    .values({ id: unitId, orgId: hollmannOrgId, name: 'Antriebstechnik', code: 'AT' });

  // ——— 30 importierte Lieferanten ohne Anbindung (Entwurf)
  const portfolio = imported.map(([name, country, group, spend, segment], index) => ({
    orgId: nid(1000 + index),
    relationshipId: nid(1100 + index),
    name,
    country,
    group,
    spend,
    segment,
  }));
  // Organisationen bleiben beim Leeren der Demo stehen (app_demo_leeren); der Seed läuft beliebig oft
  await tx
    .insert(organization)
    .values(
      portfolio.map((entry) => ({
        id: entry.orgId,
        name: entry.name,
        country: entry.country,
        isDemo: true,
      })),
    )
    .onConflictDoUpdate({
      target: organization.id,
      set: { name: sql`excluded.name`, country: sql`excluded.country`, isDemo: true },
    });
  await tx.insert(relationship).values(
    portfolio.map((entry) => ({
      id: entry.relationshipId,
      buyerOrgId: hollmannOrgId,
      supplierOrgId: entry.orgId,
      status: 'draft' as const,
      createdAt: day('2026-01-20'),
    })),
  );
  await tx.insert(relationshipSide).values(
    portfolio.map((entry, index) => ({
      relationshipId: entry.relationshipId,
      orgId: hollmannOrgId,
      externalRef: `L-${String(71000 + index * 7)}`,
    })),
  );
  await tx.insert(relationshipSpend).values(
    portfolio.flatMap((entry) => [
      {
        relationshipId: entry.relationshipId,
        year: 2026,
        amountCents: mio(entry.spend),
        currency: 'EUR',
        source: 'seed' as const,
      },
      {
        relationshipId: entry.relationshipId,
        year: 2025,
        amountCents: Math.round(mio(entry.spend) * 0.94),
        currency: 'EUR',
        source: 'seed' as const,
      },
    ]),
  );
  // Ohne Warengruppe: Die Zahlen der Warengruppen-Seiten bleiben wie in DM-01 (G-9, erst ab K6)

  // ——— Business Unit für alle 46, Fokus für acht der aktiven
  const activeKeys = [...Object.keys(activeSegments), 'pearlRiver'];
  const allRelationships = [
    ...activeKeys.map((key) => refs.supplier(key).relationshipId),
    ...portfolio.map((entry) => entry.relationshipId),
  ];
  await tx
    .insert(relationshipBusinessUnit)
    .values(allRelationships.map((relationshipId) => ({ relationshipId, businessUnitId: unitId })));
  for (const key of focusKeys) {
    await tx
      .update(relationshipSide)
      .set({ isFocus: true })
      .where(
        and(
          eq(relationshipSide.relationshipId, refs.supplier(key).relationshipId),
          eq(relationshipSide.orgId, hollmannOrgId),
        ),
      );
  }

  // ——— Segmente aus der Runde 2026 (38 bewertet)
  const decided = [
    ...Object.entries(activeSegments).map(([key, segment]) => ({
      relationshipId: refs.supplier(key).relationshipId,
      segment,
    })),
    ...portfolio.flatMap((entry) =>
      entry.segment ? [{ relationshipId: entry.relationshipId, segment: entry.segment }] : [],
    ),
  ];
  await tx.insert(segmentDecision).values(
    decided.map((entry, index) => ({
      id: nid(1300 + index),
      relationshipId: entry.relationshipId,
      scope: 'total' as const,
      istImpactLevel: cells[entry.segment].impact,
      istQualityLevel: cells[entry.segment].quality,
      sollImpactLevel: cells[entry.segment].impact,
      sollQualityLevel: cells[entry.segment].quality,
      reason: 'Bewertungsrunde 2026',
      modelVersion: 1,
      decidedBy: people.saraOst.id,
      decidedAt: day('2026-03-20'),
      version: 1,
      origin: 'round' as const,
    })),
  );

  // ——— Offene Runde 2027: Kessler mit drei Bewertungen, bei Qualität 2, 4 und 5 (SEG-07)
  const roundId = nid(1400);
  await tx.insert(segmentationRound).values({
    id: roundId,
    orgId: hollmannOrgId,
    name: 'Bewertungsrunde 2027',
    dueDate: '2026-12-19',
    status: 'open',
    scope: 'portfolio',
    modelVersion: 1,
    createdBy: people.saraOst.id,
    createdAt: day('2026-11-02'),
    startedAt: day('2026-11-02'),
  });
  const kessler = refs.supplier('kessler').relationshipId;
  const raters = [
    { user: people.janLuka, fn: 'purchasing' as const, quality: 25, submitted: '2026-11-12' },
    { user: people.idaRoth, fn: 'quality' as const, quality: 75, submitted: '2026-11-16' },
    { user: people.jonasFeld, fn: 'engineering' as const, quality: 100, submitted: '2026-11-19' },
  ];
  await tx.insert(ratingAssignment).values(
    raters.map((rater, index) => ({
      id: nid(1410 + index),
      roundId,
      relationshipId: kessler,
      businessUnitId: unitId,
      function: rater.fn,
      raterUserId: rater.user.id,
      status: 'submitted' as const,
      createdAt: day('2026-11-02'),
    })),
  );
  await tx.insert(rating).values(
    raters.flatMap((rater, index) =>
      (
        [
          ['versorgungsrisiko', 75],
          ['wertbeitrag', 50],
          ['qualitaet', rater.quality],
          ['innovation', 50],
        ] as const
      ).map(([criterionKey, value]) => ({
        assignmentId: nid(1410 + index),
        relationshipId: kessler,
        criterionKey,
        modelVersion: 1,
        ist: value,
        soll: value,
        updatedAt: day(rater.submitted),
        submittedAt: day(rater.submitted),
      })),
    ),
  );

  // ——— Zusagen 2026 je Seite (Quoten der Vorlage) und offene Zusagen bei 11 Beziehungen
  let next = 1500;
  const rows: (typeof commitment.$inferInsert)[] = [];
  for (const [key, quota] of Object.entries(quotas)) {
    const found = refs.supplier(key);
    for (const side of ['buyer', 'supplier'] as const) {
      const [kept, due] = quota[side];
      for (let n = 0; n < due; n += 1) {
        const dueOn = `2026-${String(1 + Math.floor((n * 10) / due)).padStart(2, '0')}-${String(10 + (n % 15)).padStart(2, '0')}`;
        const isKept = n < kept;
        const byBuyer = side === 'buyer';
        const owner = byBuyer ? people.jonasFeld : { id: null, name: quota.contact };
        rows.push({
          id: nid(next++),
          relationshipId: found.relationshipId,
          ownerOrgId: byBuyer ? hollmannOrgId : found.orgId,
          visibility: 'shared',
          side,
          title:
            (byBuyer ? buyerTitles : supplierTitles)[
              n % (byBuyer ? buyerTitles.length : supplierTitles.length)
            ] ?? 'Zusage',
          ownerUserId: owner.id,
          ownerName: owner.name,
          dueOn,
          status: isKept ? 'kept' : 'missed',
          fulfilledEvidence: isKept
            ? {
                kind: byBuyer ? 'confirmation' : 'goods_receipt',
                byName: byBuyer ? quota.contact : people.janLuka.name,
                at: day(dueOn).toISOString(),
              }
            : null,
          doneAt: day(dueOn),
          sourceType: 'manual',
          confirmState: 'both_confirmed',
          createdBy: people.janLuka.id,
          createdByName: people.janLuka.name,
          createdAt: day('2026-01-08'),
        });
      }
    }
  }
  for (const [key, side, title, dueOn] of openCommitments) {
    const found = refs.supplier(key);
    const contact = quotas[key]?.contact ?? otherContacts[key] ?? 'Key Account';
    rows.push({
      id: nid(next++),
      relationshipId: found.relationshipId,
      ownerOrgId: side === 'buyer' ? hollmannOrgId : found.orgId,
      visibility: 'shared',
      side,
      title,
      ownerUserId: side === 'buyer' ? people.idaRoth.id : null,
      ownerName: side === 'buyer' ? people.idaRoth.name : contact,
      dueOn,
      status: 'open',
      sourceType: 'manual',
      confirmState: 'both_confirmed',
      createdBy: people.janLuka.id,
      createdByName: people.janLuka.name,
      createdAt: day('2026-11-10'),
    });
  }
  await tx.insert(commitment).values(rows);
}
