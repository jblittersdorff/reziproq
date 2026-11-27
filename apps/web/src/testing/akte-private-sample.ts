import type {
  ActionList,
  ActivityFeed,
  ActivityItem,
  SecuredResults,
  Segmentation,
  SupplierCategories,
  SupplierPlanResponse,
  TouchpointList,
  ValueOpportunities,
} from '@reziproq/shared';

// AK-01 (K2-c.3): Antworten der Endpunkte, aus denen die Sicht Nur für dich liest, für Rheintal
// (Vorlage K2-Akte-Privat). Ein Aufruf liefert eine frische Kopie; Notizen ändern sie im Test.

const id = (n: number) => `00000000-0000-7000-8000-${String(n).padStart(12, '0')}`;
export const aktePrivateRelationship = id(1);
const base = `/lieferanten/${aktePrivateRelationship}`;

const criterion = (key: string, axis: 'impact' | 'quality', name: string, position: number) => ({
  key,
  axis,
  name,
  description: `${name} aus Sicht von Hollmann`,
  weight: axis === 'impact' ? 100 : 33.33,
  position,
});

const segmentation: Segmentation = {
  segmentation: {
    roundId: id(1420),
    roundName: 'Bewertungsrunde 2027',
    status: 'consolidated',
    model: {
      version: 1,
      gridSize: 2,
      lowMax: 50,
      midMax: 100,
      criteria: [
        criterion('versorgungsrisiko', 'impact', 'Versorgungsrisiko', 1),
        criterion('wertbeitrag', 'quality', 'Wertbeitrag', 1),
        criterion('qualitaet', 'quality', 'Qualität', 2),
        criterion('innovation', 'quality', 'Innovation', 3),
      ],
      types: [],
    },
    overall: {
      ist: {
        impactScore: 72,
        qualityScore: 54,
        impactLevel: 2,
        qualityLevel: 2,
        typeName: 'Strategisch',
      },
      soll: {
        impactScore: 72,
        qualityScore: 60,
        impactLevel: 2,
        qualityLevel: 2,
        typeName: 'Strategisch',
      },
      count: 4,
    },
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
          reason: 'Bewertungsrunde 2027',
        },
      ],
    },
    groups: [],
    rows: [],
    stats: [
      { criterionKey: 'versorgungsrisiko', mean: 72, min: 66, max: 80 },
      { criterionKey: 'wertbeitrag', mean: 82, min: 70, max: 90 },
      { criterionKey: 'qualitaet', mean: 62, min: 40, max: 66 },
      { criterionKey: 'innovation', mean: 76, min: 70, max: 80 },
    ],
  },
};

const objective = (n: number, text: string) => ({
  id: id(860 + n),
  categoryKey: 'capacity',
  categoryName: 'Kapazität',
  businessUnit: null,
  materialGroup: { id: id(101), name: 'Leiterplatten' },
  text,
  owner: { userId: 'sara', name: 'Sara Ost' },
  targetYear: 2027,
  canEdit: false,
});

const plan: SupplierPlanResponse = {
  plan: {
    id: id(850),
    relationshipId: aktePrivateRelationship,
    cycleId: id(840),
    version: 2,
    status: 'approved',
    summary: '',
    createdAt: '2026-09-20T08:00:00.000Z',
    targetType: 'Strategisch',
    sro: { userId: 'sara', name: 'Sara Ost' },
    objectives: [
      objective(1, 'Kapazität 2028 sichern'),
      objective(2, 'Stückpreis −3 %'),
      objective(3, 'Reklamationen halbieren'),
      objective(4, 'Zweitquelle prüfen'),
    ],
    contributions: { done: 4, total: 4, items: [] },
    topics: [
      {
        id: id(871),
        title: 'Stückpreis −3 %',
        reason: '',
        priority: 2,
        objectives: [{ id: id(862), text: '' }],
      },
      {
        id: id(870),
        title: 'Kapazität 2028 sichern',
        reason: '',
        priority: 1,
        objectives: [{ id: id(861), text: '' }],
      },
      {
        id: id(872),
        title: 'Reklamationen halbieren',
        reason: '',
        priority: 3,
        objectives: [{ id: id(863), text: '' }],
      },
    ],
    canManage: true,
    approval: {
      round: 1,
      submittedAt: '2026-10-01T08:00:00.000Z',
      approvedAt: '2026-10-03T08:00:00.000Z',
      hasSponsor: true,
      decisions: [
        {
          userName: 'Sara Ost',
          role: 'sro',
          decision: 'approved',
          comment: null,
          decidedAt: '2026-10-03T08:00:00.000Z',
          round: 1,
        },
      ],
      hints: { openContributions: 0, noTopics: false },
      canSubmit: false,
      canDecide: false,
      canNewVersion: false,
    },
  },
  cycleId: id(840),
  categories: [],
  teamCandidates: [],
  canCreate: true,
};

const segment = (quality: number, name: string) => ({
  impactLevel: 2,
  qualityLevel: quality,
  name,
});

const categories: SupplierCategories = {
  relationshipId: aktePrivateRelationship,
  supplierName: 'Rheintal Elektronik GmbH (Demo)',
  spendYear: 2025,
  currency: 'EUR',
  totalCents: 420_000_000,
  rows: [
    {
      groupId: id(101),
      groupName: 'Leiterplatten',
      lead: { userId: 'sara', name: 'Sara Ost' },
      amountCents: 310_000_000,
      shareInGroup: 0.38,
      segmentIst: segment(1, 'Engpass'),
      sollType: { kind: 'segment', ...segment(2, 'Strategisch') },
      qualityLevel: 1,
      strategy: null,
    },
    {
      groupId: id(102),
      groupName: 'Bestückte Baugruppen',
      lead: { userId: 'ida', name: 'Ida Roth' },
      amountCents: 90_000_000,
      shareInGroup: 0.2,
      segmentIst: segment(2, 'Strategisch'),
      sollType: { kind: 'segment', ...segment(2, 'Strategisch') },
      qualityLevel: 2,
      strategy: { id: id(880), year: 2027, version: 1, status: 'approved' },
    },
    {
      groupId: id(103),
      groupName: 'Kabelsätze',
      lead: null,
      amountCents: 20_000_000,
      shareInGroup: 0.05,
      segmentIst: segment(1, 'Engpass'),
      sollType: { kind: 'ended' },
      qualityLevel: 1,
      strategy: null,
    },
  ],
  conflicts: [
    {
      id: id(890),
      ruleKey: 'phase_out_vs_growth',
      groups: [{ id: id(103), name: 'Kabelsätze' }],
      status: 'open',
      note: null,
      decidedBy: null,
      decidedAt: null,
      createdAt: '2026-11-01T08:00:00.000Z',
      canResolve: true,
    },
  ],
  proposal: null,
  decided: { ist: 'Strategisch', soll: 'Strategisch', origin: 'round' },
  canAdopt: false,
};

const secured: SecuredResults = {
  fiscalYear: 2026,
  fiscalYears: [2026],
  currency: 'EUR',
  steps: [],
  securedEbitCents: 7_400_000,
  target: { ebitTargetCents: 10_000_000, approved: true },
  pending: { months: 0, initiatives: 0, amountCents: 0 },
  others: [],
  statement: null,
};

const opportunities = {
  researchEnabled: false,
  canRun: true,
  canDecide: true,
  lastRun: null,
  counts: { new: 2, adopted: 1, realized: 0 },
  totals: [
    {
      impactType: 'ebit',
      new: { low: 10_000_000, high: 15_000_000 },
      adopted: { low: 4_000_000, high: 5_000_000 },
      realized: { low: 0, high: 0 },
    },
    {
      // Cash zählt nie zum EBIT-Potenzial
      impactType: 'cash',
      new: { low: 90_000_000, high: 90_000_000 },
      adopted: { low: 0, high: 0 },
      realized: { low: 0, high: 0 },
    },
  ],
  opportunities: [],
  checked: {
    templates: 0,
    checkable: 0,
    withOpportunity: 0,
    withoutOpportunity: [],
    notCheckable: 0,
    signals: 0,
  },
  signals: [],
  dataGaps: [],
  outbound: [],
  statement: null,
} as unknown as ValueOpportunities;

const touchpoint = (
  n: number,
  format: string,
  buyerName: string,
  supplierName: string,
  contact: number | null,
  notes: string | null,
  visibility: 'internal' | 'shared' = 'internal',
) => ({
  id: id(1800 + n),
  visibility,
  buyerUserId: null,
  buyerName,
  buyerLevel: 'management' as const,
  supplierContactId: contact === null ? null : id(contact),
  supplierName,
  supplierLevel: 'management' as const,
  format,
  cadence: n === 4 ? ('semiannual' as const) : ('quarterly' as const),
  notes,
});

const touchpoints: TouchpointList = {
  touchpoints: [
    touchpoint(1, 'Preise und Verträge', 'Sara Ost', 'Tom Weber', 721, 'Entscheidet: Kim Kaiser'),
    touchpoint(2, 'Rohstoffe', 'Jonas Feld', 'Lea Brandt', 722, null),
    touchpoint(3, 'Qualität', 'Ida Roth', 'Tom Weber', 721, 'Entscheidet: Nils Ott'),
    touchpoint(4, 'Technik', 'Tom Berg', 'Mia Kuhn', null, null, 'shared'),
  ],
  gaps: [],
  formats: [],
  people: [],
  contacts: [
    { id: id(720), name: 'Kim Kaiser' },
    { id: id(721), name: 'Tom Weber' },
    { id: id(722), name: 'Lea Brandt' },
    { id: id(723), name: 'Mia Kuhn' },
    { id: id(724), name: 'Nils Ott' },
  ],
  canEdit: true,
  review: null,
  canReview: false,
};

const entry = (overrides: Partial<ActivityItem> & Pick<ActivityItem, 'id' | 'kind'>) =>
  ({
    occurredAt: '2026-11-20T09:00:00.000Z',
    actor: { type: 'person', name: 'Anna Schmidt' },
    title: '',
    code: null,
    meta: null,
    href: null,
    visibility: 'team',
    pinned: false,
    mine: false,
    ...overrides,
  }) as ActivityItem;

const activities: ActivityFeed = {
  canWrite: true,
  items: [
    entry({
      id: `mail:${id(640)}`,
      kind: 'mail',
      occurredAt: '2026-11-20T08:00:00.000Z',
      title: 'Liefertreue Oktober 94 %',
      mail: {
        id: id(640),
        fromEmail: 'tom-weber@rheintal.example',
        fromName: 'Tom Weber',
        sentAt: '2026-11-20T07:50:00.000Z',
        summary: 'Tom Weber meldet 94 % Liefertreue im Oktober und erklärt die Lücke mit Laminat.',
        source: 'forward',
        attachments: [],
      },
    }),
    entry({
      id: `note:${id(650)}`,
      kind: 'note',
      occurredAt: '2026-11-19T15:00:00.000Z',
      title: 'Gespräch mit Tom Weber, zwei Themen fürs JBP',
      visibility: 'private',
      mine: true,
    }),
    entry({
      id: `note:${id(651)}`,
      kind: 'note',
      occurredAt: '2026-11-02T10:00:00.000Z',
      actor: { type: 'person', name: 'Jonas Feld' },
      title: 'Linie Kupfer: Basis 10/2026, Anpassung ab 5 % Indexänderung, beide Richtungen',
      pinned: true,
    }),
    entry({
      id: `hint:${id(1607)}`,
      kind: 'hint',
      occurredAt: '2026-11-18T06:00:00.000Z',
      actor: { type: 'reziproq' },
      code: 'supplier_commitment_overdue',
      meta: 'in_progress',
      href: `/warum/${id(1607)}`,
    }),
    entry({
      id: `meeting:${id(600)}`,
      kind: 'meeting',
      occurredAt: '2026-09-24T09:00:00.000Z',
      actor: { type: 'person', name: 'Sara Ost' },
      title: 'QBR Q3 mit Rheintal',
      meta: 'Teams',
      href: `${base}/umsetzung/termine/${id(600)}`,
    }),
    entry({
      id: `mail:${id(641)}`,
      kind: 'mail',
      occurredAt: '2026-10-26T12:00:00.000Z',
      actor: { type: 'person', name: 'Ida Roth' },
      title: 'Reklamation Charge 4711',
      mail: {
        id: id(641),
        fromEmail: 'ida-roth@hollmann.example',
        fromName: 'Ida Roth',
        sentAt: '2026-10-26T11:50:00.000Z',
        summary: null,
        source: 'forward',
        attachments: [],
      },
    }),
    entry({
      id: `agent:${id(1500)}`,
      kind: 'agent',
      occurredAt: '2026-10-15T07:00:00.000Z',
      actor: { type: 'reziproq' },
      code: 'brief_goals',
      meta: 'draft',
    }),
  ],
};

const action = (
  n: number,
  title: string,
  kind: 'task' | 'commitment',
  status: 'open' | 'in_progress' | 'done',
  dueDate: string,
  overdue = false,
) => ({
  id: id(900 + n),
  kind,
  title,
  description: null,
  visibility: kind === 'task' ? ('internal' as const) : ('shared' as const),
  side: 'buyer' as const,
  own: true,
  ownerSide: 'buyer' as const,
  ownerUserId: 'sara',
  ownerName: 'Sara Ost',
  dueDate,
  status,
  evidence: null,
  overdue,
  sourceType: 'manual' as const,
  sourceId: null,
  sourceTitle: null,
  sourceDimension: null,
  canEdit: true,
  canChangeStatus: true,
});

const actions: ActionList = {
  actions: [
    action(1, 'Angebot Zweitquelle anfragen', 'task', 'open', '2026-12-15'),
    action(2, 'Abnahmeplan SMT-Linie', 'commitment', 'open', '2027-02-28'),
    action(3, 'Kupferklausel prüfen', 'task', 'in_progress', '2026-11-10', true),
    action(4, 'Audit vorbereiten', 'task', 'done', '2026-10-01'),
  ],
  canCreate: true,
  people: [],
};

export interface AktePrivateSample {
  segmentation: Segmentation;
  plan: SupplierPlanResponse;
  categories: SupplierCategories;
  secured: SecuredResults;
  opportunities: ValueOpportunities;
  touchpoints: TouchpointList;
  activities: ActivityFeed;
  actions: ActionList;
  /** Status je Endpunkt, etwa { plan: 500 } oder { secured: 403 } */
  status: Partial<Record<Exclude<keyof AktePrivateSample, 'status'>, number>>;
}

/** Frische Antworten für Rheintal nach der Vorlage K2-Akte-Privat */
export function aktePrivateSample(): AktePrivateSample {
  return structuredClone({
    segmentation,
    plan,
    categories,
    secured,
    opportunities,
    touchpoints,
    activities,
    actions,
    status: {},
  });
}
