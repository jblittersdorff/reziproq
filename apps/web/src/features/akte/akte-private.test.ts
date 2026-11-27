import type {
  ActionItem,
  ActivityItem,
  Segmentation,
  SupplierPlan,
  TouchpointList,
} from '@reziproq/shared';
import { describe, expect, it } from 'vitest';
import {
  closeDistance,
  ebitPotential,
  entriesByMonth,
  networkFinding,
  openTasks,
  orderedEntries,
  planFacts,
  segmentFacts,
  segmentDistance,
  unpairedContacts,
} from './akte-private';

// AK-01 (K2-c.3): Zahlen der Sicht Nur für dich, aus denen die Sätze entstehen (G-6).

const twoByTwo = { gridSize: 2 as const, lowMax: 50, midMax: 100 };
const threeByThree = { gridSize: 3 as const, lowMax: 33, midMax: 66 };

describe('segmentDistance: Abstand zur Grenze, unter der das Segment wechselt', () => {
  it('2 × 2: beide Achsen über 50, der kleinere Abstand zählt', () => {
    expect(
      segmentDistance(
        { impactScore: 80, qualityScore: 75, impactLevel: 2, qualityLevel: 2 },
        twoByTwo,
      ),
    ).toBe(25);
  });
  it('3 × 3: Stufe 3 misst gegen midMax, Stufe 2 gegen lowMax; eine Nachkommastelle', () => {
    expect(
      segmentDistance(
        { impactScore: 66.44, qualityScore: 50, impactLevel: 3, qualityLevel: 2 },
        threeByThree,
      ),
    ).toBe(0.4);
  });
  it('unterste Stufe auf einer Achse zählt nicht; auf beiden gibt es keine Grenze darunter', () => {
    expect(
      segmentDistance(
        { impactScore: 20, qualityScore: 58, impactLevel: 1, qualityLevel: 2 },
        twoByTwo,
      ),
    ).toBe(8);
    expect(
      segmentDistance(
        { impactScore: 20, qualityScore: 30, impactLevel: 1, qualityLevel: 1 },
        twoByTwo,
      ),
    ).toBeNull();
  });
});

type SegmentationData = NonNullable<Segmentation['segmentation']>;

const outcome = (impactScore: number, qualityScore: number, level = 2) => ({
  impactScore,
  qualityScore,
  impactLevel: level,
  qualityLevel: level,
  typeName: level === 2 ? 'Strategisch' : 'Hebel',
});

function segmentation(overrides: Partial<SegmentationData> = {}): SegmentationData {
  return {
    roundId: '00000000-0000-7000-8000-000000000001',
    roundName: 'Bewertungsrunde 2026',
    status: 'consolidated',
    model: {
      version: 1,
      ...twoByTwo,
      criteria: [
        {
          key: 'versorgungsrisiko',
          axis: 'impact',
          name: 'Versorgungsrisiko',
          description: '',
          weight: 100,
          position: 1,
        },
        {
          key: 'wertbeitrag',
          axis: 'quality',
          name: 'Wertbeitrag',
          description: '',
          weight: 50,
          position: 1,
        },
        {
          key: 'qualitaet',
          axis: 'quality',
          name: 'Qualität',
          description: '',
          weight: 50,
          position: 2,
        },
      ],
      types: [],
    },
    overall: { ist: outcome(80, 54), soll: outcome(80, 60), count: 4 },
    decision: {
      version: 1,
      decidedAt: '2026-09-12T10:00:00.000Z',
      decidedBy: { userId: 'sara', name: 'Sara Ost' },
      modelVersion: 1,
      entries: [
        {
          scope: 'total',
          businessUnit: null,
          materialGroup: null,
          ist: { impactLevel: 2, qualityLevel: 2, typeName: 'Strategisch' },
          soll: { impactLevel: 2, qualityLevel: 2, typeName: 'Strategisch' },
          reason: 'Runde 2026',
        },
      ],
    },
    groups: [],
    rows: [],
    stats: [
      { criterionKey: 'versorgungsrisiko', mean: 80, min: 72, max: 88 },
      { criterionKey: 'wertbeitrag', mean: 61.25, min: 40, max: 66 },
      { criterionKey: 'qualitaet', mean: 47, min: 45, max: 50 },
    ],
    ...overrides,
  };
}

describe('segmentFacts: Segment und Bewertung', () => {
  it('festgelegtes Segment mit Abstand, knapp unter 10 Punkten, Kriterien mit Mittel und Spanne', () => {
    const facts = segmentFacts(segmentation());
    expect(facts).toMatchObject({
      name: 'Strategisch',
      distance: 4,
      close: true,
      provisional: false,
      roundName: 'Bewertungsrunde 2026',
      ratings: 4,
      decidedAt: '2026-09-12T10:00:00.000Z',
    });
    expect(closeDistance).toBe(10);
    expect(facts?.criteria).toEqual([
      { key: 'versorgungsrisiko', name: 'Versorgungsrisiko', axis: 'impact', mean: 80, spread: 16 },
      { key: 'wertbeitrag', name: 'Wertbeitrag', axis: 'quality', mean: 61.3, spread: 26 },
      { key: 'qualitaet', name: 'Qualität', axis: 'quality', mean: 47, spread: 5 },
    ]);
  });

  it('weicht die Festlegung vom berechneten Segment ab, gibt es keinen Abstand', () => {
    const facts = segmentFacts(
      segmentation({ overall: { ist: outcome(30, 20, 1), soll: null, count: 2 } }),
    );
    expect(facts).toMatchObject({ name: 'Strategisch', distance: null, close: false });
  });

  it('ohne Festlegung das berechnete Segment, vorläufig; ohne Ergebnis nichts', () => {
    expect(segmentFacts(segmentation({ status: 'provisional', decision: null }))).toMatchObject({
      name: 'Strategisch',
      distance: 4,
      provisional: true,
      decidedAt: null,
    });
    expect(
      segmentFacts(segmentation({ decision: null, overall: { ist: null, soll: null, count: 0 } })),
    ).toBeNull();
    expect(segmentFacts(null)).toBeNull();
  });
});

function network(overrides: Partial<TouchpointList> = {}): TouchpointList {
  return {
    touchpoints: [
      {
        id: '00000000-0000-7000-8000-000000000011',
        visibility: 'internal',
        buyerUserId: 'sara',
        buyerName: 'Sara Ost',
        buyerLevel: 'management',
        supplierContactId: '00000000-0000-7000-8000-000000000721',
        supplierName: 'Tom Weber',
        supplierLevel: 'management',
        format: 'Preise und Verträge',
        cadence: 'quarterly',
        notes: null,
      },
      {
        id: '00000000-0000-7000-8000-000000000012',
        visibility: 'internal',
        buyerUserId: 'jonas',
        buyerName: 'Jonas Feld',
        buyerLevel: 'operational',
        supplierContactId: null,
        supplierName: 'lea brandt',
        supplierLevel: 'operational',
        format: 'Rohstoffe',
        cadence: 'monthly',
        notes: null,
      },
    ],
    gaps: [],
    formats: [],
    people: [],
    contacts: [
      { id: '00000000-0000-7000-8000-000000000720', name: 'Kim Kaiser' },
      { id: '00000000-0000-7000-8000-000000000721', name: 'Tom Weber' },
      { id: '00000000-0000-7000-8000-000000000722', name: 'Lea Brandt' },
      { id: '00000000-0000-7000-8000-000000000724', name: 'Nils Ott' },
    ],
    canEdit: true,
    review: null,
    canReview: false,
    ...overrides,
  };
}

describe('Beziehungsnetz: Kontakte ohne Gesprächspaar und was Das Wichtigste sagt', () => {
  it('ein Kontakt zählt als gepaart über die ID oder den Namen', () => {
    expect(unpairedContacts(network())).toEqual(['Kim Kaiser', 'Nils Ott']);
  });

  it('Lücken der Spielregeln vor leeren Netzen vor Kontakten ohne Paar; höchstens drei Namen', () => {
    expect(
      networkFinding(network({ gaps: [{ title: { de: 'QBR', en: 'QBR' }, level: null }] })),
    ).toEqual({ kind: 'gaps', count: 1 });
    expect(networkFinding(network({ touchpoints: [] }))).toEqual({ kind: 'empty' });
    expect(networkFinding(network())).toEqual({
      kind: 'unpaired',
      names: ['Kim Kaiser', 'Nils Ott'],
      more: 0,
    });
    const many = network({
      contacts: ['A', 'B', 'C', 'D', 'E'].map((name, index) => ({
        id: `00000000-0000-7000-8000-00000000080${index}`,
        name,
      })),
    });
    expect(networkFinding(many)).toEqual({ kind: 'unpaired', names: ['A', 'B', 'C'], more: 2 });
    expect(networkFinding(network({ contacts: [] }))).toBeNull();
    expect(networkFinding(null)).toBeNull();
  });
});

describe('Wert: Potenzial nur als EBIT', () => {
  it('neu und übernommen zusammen, Cash und Kostenvermeidung nie dazu', () => {
    expect(
      ebitPotential([
        {
          impactType: 'ebit',
          new: { low: 10_000_00, high: 20_000_00 },
          adopted: { low: 5_000_00, high: 8_000_00 },
          realized: { low: 1, high: 1 },
        },
        {
          impactType: 'cash',
          new: { low: 99_000_00, high: 99_000_00 },
          adopted: { low: 0, high: 0 },
          realized: { low: 0, high: 0 },
        },
      ]),
    ).toEqual({ low: 15_000_00, high: 28_000_00 });
    expect(ebitPotential([])).toBeNull();
  });
});

describe('Lieferantenplan und Aufgaben', () => {
  it('Freigabe mit Person und Datum, Themen nach Rang, Ziele außerhalb der Themen bleiben intern', () => {
    const objective = (id: string, text: string) => ({
      id,
      categoryKey: 'cost',
      categoryName: 'Kosten',
      businessUnit: null,
      materialGroup: null,
      text,
      owner: { userId: 'sara', name: 'Sara Ost' },
      targetYear: 2027,
      canEdit: false,
    });
    const plan = {
      status: 'approved',
      objectives: [
        objective('o1', 'Kapazität 2028 sichern'),
        objective('o2', 'Stückpreis −3 %'),
        objective('o3', 'Zweitquelle prüfen'),
      ],
      topics: [
        { id: 't2', title: 'Preis', reason: '', priority: 2, objectives: [{ id: 'o2', text: '' }] },
        {
          id: 't1',
          title: 'Kapazität',
          reason: '',
          priority: 1,
          objectives: [{ id: 'o1', text: '' }],
        },
      ],
      approval: {
        round: 1,
        submittedAt: '2026-09-30T08:00:00Z',
        approvedAt: '2026-10-03T08:00:00Z',
        hasSponsor: true,
        decisions: [
          {
            userName: 'Jan-Luka',
            role: 'sro',
            decision: 'approved',
            comment: null,
            decidedAt: '2026-10-01T08:00:00Z',
            round: 1,
          },
          {
            userName: 'Mara Weiß',
            role: 'sponsor',
            decision: 'approved',
            comment: null,
            decidedAt: '2026-10-03T08:00:00Z',
            round: 1,
          },
        ],
        hints: { openContributions: 0, noTopics: false },
        canSubmit: false,
      },
    } as unknown as SupplierPlan;
    expect(planFacts(plan)).toEqual({
      approvedBy: 'Mara Weiß',
      approvedAt: '2026-10-03T08:00:00Z',
      topics: ['Kapazität', 'Preis'],
      internal: ['Zweitquelle prüfen'],
    });
    expect(planFacts({ ...plan, status: 'draft' })).toMatchObject({
      approvedBy: null,
      approvedAt: null,
    });
  });

  it('offene Aufgaben: nur interne, offen oder in Arbeit, nach Frist', () => {
    const action = (id: string, kind: 'task' | 'commitment', status: string, dueDate: string) =>
      ({ id, kind, status, dueDate }) as ActionItem;
    expect(
      openTasks([
        action('a', 'task', 'open', '2026-12-10'),
        action('b', 'commitment', 'open', '2026-11-01'),
        action('c', 'task', 'done', '2026-11-01'),
        action('d', 'task', 'in_progress', '2026-12-01'),
      ]).map((task) => task.id),
    ).toEqual(['d', 'a']);
  });
});

describe('Verlauf: Angeheftetes oben, dann nach Monaten', () => {
  const entry = (id: string, occurredAt: string, pinned = false) =>
    ({ id, occurredAt, pinned }) as ActivityItem;
  const items = [
    entry('okt', '2026-10-26T09:00:00Z'),
    entry('nov', '2026-11-20T09:00:00Z'),
    entry('pin', '2026-11-02T09:00:00Z', true),
    entry('nov2', '2026-11-23T09:00:00Z'),
  ];

  it('Reihenfolge: angeheftet, dann das Vergangene neueste zuerst, Kommendes zuletzt', () => {
    const now = new Date('2026-11-24T12:00:00Z');
    expect(
      orderedEntries(
        [...items, entry('jbp', '2026-12-04T09:00:00Z'), entry('morgen', '2026-11-25T09:00:00Z')],
        now,
      ).map((item) => item.id),
    ).toEqual(['pin', 'nov2', 'nov', 'okt', 'morgen', 'jbp']);
  });

  it('Monate in Berliner Zeit, neueste zuerst, auch Angeheftetes geht nicht verloren', () => {
    expect(
      entriesByMonth([...items, entry('silvester', '2026-10-31T23:30:00Z')], 'de-DE').map(
        (group) => [group.month, group.items.map((item) => item.id)],
      ),
    ).toEqual([
      ['November 2026', ['nov2', 'nov', 'pin', 'silvester']],
      ['Oktober 2026', ['okt']],
    ]);
  });
});
