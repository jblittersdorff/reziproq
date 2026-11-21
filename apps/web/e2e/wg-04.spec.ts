import { expect, type Page, test } from '@playwright/test';
import { fakeZitadel } from './fake-zitadel.js';

// WG-04, WG-06: Übersicht, Aufsetzen und Ziele der Warengruppenstrategie nach den Vorlagen, ohne
// seitliches Scrollen auf Telefonbreite und am Schreibtisch. WG-18: Lieferantenanalyse mit den
// Segmenten in der Warengruppe und die Seite der Bewertungsrunde.

test.use({ locale: 'de-DE' });

const uuid = (n: number) => `0190a0a0-0000-7000-8000-0000000000${String(n).padStart(2, '0')}`;
const group = uuid(10);
const strategyId = uuid(60);
const states = [
  'done',
  'in_progress',
  'done',
  'open',
  'open',
  'open',
  'open',
  'open',
  'open',
  'open',
];
const head = {
  id: group,
  name: 'Leiterplatten',
  code: 'LP',
  lead: { userId: 'lena', name: 'Lena Berger' },
  spend: { amountCents: 820_000_000, currency: 'EUR', year: 2025 },
  supplierCount: 7,
};
const row = (
  n: number,
  name: string,
  status: string | null,
  steps: string[],
  lead: string | null,
) => ({
  id: uuid(n),
  name,
  code: name.slice(0, 2).toUpperCase(),
  lead: lead ? { userId: lead, name: lead } : null,
  spend: { amountCents: n * 31_000_000, currency: 'EUR', year: 2025 },
  supplierCount: n % 7,
  strategy: status ? { id: uuid(n + 40), year: 2027, status, version: 1, steps } : null,
  hidden: false,
  canCreate: false,
});
const kpi = (n: number, dimension: string, name: string, unit: string | null) => ({
  id: uuid(n),
  dimension,
  name,
  description: null,
  unit,
  source: null,
  active: true,
});
const goal = (
  n: number,
  kpiId: string,
  dimension: string,
  text: string,
  values: number[] | null,
  reason?: string,
) => ({
  id: uuid(n),
  kpiId,
  dimension,
  text: reason ? '' : text,
  actual: values?.[0] ?? null,
  targetNextYear: values?.[1] ?? null,
  targetFinal: values?.[2] ?? null,
  targetQuarter: values ? 4 : null,
  targetYear: values ? 2028 : null,
  deferred: Boolean(reason),
  deferredReason: reason ?? null,
});

async function mock(page: Page) {
  await fakeZitadel(page);
  await page.route('**/api/me', (route) =>
    route.fulfill({
      json: {
        name: 'Lena Berger',
        firstName: 'Lena',
        email: 'lena@example.com',
        organization: { id: 'org-1', name: 'Test-OEM (Demo)' },
        supportView: false,
        orgRole: 'admin',
        permissions: {
          viewOrganizationSettings: true,
          viewBuyerAreas: true,
          viewSuppliers: true,
          viewCustomers: false,
          switchCustomer: false,
        },
      },
    }),
  );
  await page.route('**/api/me/permissions', (route) =>
    route.fulfill({
      json: {
        actions: [
          'organisation.sehen',
          'start.sehen',
          'prompt.nutzen',
          'suche.nutzen',
          'kunden.sehen',
        ],
      },
    }),
  );
  await page.route('**/api/health', (route) => route.fulfill({ json: { status: 'ok' } }));
  await page.route('**/api/warengruppen', (route) =>
    route.fulfill({
      json: {
        label: { singular: 'Warengruppe', plural: 'Warengruppen' },
        groups: [],
        unassignedSpendRows: 0,
        canManage: false,
      },
    }),
  );
  await page.route('**/api/warengruppen/strategien', (route) =>
    route.fulfill({
      json: {
        year: 2027,
        next: { materialGroupId: group, name: 'Leiterplatten', step: 2, strategyId },
        approvedCount: 1,
        groups: [
          {
            ...head,
            strategy: { id: strategyId, year: 2027, status: 'draft', version: 1, steps: states },
            hidden: false,
            canCreate: false,
          },
          row(21, 'Gussteile', 'approved', Array(10).fill('done'), 'Tom Berg'),
          row(
            22,
            'Spritzguss',
            'resubmit',
            ['done', 'done', 'done', 'done', 'done', 'in_progress', 'open', 'open', 'open', 'open'],
            'Ida Roth',
          ),
          row(23, 'Logistik', null, [], 'Max Klein'),
        ],
      },
    }),
  );
  await page.route(`**/api/warengruppen/${group}/strategie`, (route) =>
    route.fulfill({
      json: {
        year: 2027,
        hidden: false,
        canCreate: false,
        context: {
          group: head,
          strategy: { id: strategyId, year: 2027, status: 'draft', version: 1, steps: states },
          role: 'lead',
          editableSteps: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
        },
      },
    }),
  );
  await page.route(`**/api/warengruppen/${group}`, (route) =>
    route.fulfill({
      json: {
        label: { singular: 'Warengruppe', plural: 'Warengruppen' },
        group: {
          id: group,
          name: 'Leiterplatten',
          code: 'LP',
          description: null,
          active: true,
          lead: { userId: 'lena', name: 'Lena Berger' },
          commodityManager: { userId: 'jonas', name: 'Jonas Feld' },
        },
        parent: null,
        children: [],
        productGroups: [
          {
            id: uuid(31),
            name: 'Mehrlagen-Leiterplatten',
            description: '6 bis 12 Lagen, Standardmaterial. In allen drei Business Units.',
            position: 1,
          },
          {
            id: uuid(32),
            name: 'Starrflex',
            description: 'Für enge Bauräume. Nur Antriebe und Steuerungen.',
            position: 2,
          },
        ],
        members: [
          {
            id: uuid(33),
            userId: 'lena',
            name: 'Lena Berger',
            role: 'lead',
            businessUnit: { id: uuid(50), name: 'BU Antriebe' },
            region: null,
            task: 'Koordiniert das Team, verantwortet die Strategie',
          },
          {
            id: uuid(34),
            userId: 'jonas',
            name: 'Jonas Feld',
            role: 'commodity_manager',
            businessUnit: null,
            region: null,
            task: 'Bringt die Leitungssicht ein',
          },
          {
            id: uuid(35),
            userId: 'ida',
            name: 'Ida Roth',
            role: 'buyer',
            businessUnit: { id: uuid(51), name: 'BU Steuerungen' },
            region: null,
            task: 'Arbeitet die Strategie mit aus',
          },
        ],
        suppliers: [],
        canEdit: true,
        people: [],
        businessUnits: [],
      },
    }),
  );
  const typed = (impactLevel: number, qualityLevel: number, typeName: string) => ({
    impactLevel,
    qualityLevel,
    typeName,
  });
  const segmentSupplier = (
    n: number,
    name: string,
    spendCents: number,
    decision: [number, number, string] | null,
  ) => ({
    relationshipId: uuid(n),
    name,
    spendCents,
    currency: 'EUR',
    rateable: n !== 24,
    ratings: { submitted: 3, total: 4 },
    suggestion: { ist: typed(2, 2, 'Entwickeln'), soll: typed(3, 3, 'Strategisch') },
    decision: decision
      ? {
          ist: typed(decision[0], decision[1], decision[2]),
          soll: typed(3, 3, 'Strategisch'),
          reason: 'Im Team besprochen',
          origin: 'round',
          decidedAt: '2026-11-20T09:00:00Z',
          decidedBy: 'Lena Berger',
          version: 1,
        }
      : null,
    overall: { ist: typed(3, 3, 'Strategisch'), soll: typed(3, 3, 'Strategisch') },
  });
  await page.route(`**/api/warengruppen/${group}/segmentierung`, (route) =>
    route.fulfill({
      json: {
        group: { id: group, name: 'Leiterplatten' },
        spendYear: 2025,
        canManage: true,
        round: null,
        types: [
          { impactLevel: 3, qualityLevel: 3, name: 'Strategisch' },
          { impactLevel: 2, qualityLevel: 2, name: 'Entwickeln' },
          { impactLevel: 1, qualityLevel: 1, name: 'Routine' },
        ],
        raters: [
          { userId: 'lena', name: 'Lena Berger', function: 'purchasing' },
          { userId: 'tom', name: 'Tom Weber', function: 'quality' },
        ],
        suppliers: [
          segmentSupplier(21, 'Rheintal Elektronik', 310_000_000, [3, 3, 'Strategisch']),
          segmentSupplier(22, 'Saar Circuits', 220_000_000, [2, 2, 'Entwickeln']),
          segmentSupplier(23, 'Moldau PCB', 75_000_000, [2, 2, 'Entwickeln']),
          segmentSupplier(24, 'Donau Print Verwaltungsgesellschaft mbH', 60_000_000, null),
        ],
      },
    }),
  );
  await page.route(`**/api/warengruppen/strategien/${strategyId}/schritte/*`, (route) => {
    const n = Number(route.request().url().split('/').pop());
    const kpis = [
      kpi(40, 'supply', 'Bestätigte Kapazität', '%'),
      kpi(41, 'supply', 'Logistik-Bewertung', null),
      kpi(42, 'quality', 'Fehlerquote', 'ppm'),
      kpi(43, 'cost', 'Jährliche Preisverbesserung', '%'),
      kpi(44, 'technology', 'Innovationsprojekte', 'Anzahl'),
      kpi(45, 'sustainability', 'CO₂-Fußabdruck', 't CO₂e'),
    ];
    return route.fulfill({
      json: {
        step: n,
        questions: [
          {
            id: uuid(70),
            view: null,
            text:
              n === 1
                ? 'Wer kauft welche Produktgruppe, in welcher Business Unit und Region?'
                : 'Welche übergeordnete Strategie gilt? Immer die nächsthöhere ansehen.',
          },
          {
            id: uuid(71),
            view: null,
            text:
              n === 1 ? 'Wer koordiniert als Lead?' : 'Welche der fünf Dimensionen spricht sie an?',
          },
        ],
        notes: [
          {
            view: '',
            text: 'Versorgung und Kosten stehen im Fokus: Der Anlauf 2028 braucht mehr Kapazität.',
            notApplicable: false,
            updatedAt: '2026-11-20T09:00:00Z',
          },
        ],
        milestones:
          n === 1
            ? [
                { id: uuid(80), title: 'Analysen bestätigt', dueOn: '2026-12-14' },
                { id: uuid(81), title: 'Vorlage Leitungsgremium', dueOn: '2027-01-09' },
              ]
            : [],
        leadSuggestion: null,
        dimensions:
          n === 2
            ? [
                { key: 'supply', name: 'Versorgung' },
                { key: 'quality', name: 'Qualität' },
                { key: 'cost', name: 'Kosten' },
                { key: 'technology', name: 'Technologie' },
                { key: 'sustainability', name: 'Nachhaltigkeit' },
              ]
            : [],
        kpis: n === 2 ? kpis : [],
        goals:
          n === 2
            ? [
                goal(
                  90,
                  uuid(40),
                  'supply',
                  'Kapazität für den Anlauf 2028 absichern',
                  [82, 90, 100],
                ),
                goal(
                  91,
                  uuid(41),
                  'supply',
                  '',
                  null,
                  'Logistik läuft stabil, kein Handlungsbedarf',
                ),
                goal(92, uuid(42), 'quality', 'Reklamationen halbieren', [42, 30, 20]),
                goal(93, uuid(43), 'cost', 'Jährliche Preisverbesserung erhöhen', [3, 3.5, 3.5]),
                goal(94, uuid(45), 'sustainability', '', null, 'Daten noch nicht belastbar'),
              ]
            : [],
      },
    });
  });
}

const pages = [
  ['uebersicht', '/warengruppen', 'Warengruppen'],
  ['aufsetzen', `/warengruppen/${group}/strategie/1`, 'Team und Umfang festlegen'],
  ['ziele', `/warengruppen/${group}/strategie/2`, 'Messbare Ziele setzen'],
  ['lieferanten', `/warengruppen/${group}/strategie/4`, 'Die Lieferantenbasis analysieren'],
  [
    'segmentierung',
    `/warengruppen/${group}/segmentierung`,
    'Segmente in der Warengruppe festlegen',
  ],
] as const;

for (const width of [390, 1440]) {
  test(`Warengruppenstrategie ohne seitliches Scrollen (${width})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await mock(page);
    for (const [name, path, title] of pages) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
      await page.waitForLoadState('networkidle');
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        ),
        name,
      ).toBe(0);
      if (process.env.WG04_SHOTS)
        await page.screenshot({
          path: `${process.env.WG04_SHOTS}/wg04-${name}-${width}.png`,
          fullPage: true,
        });
    }
  });
}
