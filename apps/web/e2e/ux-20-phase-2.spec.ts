import { expect, type Page, test } from '@playwright/test';
import { signIn } from './route-walk.js';

// UX-20 Phase 2, seit K1-d nach NAV-10 2.0: Heute (bisher Mein Tag), Wert (bisher Übersicht) und
// Alle Aufgaben im Rahmen. Ab 761 px
// Seitenleiste mit vier Hauptpunkten und Einstellungen, bis 760 px Tab-Leiste mit fünf Zielen, die
// nichts verdeckt; bei 390 px kein seitliches Scrollen der Seite. Die Zahlen sind Testdaten.

test.use({ locale: 'de-DE', colorScheme: 'light' });

const rel = '550e8400-e29b-41d4-a716-446655440010';
const day = (offset: number) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const task = (
  id: number,
  kind: string,
  supplier: string,
  detail: string | null,
  offset: number,
) => ({
  id: `task-${id}`,
  kind,
  supplier,
  detail,
  dueDate: day(offset),
  href: `/lieferanten/${rel}/plan`,
});
const tasks = [
  task(1, 'validation', 'Rheintal Elektronik', 'Preis Leiterplatten', -2),
  task(2, 'review', 'Rheintal Elektronik', null, 0),
  task(3, 'signature', 'Nordwerk Guss', null, 1),
  task(4, 'contribution', 'Rheintal Elektronik', 'Gemeinsamer Plan', 2),
  task(5, 'rating', 'Baltic Logistics', 'Bewertungsrunde 2027', 3),
];
const timeline = [
  ['meeting', 'meeting', 'JBP Rheintal Elektronik', 'Rheintal Elektronik', 'Teams', 11],
  ['round', 'deadline', '2027', null, null, 16],
  ['meeting', 'meeting', 'QBR Nordwerk Guss', 'Nordwerk Guss', null, 17],
  ['commitment', 'commitment', 'Musterteile', 'Rheintal Elektronik', 'Nils Ott', 22],
].map(([source, kind, title, counterpart, detail, offset], index) => ({
  id: `t-${index}`,
  date: day(Number(offset) - 7),
  kind,
  source,
  title,
  counterpart,
  detail,
  startsAt:
    source === 'meeting' ? new Date(`${day(Number(offset) - 7)}T10:00:00`).toISOString() : null,
  progress: source === 'round' ? { done: 12, total: 18 } : null,
  href: `/lieferanten/${rel}/umsetzung/termine/x${index}`,
  relationshipId: rel,
  categoryId: null,
}));

async function mock(page: Page) {
  await signIn(page, { locale: 'de' });
  // Rechte wie ein Admin mit Portfolio, Terminen und Hinweisen (Diagrammkarte Lieferanten)
  await page.route('**/api/me/permissions', (route) =>
    route.fulfill({
      json: {
        actions: [
          'organisation.sehen',
          'einstellungen.verwalten',
          'lieferanten.sehen',
          'prompt.nutzen',
          'wirkung.sehen',
          'start.sehen',
          'termine.sehen',
          'portfolio.sehen',
          'hinweise.sehen',
        ],
      },
    }),
  );
  const json = (path: string, body: unknown) =>
    page.route(path, (route) => route.fulfill({ json: body }));
  // HE-01: Zahl an Heute aus der Triage
  await json('**/api/heute', {
    today: day(0),
    next: null,
    more: [],
    openFocus: 3,
    review: { count: 0, minutes: 0 },
    done: { count: 0 },
    background: null,
  });
  await json('**/api/start/mein-tag', {
    today: day(0),
    next: { scope: 'global', item: tasks[0], overdueDays: 2, minutes: 2 },
    todayItems: [tasks[1]],
    week: tasks.slice(2),
    total: 11,
    doneToday: 0,
    prepared: [
      {
        id: 'meeting:m1',
        kind: 'brief_goals',
        objectType: 'meeting',
        subject: 'JBP Rheintal Elektronik',
        counterpart: 'Rheintal Elektronik',
        count: 4,
        createdAt: new Date(`${day(0)}T06:10:00`).toISOString(),
        href: `/lieferanten/${rel}/umsetzung/termine/m1`,
      },
    ],
    preparedTotal: 1,
    waiting: [
      {
        id: 'commitment:c1',
        kind: 'commitment',
        title: '8D-Bericht Charge 4711',
        owner: 'Nils Ott',
        counterpart: 'Rheintal Elektronik',
        dueDate: day(-3),
        href: `/lieferanten/${rel}/plan/zusagen#c1`,
      },
      {
        id: 'contribution:c2',
        kind: 'contribution',
        title: 'Machbarkeit Lieferzeit',
        owner: 'Tom Weber',
        counterpart: 'Rheintal Elektronik',
        dueDate: day(4),
        href: `/lieferanten/${rel}/strategie/lieferantenplan`,
      },
    ],
    waitingTotal: 2,
    timeline: timeline.slice(0, 3),
    hints: { open: 7, high: 1 },
  });
  await json('**/api/start/due', { items: tasks });
  await json('**/api/start/als-naechstes', {
    next: { scope: 'global', item: tasks[0], overdueDays: 2, minutes: 2 },
  });
  await json('**/api/start/termine?tage=28', { from: day(0), to: day(27), items: timeline });
  await json('**/api/start/brauchen-dich', {
    items: [{ relationshipId: rel, reason: 'due', title: 'validation' }],
  });
  const group = (n: number, name: string, done: number, status: string | null) => ({
    id: `550e8400-e29b-41d4-a716-4466554401${n}0`,
    name,
    code: name.slice(0, 3).toUpperCase(),
    lead: null,
    spend: null,
    supplierCount: 4,
    strategy: status
      ? {
          id: `550e8400-e29b-41d4-a716-4466554402${n}0`,
          year: 2026,
          status,
          version: 1,
          steps: Array.from({ length: 10 }, (_, index) => (index < done ? 'done' : 'open')),
        }
      : null,
    hidden: false,
    canCreate: !status,
  });
  await json('**/api/warengruppen/strategien', {
    year: 2026,
    next: null,
    approvedCount: 1,
    groups: [
      group(1, 'Gussteile', 10, 'approved'),
      group(2, 'Leiterplatten', 6, 'draft'),
      group(3, 'Spritzguss', 3, 'draft'),
      group(4, 'Logistik', 0, null),
    ],
  });
  const point = (n: number, typeName: string, spendCents: number) => ({
    relationshipId: `550e8400-e29b-41d4-a716-4466554403${n}0`,
    name: `Lieferant ${n}`,
    spendCents,
    currency: 'EUR',
    businessUnit: null,
    materialGroup: null,
    ist: { impactLevel: 2, qualityLevel: 2, typeName },
    soll: { impactLevel: 2, qualityLevel: 2, typeName },
  });
  await page.route('**/api/portfolio/matrix**', (route) =>
    route.fulfill({
      json: {
        spendYear: 2025,
        businessUnits: [],
        materialGroups: [],
        points: [
          point(1, 'Strategisch', 1_840_000_000),
          point(2, 'Hebeln', 910_000_000),
          point(3, 'Absichern', 620_000_000),
          point(4, 'Entwickeln', 430_000_000),
        ],
      },
    }),
  );
  await json('**/api/uebersicht', {
    fiscalYear: 2026,
    currency: 'EUR',
    securedEbitCents: 41_200_000,
    goalEbitCents: 60_000_000,
    canSetGoal: true,
    focusTotal: 12,
    focusWithApprovedJbp: 9,
    inProgress: { lowCents: 12_000_000, highCents: 31_000_000 },
    cashCents: 8_000_000,
    quarters: [
      { quarter: 1, securedCents: 6_400_000, state: 'past' },
      { quarter: 2, securedCents: 9_800_000, state: 'past' },
      { quarter: 3, securedCents: 14_100_000, state: 'past' },
      { quarter: 4, securedCents: 10_900_000, state: 'current' },
    ],
    sinceStartSecuredCents: 52_000_000,
    statement: {
      id: '0190a0a0-0000-7000-8000-0000000000ff',
      headline: '69 % des Jahresziels sind gesichert.',
      body: 'Bis zum Ende des Geschäftsjahrs fehlen 188.000 €.',
      sources: [{ key: 'ledger', label: 'Ergebnisse' }],
    },
    sentences: [
      { kind: 'good', text: 'Rheintal trägt 180.000 € bei, 30 % des Ziels.', href: '/heute' },
      { kind: 'stuck', text: 'Bei Silesia Guss: Liefertreue unter Ziel.', href: '/hinweise' },
      { kind: 'todo', text: 'Zusage Musterteile ist seit 3 Tagen offen.', href: '/heute' },
    ],
  });
}

const sideScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

const pages = [
  { path: '/heute', title: 'Heute', active: /^Heute/, shot: 'heute' },
  { path: '/wert', title: 'Wert', active: 'Wert', shot: 'wert' },
  { path: '/start/faellig', title: 'Alle Aufgaben', active: /^Heute/, shot: 'aufgaben' },
];

for (const target of pages) {
  for (const width of [390, 760, 761, 1440]) {
    test(`${target.title} bei ${width} px`, async ({ page }) => {
      await mock(page);
      await page.setViewportSize({ width, height: 900 });
      await page.goto(target.path);
      await expect(page.getByRole('heading', { level: 1, name: target.title })).toBeVisible();
      await page.waitForLoadState('networkidle');
      expect(await sideScroll(page)).toBe(0);
      const sidebar = page.locator('[data-slot="sidebar"]');
      const tabBar = page.locator('[data-slot="tab-bar"]');
      if (width <= 760) {
        await expect(sidebar).toBeHidden();
        await expect(tabBar.locator('a, button')).toHaveText([
          'Heute',
          'Beziehungen',
          'Frag',
          'Warengruppen',
          'Wert',
        ]);
        // nichts hinter der Tab-Leiste: das Ende des Inhalts liegt darüber
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        const main = await page.locator('#inhalt').boundingBox();
        const bar = await tabBar.boundingBox();
        expect((main?.y ?? 0) + (main?.height ?? 0)).toBeLessThanOrEqual((bar?.y ?? 0) + 1);
      } else {
        await expect(tabBar).toBeHidden();
        await expect(
          sidebar.getByRole('link', { name: /^(Heute|Beziehungen|Warengruppen|Wert)/ }),
        ).toHaveText(['Heute3', 'Beziehungen', 'Warengruppen', 'Wert']);
        await expect(sidebar.getByRole('link', { name: 'Einstellungen' })).toBeVisible();
        await expect(sidebar.locator('[aria-current="page"]')).toHaveText(target.active);
      }
      // höchstens eine Karte „Als Nächstes“
      expect(await page.locator('[data-slot="next-card"]').count()).toBeLessThanOrEqual(1);
      if (process.env.UX_SHOTS && (width === 390 || width === 1440)) {
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({
          path: `${process.env.UX_SHOTS}/${target.shot}-${width}.png`,
          fullPage: true,
        });
      }
    });
  }
}

test('Wert: Terminschiene scrollt auf dem Telefon in ihrem Rahmen, nicht die Seite', async ({
  page,
}) => {
  await mock(page);
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto('/wert');
  const rail = page.getByRole('list', { name: 'Termine und Fristen der nächsten vier Wochen' });
  await expect(rail.getByRole('listitem')).toHaveCount(1 + timeline.length);
  expect(await rail.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
  expect(await sideScroll(page)).toBe(0);
  // ein Eintrag öffnet sein Objekt
  await expect(rail.getByRole('link', { name: /JBP Rheintal Elektronik/ })).toHaveAttribute(
    'href',
    timeline[0]?.href ?? '',
  );
});

test('Heute: ⌘K öffnet „Frag Reziproq“, auf dem Telefon die Person die Einstellungen', async ({
  page,
}) => {
  await mock(page);
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto('/heute');
  await expect(page.getByRole('heading', { level: 1, name: 'Heute' })).toBeVisible();
  await expect(
    page.locator('#inhalt').getByRole('link', { name: 'Einstellungen' }),
  ).toHaveAttribute('href', '/einstellungen');
  await page.keyboard.press('ControlOrMeta+k');
  // NAV-10 2.0: auf dem Telefon als Vollbild über der Seite (E-K0-01)
  const overlay = page.getByRole('dialog', { name: 'Frag Reziproq' });
  await expect(overlay).toBeVisible();
  expect((await overlay.boundingBox())?.width).toBe(390);
});
