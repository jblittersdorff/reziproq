import { expect, type Page, test } from '@playwright/test';
import { fakeZitadel } from './fake-zitadel.js';

// FS-01: Hinweise auf Telefonbreite und am Schreibtisch, ohne seitliches Scrollen.

test.use({ locale: 'de-DE' });

const relationshipId = '550e8400-e29b-41d4-a716-446655440010';
const base = {
  relationshipId,
  supplier: 'Gamma Werkzeugbau KG',
  status: 'open',
  severity: 'low',
  score: 0,
  title: null,
  evidence: {},
  explanation: null,
  suggestedAction: null,
  feedback: null,
  lastSeenAt: '2026-11-16T06:30:00Z',
  resolvedReason: null,
  isFocus: false,
  isOwn: true,
  materialGroup: null,
  reason: null,
  createdAt: '2026-11-16T06:30:00Z',
  decidedAt: null,
  decidedByName: null,
  canAccept: true,
  canDismiss: true,
  actionHref: null,
};
const hints = [
  {
    ...base,
    id: '550e8400-e29b-41d4-a716-446655440090',
    ruleKey: 'performance_drop',
    severity: 'high',
    score: 900,
    isFocus: true,
    materialGroup: 'Guss',
    detail: { kpi: 'Liefertreue', months: 3 },
    evidence: {
      metric: 'Liefertreue',
      values: [
        { label: '2026-08', value: '91 %' },
        { label: '2026-09', value: '88 %' },
        { label: '2026-10', value: '86 %' },
      ],
      threshold: 'Ziel 95 %',
      refs: [{ objectType: 'scorecard_kpi', objectId: 'k1', title: 'Scorecard Liefertreue' }],
    },
    explanation:
      'Gamma liefert seit drei Monaten unter Ziel, im Oktober 86 % statt 95 %. Das trifft die Montage direkt.',
    href: `/lieferanten/${relationshipId}/umsetzung/massnahmen/neu?hinweis=550e8400-e29b-41d4-a716-446655440090`,
  },
  {
    ...base,
    id: '550e8400-e29b-41d4-a716-446655440091',
    ruleKey: 'plan_missing',
    detail: { jbpDate: '2026-11-26' },
    href: `/lieferanten/${relationshipId}/lieferantenplan`,
  },
  {
    ...base,
    id: '550e8400-e29b-41d4-a716-446655440092',
    ruleKey: 'no_operational_function',
    detail: {},
    href: `/lieferanten/${relationshipId}/team`,
  },
  {
    ...base,
    id: '550e8400-e29b-41d4-a716-446655440093',
    ruleKey: 'too_many_focus',
    relationshipId: null,
    supplier: null,
    detail: { person: 'Anna Schmidt', count: 9, limit: 8 },
    href: '/portfolio/fokus',
    canAccept: false,
  },
];

async function mock(page: Page) {
  await fakeZitadel(page);
  await page.route('**/api/me', (route) =>
    route.fulfill({
      json: {
        name: 'Anna Schmidt',
        firstName: 'Anna',
        email: 'anna@example.com',
        organization: { id: 'org-1', name: 'Beispiel-OEM' },
        supportView: false,
        orgRole: 'admin',
        permissions: {
          viewOrganizationSettings: true,
          viewBuyerAreas: true,
          viewSuppliers: true,
          switchCustomer: false,
        },
      },
    }),
  );
  await page.route('**/api/me/permissions', (route) =>
    route.fulfill({
      json: { actions: ['organisation.sehen', 'hinweise.sehen', 'hinweise.entscheiden'] },
    }),
  );
  await page.route('**/api/health', (route) => route.fulfill({ json: { status: 'ok' } }));
  await page.route('**/api/hinweise', (route) =>
    route.fulfill({ json: { hints, checkedAt: '2026-11-16T06:30:00Z' } }),
  );
  await page.route('**/api/hinweise/*', (route) => {
    const id = new URL(route.request().url()).pathname.split('/').pop();
    return route.fulfill({ json: hints.find((hint) => hint.id === id) });
  });
  // HE-01 (K1-e.4): Warum zum Hinweis ersetzt Liste und Seite des Hinweises
  await page.route('**/api/warum/*', (route) => {
    const id = new URL(route.request().url()).pathname.split('/').pop();
    return route.fulfill({ json: { kind: 'hint', hintId: id } });
  });
}

for (const width of [390, 1440]) {
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`Warum zum Hinweis ohne seitliches Scrollen (${width}, ${colorScheme})`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme });
      await page.setViewportSize({ width, height: 900 });
      await mock(page);
      await page.goto(`/warum/${hints[0]?.id}`);
      await expect(
        page.getByRole('heading', { level: 1, name: 'Warum dieser Hinweis?' }),
      ).toBeVisible();
      await expect(page.locator('[data-slot="next-step"]')).toBeVisible();
      await page.waitForLoadState('networkidle');
      const overflow = () =>
        page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
      expect(await overflow()).toBe(0);
      if (process.env.FS01_SHOTS)
        await page.screenshot({
          path: `${process.env.FS01_SHOTS}/warum-hinweis-${width}-${colorScheme}.png`,
          fullPage: true,
        });

      await page.goto(`/warum/${hints[2]?.id}`);
      await expect(
        page.getByRole('heading', { level: 1, name: 'Warum dieser Hinweis?' }),
      ).toBeVisible();
      await expect(page.getByRole('button', { name: 'Nicht relevant' })).toBeDisabled();
      expect(await overflow()).toBe(0);
      if (process.env.FS01_SHOTS)
        await page.screenshot({
          path: `${process.env.FS01_SHOTS}/hinweis-${width}-${colorScheme}.png`,
          fullPage: true,
        });
    });
  }
}
