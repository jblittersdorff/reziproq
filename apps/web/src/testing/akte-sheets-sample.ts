import type {
  AssignmentResponse,
  KpiDetail,
  RuleSetResponse,
  SpendOverview,
  SupplierContact,
  SupplierDetail,
} from '@reziproq/shared';

// AK-01 (K2-c.5): Antworten für die Blätter Profil (Vorlage K2-Profil), Spielregeln und
// Kennzahl-Verlauf, für Rheintal. Frische Kopie je Aufruf. Team, Einladungen und Kontaktpunkte kommen
// aus den Beispielen der Sichten (akte-counterpart-sample, akte-private-sample).

const id = (n: number) => `00000000-0000-7000-8000-${String(n).padStart(12, '0')}`;
export const akteSheetsRelationship = id(1);
export const akteSheetsKpi = id(1703);

const supplier: SupplierDetail = {
  relationshipId: akteSheetsRelationship,
  name: 'Rheintal Elektronik GmbH (Demo)',
  organizationName: 'Rheintal Elektronik GmbH',
  country: 'DE',
  vatId: 'DE123456789',
  duns: '31-456-7890',
  externalRef: 'K-10442',
  notes: null,
  status: 'active',
  createdAt: '2026-10-01T08:00:00Z',
  endedAt: null,
  spend: [],
  permissions: { edit: true, editTeam: true },
  isFocus: true,
  materialGroups: ['Leiterplatten', 'Bestückte Baugruppen'],
};

const year = (value: number, cents: number) => ({
  year: value,
  kind: 'actual' as const,
  amountCents: cents,
  byBusinessUnit: [],
  byMaterialGroup: [],
});

const spend: SpendOverview = {
  currency: 'EUR',
  otherCurrencies: [],
  years: [
    year(2022, 290_000_000),
    year(2023, 310_000_000),
    year(2024, 340_000_000),
    year(2025, 390_000_000),
    year(2026, 420_000_000),
  ],
  kpis: {
    year: 2026,
    amount: { amountCents: 420_000_000, currency: 'EUR' },
    previous: { amountCents: 390_000_000, currency: 'EUR' },
    changeBasisPoints: 769,
    shareBasisPoints: 1400,
  },
  entries: [],
  options: { businessUnits: [], materialGroups: [] },
  canEdit: true,
};

const contact = (n: number, name: string, position: string | null) => ({
  id: id(720 + n),
  relationshipId: akteSheetsRelationship,
  name,
  email: `${name.toLowerCase().replace(' ', '-')}@rheintal.example`,
  function: null,
  position,
});

const contacts: SupplierContact[] = [
  contact(0, 'Kim Kaiser', 'Geschäftsführerin'),
  contact(1, 'Tom Weber', 'Key Account Manager'),
  contact(4, 'Nils Ott', 'Qualitätsleitung'),
];

const assignment: AssignmentResponse = {
  businessUnits: [
    { id: 'bu-1', name: 'Antriebe', code: 'AN', active: true },
    { id: 'bu-2', name: 'Sensorik', code: 'SE', active: true },
  ],
  materialGroups: [
    { id: 'mg-bb', name: 'Bestückte Baugruppen', code: 'BB', active: true, isPrimary: false },
    { id: 'mg-lp', name: 'Leiterplatten', code: 'LP', active: true, isPrimary: true },
  ],
  canEdit: true,
};

const text = (de: string, en: string) => ({ de, en });
const item = (
  n: number,
  kind: 'right' | 'obligation' | 'format',
  group: 'cost' | 'protection' | 'collaboration' | 'growth' | null,
  title: { de: string; en: string },
  cadence: 'monthly' | 'quarterly' | 'semiannual' | null,
  level: 'management' | 'operational' | null = null,
) => ({
  id: id(1741 + n),
  catalogItemId: null,
  origin: 'custom' as const,
  reason: null,
  kind,
  group,
  title,
  description: text(`Beschreibung ${title.de}`, `Description ${title.en}`),
  cadence,
  level,
});

const rules: RuleSetResponse = {
  current: {
    id: id(1740),
    version: 1,
    status: 'shared',
    visibility: 'shared',
    target: { impactLevel: 2, qualityLevel: 2, typeName: 'Strategisch' },
    items: [
      item(
        0,
        'right',
        'collaboration',
        text('Prognosen 12 Monate im Voraus', 'Forecasts 12 months ahead'),
        null,
      ),
      item(
        1,
        'obligation',
        'collaboration',
        text('Kapazität jedes Quartal melden', 'Report capacity every quarter'),
        'quarterly',
      ),
      item(
        2,
        'right',
        'cost',
        text('Rahmenvertrag über drei Jahre', 'Three-year framework agreement'),
        null,
      ),
      item(
        3,
        'obligation',
        'cost',
        text('Kostenstruktur offenlegen', 'Disclose cost structure'),
        null,
      ),
      item(4, 'format', null, text('Qualität', 'Quality'), 'quarterly', 'operational'),
    ],
    removed: [],
    approvedBy: 'Sara Ost',
    approvedAt: '2026-10-14T11:00:00.000Z',
  },
  target: { impactLevel: 2, qualityLevel: 2, typeName: 'Strategisch' },
  targetChanged: false,
  canManage: true,
  shared: {
    version: 1,
    typeName: 'Strategisch',
    typeDescription:
      'Hohes Versorgungsrisiko und hoher Wertbeitrag: gemeinsam planen und entwickeln.',
    sharedAt: '2026-10-15T11:00:00.000Z',
  },
};

const kpi: KpiDetail = {
  kpi: {
    id: akteSheetsKpi,
    own: false,
    ownerSide: 'supplier',
    initiative: null,
    name: 'Liefertreue',
    unit: '%',
    direction: 'higher',
    baseline: '92.0000',
    target: '97.0000',
    targetDate: '2027-12-31',
    ownerUserId: null,
    ownerName: 'Rheintal Elektronik',
    benefitFor: 'both',
    startDate: '2026-01-01',
    values: [
      { period: '2026-08-01', value: '93.0000' },
      { period: '2026-09-01', value: '95.0000' },
      { period: '2026-10-01', value: '94.0000' },
    ],
    track: 'close',
    canEnter: false,
  },
  values: [
    {
      period: '2026-08-01',
      value: '93.0000',
      source: 'manual',
      enteredByName: 'Tom Weber',
      enteredAt: '2026-09-04T11:00:00.000Z',
    },
    {
      period: '2026-09-01',
      value: '95.0000',
      source: 'manual',
      enteredByName: 'Tom Weber',
      enteredAt: '2026-10-05T11:00:00.000Z',
    },
    {
      period: '2026-10-01',
      value: '94.0000',
      source: 'csv',
      enteredByName: 'Tom Weber',
      enteredAt: '2026-11-04T11:00:00.000Z',
    },
  ],
  tolerancePercent: 10,
};

export interface AkteSheetsSample {
  supplier: SupplierDetail;
  spend: SpendOverview;
  contacts: SupplierContact[];
  assignment: AssignmentResponse;
  rules: RuleSetResponse;
  kpi: KpiDetail;
  /** Status je Endpunkt, etwa { rules: 500 } */
  status: Partial<Record<Exclude<keyof AkteSheetsSample, 'status'>, number>>;
}

/** Frische Antworten für die Blätter der Akte von Rheintal */
export function akteSheetsSample(): AkteSheetsSample {
  return structuredClone({ supplier, spend, contacts, assignment, rules, kpi, status: {} });
}
