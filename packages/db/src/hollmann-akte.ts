import {
  kpiValue,
  note,
  relationshipTarget,
  ruleSet,
  ruleSetItem,
  scorecard,
  scorecardKpi,
  scorecardSignature,
  touchpoint,
} from './schema/index.js';
import type { TenantTransaction } from './tenant.js';

// DM-01 K2 (K2-c.1): Akte Rheintal, Sicht Gemeinsam, nach der Vorlage L-Ueberblick. Die Scorecard
// hängt am Gemeinsamen Plan 2026 und ist von beiden Seiten unterschrieben: Liefertreue 94 % (Ziel
// 97 %, knapp), Reklamationen 28 ppm (Ziel 20, im Plan), Prognosetreue eurer Seite 72 % (Ziel
// 85 %, hinter Plan), Durchlaufzeit Musterteile noch ohne Wert. Abweichung: Die Vorlage zeigt die
// Scorecard 2027 mit fehlender Unterschrift von Hollmann; die käme als Fokus-Thema in Heute und
// änderte das Drehbuch K1. Die Werte sind so gewählt, dass die Regel „Kennzahl unter Ziel und
// schlechter“ nicht anschlägt (kein Wert sinkt über drei Monate; B-39). Personen synthetisch (G-10).

type Person = { id: string; name: string };

export interface AkteRefs {
  nid: (n: number) => string;
  hollmannOrgId: string;
  hollmannName: string;
  rheintal: { orgId: string; relationshipId: string; name: string };
  /** Gemeinsamer Plan 2026 von Rheintal (K2-a.5) */
  plan2026: string;
  janLuka: Person;
  idaRoth: Person;
  kimKaiser: Person;
  tomWeber: Person;
}

/** Mittags in UTC, in Berlin immer derselbe Tag, auch in der Sommerzeit */
const day = (date: string) => new Date(`${date}T11:00:00.000Z`);

export async function seedAkte(tx: TenantTransaction, refs: AkteRefs) {
  const { nid, hollmannOrgId, rheintal } = refs;
  const shared = {
    relationshipId: rheintal.relationshipId,
    visibility: 'shared' as const,
  };
  const card = nid(1700);
  await tx.insert(scorecard).values({
    id: card,
    ...shared,
    ownerOrgId: hollmannOrgId,
    jbpId: refs.plan2026,
    status: 'signed',
    createdAt: day('2025-12-05'),
  });
  await tx.insert(scorecardSignature).values([
    {
      id: nid(1701),
      ...shared,
      ownerOrgId: rheintal.orgId,
      scorecardId: card,
      version: 1,
      side: 'supplier',
      userId: refs.kimKaiser.id,
      userName: refs.kimKaiser.name,
      signedAt: day('2025-12-08'),
    },
    {
      id: nid(1702),
      ...shared,
      ownerOrgId: hollmannOrgId,
      scorecardId: card,
      version: 1,
      side: 'buyer',
      userId: refs.janLuka.id,
      userName: refs.janLuka.name,
      signedAt: day('2025-12-09'),
    },
  ]);

  // Linie von der Basis (Anlage 05.12.2025) zum Ziel Ende 2027 (JBP-09)
  const kpis = [
    {
      id: nid(1703),
      name: 'Liefertreue',
      unit: '%',
      direction: 'higher' as const,
      baseline: '93',
      target: '97',
      side: 'supplier' as const,
      values: [94, 95, 94],
    },
    {
      id: nid(1704),
      name: 'Reklamationen je Mio. Teile',
      unit: 'ppm',
      direction: 'lower' as const,
      baseline: '40',
      target: '20',
      side: 'supplier' as const,
      values: [34, 30, 28],
    },
    {
      id: nid(1705),
      name: 'Prognosetreue',
      unit: '%',
      direction: 'higher' as const,
      baseline: '80',
      target: '85',
      side: 'buyer' as const,
      values: [70, 73, 72],
    },
    {
      id: nid(1706),
      name: 'Durchlaufzeit Musterteile',
      unit: 'Tage',
      direction: 'lower' as const,
      baseline: null,
      target: '14',
      side: 'supplier' as const,
      values: [] as number[],
    },
  ];
  await tx.insert(scorecardKpi).values(
    kpis.map((kpi) => ({
      id: kpi.id,
      ...shared,
      ownerOrgId: kpi.side === 'supplier' ? rheintal.orgId : hollmannOrgId,
      scorecardId: card,
      name: kpi.name,
      unit: kpi.unit,
      direction: kpi.direction,
      baseline: kpi.baseline,
      target: kpi.target,
      targetDate: '2027-12-31',
      ownerSide: kpi.side,
      ownerName: kpi.side === 'supplier' ? rheintal.name : refs.hollmannName,
      benefitFor: 'both' as const,
      createdAt: day('2025-12-05'),
    })),
  );
  const months = ['2026-08-01', '2026-09-01', '2026-10-01'] as const;
  const entered = ['2026-09-04', '2026-10-05', '2026-11-04'] as const;
  let n = 1707;
  const values = kpis.flatMap((kpi) =>
    kpi.values.map((value, index) => {
      const person = kpi.side === 'supplier' ? refs.tomWeber : refs.idaRoth;
      return {
        id: nid(n++),
        ...shared,
        ownerOrgId: kpi.side === 'supplier' ? rheintal.orgId : hollmannOrgId,
        kpiId: kpi.id,
        period: months[index] as string,
        value: String(value),
        source: 'manual' as const,
        enteredBy: person.id,
        enteredByName: person.name,
        enteredAt: day(entered[index] as string),
        confirmState: 'both_confirmed' as const,
      };
    }),
  );
  await tx.insert(kpiValue).values(values);
}

export interface AktePrivateRefs {
  nid: (n: number) => string;
  hollmannOrgId: string;
  relationshipId: string;
  janLuka: Person;
  saraOst: Person;
  jonasFeld: Person;
  idaRoth: Person;
  tomBerg: Person;
  /** Ansprechpartner von Rheintal (supplier_contact) */
  contacts: { tomWeber: Person; leaBrandt: Person; miaKuhn: Person };
}

/**
 * DM-01 K2 (K2-c.3): Akte Rheintal, Sicht Nur für dich, nach der Vorlage K2-Akte-Privat. Vier interne
 * Gesprächspaare (Kontaktpunkte, PLB-06) mit den Entscheidern als Notiz; mit Kim Kaiser und Nils Ott
 * spricht noch niemand direkt. Im Verlauf eine eigene Notiz von Jan-Luka „nur ich“ und die
 * angeheftete Notiz von Jonas Feld zur Kupferklausel. Rheintal hat im Demo keinen laufenden Zyklus,
 * die Kontaktpunkte ändern also keinen Schritt. Personen synthetisch (G-10).
 */
export async function seedAktePrivate(tx: TenantTransaction, refs: AktePrivateRefs) {
  const { nid, hollmannOrgId, relationshipId, contacts } = refs;
  const pair = (
    n: number,
    format: string,
    buyer: Person,
    buyerLevel: 'management' | 'operational',
    contact: Person,
    supplierLevel: 'management' | 'operational',
    cadence: 'monthly' | 'quarterly' | 'semiannual',
    notes: string,
  ) => ({
    id: nid(1720 + n),
    relationshipId,
    ownerOrgId: hollmannOrgId,
    visibility: 'internal' as const,
    buyerUserId: buyer.id,
    buyerName: buyer.name,
    buyerLevel,
    supplierContactId: contact.id,
    supplierName: contact.name,
    supplierLevel,
    format,
    cadence,
    notes,
    createdBy: refs.saraOst.id,
    createdAt: day('2026-10-10'),
    updatedAt: day('2026-10-10'),
  });
  await tx
    .insert(touchpoint)
    .values([
      pair(
        0,
        'Preise und Verträge',
        refs.saraOst,
        'management',
        contacts.tomWeber,
        'management',
        'quarterly',
        'Entscheidet: Kim Kaiser, nur über Tom Weber',
      ),
      pair(
        1,
        'Rohstoffe',
        refs.jonasFeld,
        'operational',
        contacts.leaBrandt,
        'operational',
        'monthly',
        'Entscheidet: Kim Kaiser, nur über Lea Brandt',
      ),
      pair(
        2,
        'Qualität',
        refs.idaRoth,
        'operational',
        contacts.tomWeber,
        'management',
        'monthly',
        'Entscheidet: Nils Ott',
      ),
      pair(
        3,
        'Technik',
        refs.tomBerg,
        'management',
        contacts.miaKuhn,
        'management',
        'semiannual',
        'Entscheidet: Mia Kuhn, Werksleitung',
      ),
    ]);
  await tx.insert(note).values([
    {
      id: nid(1730),
      orgId: hollmannOrgId,
      relationshipId,
      authorUserId: refs.janLuka.id,
      visibility: 'private',
      kind: 'note',
      text: 'Gespräch mit Tom Weber, zwei Themen fürs JBP: Prognosen früher teilen und Kapazität 2028.',
      createdAt: new Date('2026-11-19T15:10:00.000Z'),
      updatedAt: new Date('2026-11-19T15:10:00.000Z'),
    },
    {
      id: nid(1731),
      orgId: hollmannOrgId,
      relationshipId,
      authorUserId: refs.jonasFeld.id,
      visibility: 'team',
      kind: 'note',
      text: 'Linie Kupfer: Basis 10/2026, Anpassung ab 5 % Indexänderung, beide Richtungen.',
      pinned: true,
      createdAt: new Date('2026-11-02T09:30:00.000Z'),
      updatedAt: new Date('2026-11-02T09:30:00.000Z'),
    },
  ]);
}

export interface AkteRulesRefs {
  nid: (n: number) => string;
  hollmannOrgId: string;
  relationshipId: string;
  saraOst: Person;
  /** Beschreibung des Typs „Strategisch“ im Segmentmodell von Hollmann */
  typeDescription: string;
}

type Text = { de: string; en: string };

/**
 * DM-01 K2 (K2-c.5): Spielregeln „Strategisch“ für Rheintal, Version 1, am 15.10. mit Rheintal
 * geteilt (SEG-10). Zu jedem Recht gibt es eine Pflicht derselben Gruppe, sonst schlüge der Hinweis
 * „Recht ohne Pflicht“ an. Die Formate heißen wie die Gesprächspaare der Kontaktpunkte (K2-c.3);
 * so entsteht im Beziehungsnetz keine Lücke. Alle Formate mindestens quartalsweise: Seit dem Teilen
 * am 15.10. ist bis Mitte Januar keines überfällig, die Regel „Format nicht eingehalten“ schlägt im
 * Demo nicht an (B-39). Eigene Einträge, kein Katalog.
 */
export async function seedAkteRules(tx: TenantTransaction, refs: AkteRulesRefs) {
  const { nid, hollmannOrgId, relationshipId } = refs;
  const setId = nid(1740);
  await tx.insert(ruleSet).values({
    id: setId,
    relationshipId,
    ownerOrgId: hollmannOrgId,
    visibility: 'shared',
    version: 1,
    status: 'shared',
    targetImpactLevel: 2,
    targetQualityLevel: 2,
    typeName: 'Strategisch',
    createdBy: refs.saraOst.id,
    createdAt: day('2026-10-10'),
    approvedBy: refs.saraOst.id,
    approvedByName: refs.saraOst.name,
    approvedAt: day('2026-10-14'),
  });
  const items: {
    kind: 'right' | 'obligation' | 'format';
    group: 'cost' | 'protection' | 'collaboration' | 'growth' | null;
    title: Text;
    description: Text;
    cadence: 'monthly' | 'quarterly' | 'semiannual' | null;
    level: 'management' | 'operational' | null;
  }[] = [
    {
      kind: 'right',
      group: 'collaboration',
      title: { de: 'Prognosen 12 Monate im Voraus', en: 'Forecasts 12 months ahead' },
      description: {
        de: 'Hollmann teilt den Bedarf rollierend für zwölf Monate.',
        en: 'Hollmann shares its demand on a rolling twelve-month basis.',
      },
      cadence: null,
      level: null,
    },
    {
      kind: 'obligation',
      group: 'collaboration',
      title: { de: 'Kapazität jedes Quartal melden', en: 'Report capacity every quarter' },
      description: {
        de: 'Auslastung und Engpässe vor jedem Quartal.',
        en: 'Utilisation and bottlenecks before every quarter.',
      },
      cadence: 'quarterly',
      level: null,
    },
    {
      kind: 'obligation',
      group: 'collaboration',
      title: { de: 'Liefertreue monatlich melden', en: 'Report delivery reliability monthly' },
      description: {
        de: 'Der Wert des Monats steht in der Scorecard.',
        en: 'The monthly value goes into the scorecard.',
      },
      cadence: 'monthly',
      level: null,
    },
    {
      kind: 'right',
      group: 'protection',
      title: {
        de: 'Änderungen sechs Monate vorher erfahren',
        en: 'Hear about changes six months ahead',
      },
      description: {
        de: 'Hollmann kündigt Änderungen an Bedarf und Spezifikation früh an.',
        en: 'Hollmann announces changes to demand and specification early.',
      },
      cadence: null,
      level: null,
    },
    {
      kind: 'obligation',
      group: 'protection',
      title: {
        de: 'Prozessänderungen vorher ankündigen',
        en: 'Announce process changes in advance',
      },
      description: {
        de: 'Prozess- und Standortänderungen mindestens drei Monate vorher.',
        en: 'Process and site changes at least three months ahead.',
      },
      cadence: null,
      level: null,
    },
    {
      kind: 'right',
      group: 'cost',
      title: { de: 'Rahmenvertrag über drei Jahre', en: 'Three-year framework agreement' },
      description: {
        de: 'Mengen und Preise mit Gleitklausel für Kupfer.',
        en: 'Volumes and prices with a copper escalation clause.',
      },
      cadence: null,
      level: null,
    },
    {
      kind: 'obligation',
      group: 'cost',
      title: {
        de: 'Kostenstruktur bei Preisanpassungen offenlegen',
        en: 'Disclose cost structure for price changes',
      },
      description: {
        de: 'Material, Arbeit und Energie getrennt.',
        en: 'Material, labour and energy separately.',
      },
      cadence: null,
      level: null,
    },
    {
      kind: 'right',
      group: 'growth',
      title: { de: 'Früh in neue Baureihen eingebunden', en: 'Early involvement in new series' },
      description: {
        de: 'Ab der Konzeptphase der Baureihe 2028.',
        en: 'From the concept phase of the 2028 series.',
      },
      cadence: null,
      level: null,
    },
    {
      kind: 'obligation',
      group: 'growth',
      title: {
        de: 'Vorschläge zu Verfahren und Werkstoffen',
        en: 'Proposals on processes and materials',
      },
      description: {
        de: 'Zweimal im Jahr, vorgestellt im JBP und im Halbjahresgespräch.',
        en: 'Twice a year, presented in the JBP and the half-year meeting.',
      },
      cadence: 'semiannual',
      level: null,
    },
    {
      kind: 'format',
      group: null,
      title: { de: 'Preise und Verträge', en: 'Prices and contracts' },
      description: { de: 'Einkauf und Key Account.', en: 'Purchasing and key account.' },
      cadence: 'quarterly',
      level: 'management',
    },
    {
      kind: 'format',
      group: null,
      title: { de: 'Rohstoffe', en: 'Raw materials' },
      description: { de: 'Commodity Management und Rohstoffeinkauf.', en: 'Commodity management.' },
      cadence: 'quarterly',
      level: 'operational',
    },
    {
      kind: 'format',
      group: null,
      title: { de: 'Qualität', en: 'Quality' },
      description: { de: 'Reklamationen, 8D und Audits.', en: 'Complaints, 8D and audits.' },
      cadence: 'quarterly',
      level: 'operational',
    },
    {
      kind: 'format',
      group: null,
      title: { de: 'Technik', en: 'Engineering' },
      description: {
        de: 'Werk, Verfahren und neue Baureihen.',
        en: 'Plant, processes and new series.',
      },
      cadence: 'semiannual',
      level: 'management',
    },
  ];
  await tx.insert(ruleSetItem).values(
    items.map((item, index) => ({
      id: nid(1741 + index),
      ruleSetId: setId,
      relationshipId,
      ownerOrgId: hollmannOrgId,
      visibility: 'shared' as const,
      ...item,
      origin: 'custom' as const,
      position: index + 1,
    })),
  );
  await tx.insert(relationshipTarget).values({
    id: nid(1760),
    relationshipId,
    ownerOrgId: hollmannOrgId,
    visibility: 'shared',
    typeName: 'Strategisch',
    typeDescription: refs.typeDescription,
    ruleSetId: setId,
    ruleSetVersion: 1,
    sharedAt: day('2026-10-15'),
    sharedBy: refs.saraOst.id,
    sharedByName: refs.saraOst.name,
  });
}
