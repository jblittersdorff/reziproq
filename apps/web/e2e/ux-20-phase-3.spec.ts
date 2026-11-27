import { expect, type Page, test } from '@playwright/test';
import { relationshipList, relationshipRow, routeRelationships } from './relationships.js';
import { signIn } from './route-walk.js';

// UX-20 Phase 3 (NAV-10 1.1, Ablauf 2 „Lieferant“): Liste → Akte (AK-01, seit K2-c.2) → Blatt Profil
// (K2-c.5) → Profil bearbeiten → Überblick nur über Zeilen und Links. Liste nach Aufmerksamkeit mit Filter-Chips (seit BZ-01, K2-b.4),
// Lieferantenkopf auf jeder Seite des Lieferanten, Überblick mit vier Phasen und genau einer Karte
// „Als Nächstes“. Bei 390 px kein seitliches Scrollen. Die Zahlen sind Testdaten.

test.use({ locale: 'de-DE', colorScheme: 'light' });

const id = (n: number) => `550e8400-e29b-41d4-a716-4466554400${String(n).padStart(2, '0')}`;
const rheintal = id(10);
const base = `/lieferanten/${rheintal}`;
const day = (offset: number) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const mio = (value: number) => Math.round(value * 100_000_000);

const suppliers = [
  [11, 'Pearl River Components', 'CN', 'Elektronik', 5.64, false],
  [10, 'Rheintal Elektronik', 'DE', 'Leiterplatten', 4.2, true],
  [12, 'Silesia Guss', 'PL', 'Guss', 3.15, true],
  [13, 'Lombardia Fonderie', 'IT', 'Guss', 2.71, false],
  [14, 'Alpen Sensorik', 'AT', 'Sensorik', 2.26, false],
  [15, 'Moravia Plast', 'CZ', 'Kunststoff', 1.94, false],
] as const;

const meeting = (n: number, relationshipId: string, title: string, offset: number) => ({
  id: `m-${n}`,
  date: day(offset),
  kind: 'meeting',
  source: 'meeting',
  title,
  counterpart: 'Rheintal Elektronik',
  detail: 'Teams',
  startsAt: new Date(`${day(offset)}T10:00:00`).toISOString(),
  progress: null,
  href: `/lieferanten/${relationshipId}/umsetzung/termine/m${n}`,
  relationshipId,
  categoryId: null,
});

const cycleSteps = [
  'segment',
  'feedback',
  'touchpoints',
  'supplierPlan',
  'jbp',
  'scorecard',
  'execution',
] as const;

const kpi = (
  n: number,
  name: string,
  unit: string,
  values: string[],
  target: string,
  track: string,
) => ({
  id: id(60 + n),
  own: true,
  ownerSide: 'buyer',
  initiative: null,
  name,
  unit,
  direction: 'higher',
  baseline: values[0] ?? null,
  target,
  targetDate: day(120),
  ownerUserId: null,
  ownerName: 'Lena Berger',
  benefitFor: 'both',
  startDate: day(-200),
  values: values.map((value, index) => ({ period: `2026-0${index + 1}-01`, value })),
  track,
  canEnter: true,
});

async function mock(page: Page) {
  await signIn(page, { locale: 'de' });
  const json = (path: string, body: unknown) =>
    page.route(path, (route) => route.fulfill({ json: body }));
  await json('**/api/suppliers', {
    suppliers: suppliers.map(([n, name, country, group, spend, focus]) => ({
      relationshipId: id(n),
      name,
      country,
      externalRef: `L-1${n}`,
      status: 'active',
      spend: { amountCents: mio(spend), currency: 'EUR' },
      primaryMaterialGroup: group,
      materialGroups: [group],
      isFocus: focus,
      isMine: n !== 11,
      targetType: focus ? '3-2' : null,
      segmentType: n === 13 ? null : '3-2',
      sroName: 'Sara Ost',
    })),
    count: suppliers.length,
    spendYear: 2025,
    totalSpend: [{ amountCents: mio(19.9), currency: 'EUR' }],
  });
  // BZ-01: Die Liste liest GET /api/beziehungen, nach Aufmerksamkeit geordnet
  const byId = new Map(suppliers.map((entry) => [entry[0], entry]));
  const listRow = (
    n: 10 | 11 | 12 | 13 | 14 | 15,
    extra: Parameters<typeof relationshipRow>[1] = {},
  ) => {
    const [, name, country, group, spend, focus] = byId.get(n) ?? suppliers[0];
    return relationshipRow(n, {
      relationshipId: id(n),
      name,
      country,
      materialGroup: group,
      spend: { amountCents: mio(spend), currency: 'EUR' },
      isFocus: focus,
      isMine: n !== 11,
      segment: n === 13 ? null : { key: '3-2', name: 'Strategisch' },
      ...extra,
    });
  };
  await routeRelationships(page, [
    listRow(10, {
      reason: { kind: 'overdue', count: 1, title: 'Musterteile bestätigen' },
      attention: 5,
      quota: {
        own: { kept: 9, due: 10, percent: 90 },
        counterpart: { kept: 7, due: 9, percent: 78 },
      },
    }),
    listRow(12, {
      reason: {
        kind: 'hint',
        hint: {
          id: id(70),
          ruleKey: 'performance_drop',
          severity: 'medium',
          status: 'open',
          title: null,
          metric: null,
          value: null,
        },
      },
      attention: 3,
    }),
    listRow(13, { reason: { kind: 'unrated' }, attention: 2 }),
    listRow(11),
    listRow(14),
    listRow(15),
  ]);
  await json('**/api/start/brauchen-dich', {
    items: [
      { relationshipId: id(12), reason: 'hint', title: 'performance_drop' },
      { relationshipId: id(11), reason: 'due', title: 'Zweitlieferant prüfen' },
      { relationshipId: rheintal, reason: 'commitment', title: 'Musterteile bestätigen' },
    ],
  });
  await json('**/api/start/termine?tage=60', {
    from: day(0),
    to: day(59),
    items: [meeting(1, id(14), 'QBR Alpen Sensorik', 16)],
  });
  await json(`**/api/start/termine?tage=42&beziehung=${rheintal}`, {
    from: day(0),
    to: day(41),
    items: [
      meeting(2, rheintal, 'Agenda an Rheintal', 3),
      meeting(3, rheintal, 'JBP Rheintal', 10),
    ],
  });
  await json(`**/api/start/als-naechstes?beziehung=${rheintal}`, {
    next: {
      scope: 'relationship',
      item: {
        id: 'contribution-1',
        kind: 'contribution',
        supplier: 'Rheintal Elektronik',
        detail: 'Gemeinsamer Plan 2027',
        dueDate: day(2),
        href: `${base}/plan/vorbereitung`,
      },
      overdueDays: -2,
      minutes: 15,
    },
  });
  const detail = {
    relationshipId: rheintal,
    name: 'Rheintal Elektronik',
    organizationName: 'Rheintal Elektronik GmbH',
    country: 'DE',
    vatId: 'DE123456789',
    duns: '314567890',
    externalRef: 'K-10442',
    notes: null,
    status: 'active',
    createdAt: '2026-10-01T08:00:00Z',
    endedAt: null,
    spend: [
      { year: 2026, amount: { amountCents: mio(4.2), currency: 'EUR' } },
      { year: 2025, amount: { amountCents: mio(3.9), currency: 'EUR' } },
      { year: 2024, amount: { amountCents: mio(3.4), currency: 'EUR' } },
      { year: 2023, amount: { amountCents: mio(3.1), currency: 'EUR' } },
    ],
    permissions: { edit: true, editTeam: true },
    isFocus: true,
    materialGroups: ['Leiterplatten', 'Baugruppen'],
  };
  await json(`**/api/suppliers/${rheintal}`, detail);
  await json(`**/api/suppliers/${rheintal}/overview`, {
    head: {
      segment: { current: 'Entwickeln', target: 'Strategisch' },
      sro: { userId: 'sara', name: 'Sara Ost' },
      nextMeeting: { date: day(10) },
      isFocus: true,
    },
    metrics: [
      {
        tile: 'plan',
        kind: 'jbp',
        status: 'draft',
        meetingDate: day(10),
        topics: 4,
        initiatives: 3,
      },
      { tile: 'relationship', kind: 'team_size', count: 4 },
      {
        tile: 'relationship',
        kind: 'rules',
        typeName: 'Strategisch',
        version: 2,
        sharedAt: '2026-10-05T08:00:00Z',
      },
    ],
    cycle: {
      id: id(90),
      label: '2026',
      startedAt: '2026-01-01T00:00:00.000Z',
      jbpDate: day(10),
      schedule: ['feedback', 'touchpoints', 'supplierPlan', 'jbp', 'scorecard'].map(
        (step, index) => ({
          step,
          weeksRelativeToJbp: index - 3,
          reminderDaysBefore: 7,
          dueDate: null,
        }),
      ),
      steps: cycleSteps.map((key, index) => ({
        key,
        status: index < 4 ? 'completed' : 'open',
        href: `${base}/plan/vorbereitung`,
        dueDate: null,
      })),
    },
    canStartCycle: true,
    canSetJbpDate: true,
    openHints: 2,
    overdueCommitments: 1,
    openDrafts: 3,
    upcomingAwards: 1,
    openConflicts: 0,
    figures: {
      spend: {
        year: 2026,
        amount: { amountCents: mio(4.2), currency: 'EUR' },
        changeBasisPoints: 769,
      },
      groupShare: { group: 'Leiterplatten', year: 2026, basisPoints: 3_800 },
      feedbackGap: { dimension: 'transparency', delta: -0.9 },
    },
  });
  await json(`**/api/suppliers/${rheintal}/ergebnisse/ringe`, {
    fiscalYear: 2026,
    currency: 'EUR',
    securedEbitCents: 7_400_000,
    target: { ebitTargetCents: 10_000_000, approved: true, proposedBy: 'Sara Ost' },
    commitments: { due: 6, keptOnTime: 5 },
    canPropose: true,
    canApprove: false,
    chance: {
      opportunityId: id(70),
      templateKey: 'index_clause',
      impactType: 'ebit',
      low: 14_000_000,
      high: 20_000_000,
      confidence: 'medium',
    },
    risk: {
      hintId: id(71),
      ruleKey: 'performance_drop',
      detail: { kpi: 'Prognosetreue', months: 3 },
      severity: 'medium',
    },
    statement: null,
  });
  await json(`**/api/suppliers/${rheintal}/aktivitaeten`, {
    canWrite: true,
    items: [
      {
        id: 'a1',
        kind: 'note',
        occurredAt: new Date().toISOString(),
        actor: { type: 'person', name: 'Tom Weber' },
        title: 'Lieferzeiten Q1 besprochen',
        code: null,
        meta: null,
        href: null,
        visibility: 'team',
        pinned: false,
        mine: false,
      },
    ],
  });
  await json(`**/api/suppliers/${rheintal}/jbp/scorecard`, {
    hasPlan: true,
    ownSide: 'buyer',
    status: 'signed',
    version: 2,
    kpis: [
      kpi(1, 'Liefertreue', '%', ['90', '92', '94'], '97', 'close'),
      kpi(2, 'Erstmusterquote', '%', ['88', '95', '98'], '97', 'on_track'),
      kpi(3, 'Prognosetreue', '%', ['70', '71', '72'], '85', 'off'),
    ],
    signatures: [],
    deadline: null,
    tolerancePercent: 10,
    canEdit: false,
    canSign: false,
    canNewVersion: false,
    people: [],
    initiatives: [],
  });
  const touchpoint = (n: number, name: string, level: string, cadence: string) => ({
    id: id(80 + n),
    visibility: 'shared',
    buyerUserId: 'sara',
    buyerName: 'Sara Ost',
    buyerLevel: 'management',
    supplierContactId: id(85 + n),
    supplierName: name,
    supplierLevel: level,
    format: 'QBR',
    cadence,
    notes: null,
  });
  await json(`**/api/suppliers/${rheintal}/kontaktpunkte`, {
    touchpoints: [
      touchpoint(1, 'Tom Weber', 'management', 'monthly'),
      touchpoint(2, 'Mia Kuhn', 'operational', 'quarterly'),
    ],
    gaps: [{ title: { de: 'Geschäftsleitung', en: 'Executive board' }, level: 'executive' }],
    formats: [],
    people: [],
    contacts: [],
    canEdit: true,
    review: null,
    canReview: false,
  });
  await json(
    `**/api/suppliers/${rheintal}/contacts`,
    [
      ['Tom Weber', 'Key Account', 'tom@rheintal.example', 'Vertrieb'],
      ['Nils Ott', 'Qualitätsleitung', 'nils@rheintal.example', 'Qualität'],
      ['Kim Kaiser', 'Geschäftsführung', 'kim@rheintal.example', 'Geschäftsleitung'],
    ].map(([name, position, email, fn], index) => ({
      id: id(90 + index + 1),
      relationshipId: rheintal,
      name,
      email,
      function: fn,
      position,
    })),
  );
  await json(`**/api/suppliers/${rheintal}/spend`, {
    currency: 'EUR',
    otherCurrencies: [],
    years: [2023, 2024, 2025, 2026].map((year, index) => ({
      year,
      kind: 'actual',
      amountCents: mio([3.1, 3.4, 3.9, 4.2][index] ?? 0),
      byBusinessUnit: [],
      byMaterialGroup: [],
    })),
    kpis: {
      year: 2026,
      amount: { amountCents: mio(4.2), currency: 'EUR' },
      previous: { amountCents: mio(3.9), currency: 'EUR' },
      changeBasisPoints: 769,
      shareBasisPoints: 2_100,
    },
    entries: [],
    options: { businessUnits: [], materialGroups: [] },
    canEdit: true,
  });
  await json(`**/api/suppliers/${rheintal}/zuordnung`, {
    businessUnits: [{ id: id(95), name: 'Antriebe', code: 'ANT', active: true }],
    materialGroups: [
      { id: id(96), name: 'Leiterplatten', code: 'LP', active: true, isPrimary: true },
      { id: id(97), name: 'Baugruppen', code: 'BG', active: true, isPrimary: false },
    ],
    canEdit: true,
  });
  await json(`**/api/suppliers/${rheintal}/profil`, {
    company: {
      headquarters: 'Karlsruhe',
      foundedYear: 1987,
      employees: 840,
      businessSegments: 'Leiterplatten und Baugruppen für die Automobilindustrie',
    },
    implications: null,
    updatedByName: 'Lena Berger',
    updatedAt: '2026-11-02T08:00:00Z',
    executives: [],
    financials: [],
    share: null,
    canEdit: true,
  });
  // AK-01 (K2-c.2): Die Zeile öffnet die Akte; Kopf und Sicht Gemeinsam, ohne offene Zusagen
  await json(`**/api/beziehungen/${rheintal}`, {
    relationshipId: rheintal,
    name: 'Rheintal Elektronik',
    status: 'active',
    segment: { key: '3-2', name: 'Strategisch' },
    isFocus: true,
    materialGroups: ['Leiterplatten'],
    lead: 'Sara Ost',
    year: 2026,
    spend: { amountCents: mio(4.2), currency: 'EUR' },
    nextMeeting: null,
  });
  await json(`**/api/beziehungen/${rheintal}/gemeinsam`, {
    year: 2026,
    counterpart: 'Rheintal Elektronik',
    quota: {
      own: { kept: 9, due: 10, percent: 90 },
      counterpart: { kept: 7, due: 9, percent: 78 },
    },
    commitments: [],
    kept: { count: 16, last: null },
    scorecard: null,
    weeks: [],
    plan: null,
    rules: null,
    feedback: [],
    team: { own: [], counterpart: [] },
  });
  await page.route('**/api/audit**', (route) => route.fulfill({ json: { entries: [] } }));
}

const sideScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

/** Hauptknöpfe außerhalb der Karte „Als Nächstes“ (NAV-10 Seitenregel 3) */
const primaryOutsideNext = (page: Page) =>
  page.evaluate(
    () =>
      [...document.querySelectorAll('#inhalt .bg-primary')].filter(
        (element) => !element.closest('[data-slot="next-card"]'),
      ).length,
  );

const pages = [
  { path: '/beziehungen', title: 'Lieferanten', shot: 'beziehungen' },
  { path: base, title: 'Rheintal Elektronik', shot: 'ueberblick' },
  { path: `${base}/strategie/profil`, title: 'Profil und Spend', shot: 'profil' },
  { path: `${base}/plan/themen`, title: 'Themen', shot: 'kopf-unterseite' },
];

for (const target of pages) {
  for (const width of [390, 1440]) {
    test(`${target.title} bei ${width} px`, async ({ page }) => {
      await mock(page);
      await page.setViewportSize({ width, height: 900 });
      await page.goto(target.path);
      await expect(
        page.getByRole('heading', { level: 1, name: target.title, exact: false }),
      ).toBeVisible();
      await page.waitForLoadState('networkidle');
      const wide = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>('body *')]
          .filter((element) => element.getBoundingClientRect().right > window.innerWidth + 1)
          .map(
            (element) =>
              `${element.tagName.toLowerCase()}.${String(element.className).slice(0, 60)}`,
          )
          .slice(-5),
      );
      expect(wide).toEqual([]);
      expect(await sideScroll(page)).toBe(0);
      expect(await page.locator('[data-slot="next-card"]').count()).toBeLessThanOrEqual(1);
      expect(await primaryOutsideNext(page)).toBe(0);
      if (target.path.startsWith(base)) {
        const header = page.locator('[data-slot="supplier-header"]');
        await expect(header.getByRole('link', { name: 'Lieferanten', exact: true })).toBeVisible();
        await expect(
          header.getByRole('navigation', { name: 'Bereiche des Lieferanten' }).getByRole('link'),
        ).toHaveText(['Überblick', 'Aktivitäten', 'Plan', 'Ergebnisse']);
        await expect(
          header.getByRole('link', { name: 'Profil, Segmentierung und Team' }),
        ).toBeVisible();
      }
      if (process.env.UX_SHOTS) {
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({
          path: `${process.env.UX_SHOTS}/${target.shot}-${width}.png`,
          fullPage: true,
        });
      }
    });
  }
}

test('Ablauf 2: Liste → Akte → Blatt Profil → Bearbeiten → Überblick nur über Zeilen und Links', async ({
  page,
}) => {
  await mock(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/beziehungen');
  const list = relationshipList(page);
  // Nach Aufmerksamkeit: überfällige Zusage, Hinweis, ohne Bewertung, dann nach Spend
  await expect(list.locator('a[href^="/beziehungen/"] b')).toHaveText([
    'Rheintal Elektronik',
    'Silesia Guss',
    'Lombardia Fonderie',
    'Pearl River Components',
    'Alpen Sensorik',
    'Moravia Plast',
  ]);
  // Ein Hinweis ohne Kennzahl trägt den Namen seiner Regel
  await expect(list.getByRole('link', { name: /Silesia Guss/ })).toContainText('Leistung kippt');
  // BZ-01, AK-01 (K2-c.2): Die Zeile öffnet die Akte direkt, ohne Detailleiste
  await list.getByRole('link', { name: /Rheintal Elektronik/ }).click();
  await expect(page).toHaveURL(new RegExp(`/beziehungen/${rheintal}$`));
  await expect(page.getByRole('heading', { level: 1, name: 'Rheintal Elektronik' })).toBeVisible();
  // K2-c.5: „···“ öffnet das Blatt Profil über der Akte (Vorlage K2-Profil)
  await page.getByRole('link', { name: 'Profil, Team und Mandat' }).click();
  const profile = page.getByRole('dialog', { name: 'Profil' });
  await expect(profile.getByRole('region', { name: 'Stammdaten' })).toContainText('DE123456789');
  await expect(profile.getByRole('region', { name: 'Spend je Jahr' }).locator('b')).toHaveCount(4);
  // Bearbeiten führt bis K2-f auf die bisherige Seite; ihr Lieferantenkopf führt zum bisherigen
  // Überblick, bis K2-c.7 ihn umleitet
  await profile.getByRole('link', { name: 'Bearbeiten' }).click();
  await expect(page).toHaveURL(new RegExp(`${base}/strategie/profil/bearbeiten$`));
  await page
    .getByRole('navigation', { name: 'Bereiche des Lieferanten' })
    .getByRole('link', { name: 'Überblick' })
    .click();
  await expect(page).toHaveURL(new RegExp(`${base}$`));
  await expect(page.getByRole('heading', { level: 1, name: 'Rheintal Elektronik' })).toBeVisible();
  // Vier Phasen, JBP ist jetzt
  const chain = page.getByRole('navigation', { name: 'Jahreszyklus 2026' });
  await expect(chain.locator('[aria-current="step"]')).toContainText('JBP');
  // „Als Nächstes“ führt in den Schritt, in dem die Sache erledigt wird
  const next = page.locator('[data-slot="next-card"]');
  await expect(next).toHaveCount(1);
  await expect(next.getByRole('link')).toHaveAttribute('href', `${base}/plan/vorbereitung`);
  // Kennzahlen und Termine des Lieferanten
  const aside = page.getByRole('complementary', { name: 'Kennzahlen' });
  await expect(aside).toContainText('der Warengruppe Leiterplatten');
  await expect(aside.getByRole('link', { name: /JBP Rheintal/ })).toHaveAttribute(
    'href',
    `${base}/umsetzung/termine/m3`,
  );
  // UX-20: keine Links zu Claims, Risiken oder Verträgen, solange die Module aus sind
  for (const path of ['/claims', '/risiken', '/vertrag']) {
    expect(await page.locator(`a[href*="${path}"]`).count()).toBe(0);
  }
});

test('Liste auf dem Telefon: Filter-Chips Meine, Strategisch, Alle; Zeile öffnet die Detailseite', async ({
  page,
}) => {
  await mock(page);
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto('/beziehungen');
  await page
    .getByRole('group', { name: 'Filter' })
    .getByRole('button', { name: /^Strategisch/ })
    .click();
  await expect(page).toHaveURL(/filter=strategisch/);
  await expect(relationshipList(page).locator('a[href^="/beziehungen/"] b')).toHaveText([
    'Rheintal Elektronik',
    'Silesia Guss',
  ]);
  expect(await sideScroll(page)).toBe(0);
  await relationshipList(page)
    .getByRole('link', { name: /Silesia Guss/ })
    .click();
  // AK-01 (K2-c.2): die Akte
  await expect(page).toHaveURL(new RegExp(`/beziehungen/${id(12)}$`));
});
