import { expect, test } from '@playwright/test';
import { defaultAiSettings, defaultHintThresholds } from '@reziproq/shared';
import { signIn } from './route-walk.js';

// KI-16: Hinweise mit „Als Nächstes“ und „Das Wichtigste“ (NAV-10 1.1, statt „Wo du handeln musst“
// in Mein Tag) und Einstellungen KI › Hinweise auf Telefonbreite und am Schreibtisch, ohne
// seitliches Scrollen.

const rel = '550e8400-e29b-41d4-a716-446655440010';
const base = {
  relationshipId: rel,
  supplier: 'Silesia Guss',
  status: 'open',
  reason: null,
  createdAt: '2026-11-14T06:00:00Z',
  decidedAt: null,
  decidedByName: null,
  canAccept: true,
  canDismiss: true,
  actionHref: null,
  title: null,
  explanation: null,
  feedback: null,
  lastSeenAt: '2026-11-23T06:00:00Z',
  resolvedReason: null,
  isFocus: true,
  isOwn: true,
  materialGroup: 'Guss',
  suggestedAction: null,
  evidence: {},
};
const id = (n: number) => `550e8400-e29b-41d4-a716-4466554401${String(n).padStart(2, '0')}`;
const hints = [
  {
    ...base,
    id: id(1),
    ruleKey: 'performance_drop',
    severity: 'high',
    score: 900,
    detail: { kpi: 'Liefertreue', months: 3 },
    href: `/lieferanten/${rel}/umsetzung/massnahmen/neu?hinweis=${id(1)}`,
  },
  {
    ...base,
    id: id(2),
    supplier: 'Test-Lieferant (Demo)',
    ruleKey: 'public_event',
    severity: 'high',
    score: 800,
    detail: { event: 'short_time_work', headline: 'Kurzarbeit im Werk angekündigt', sources: 2 },
    href: `/lieferanten/${rel}`,
  },
  {
    ...base,
    id: id(3),
    ruleKey: 'supplier_commitment_overdue',
    severity: 'medium',
    score: 400,
    detail: { count: 1, days: 21 },
    href: `/lieferanten/${rel}/plan/zusagen`,
  },
  {
    ...base,
    id: id(4),
    ruleKey: 'plan_missing',
    severity: 'medium',
    score: 300,
    detail: { jbpDate: '2026-12-04' },
    href: `/lieferanten/${rel}/strategie/lieferantenplan`,
  },
];

for (const width of [390, 1440]) {
  test(`KI-16 Hinweise und Einstellungen ohne seitliches Scrollen (${width})`, async ({ page }) => {
    await page.setViewportSize({ width, height: 950 });
    await signIn(page, { locale: 'de' });
    await page.route('**/api/me/permissions', (route) =>
      route.fulfill({
        json: {
          actions: [
            'organisation.sehen',
            'einstellungen.verwalten',
            'lieferanten.sehen',
            'start.sehen',
            'hinweise.sehen',
            'hinweise.entscheiden',
            'hinweise.einstellen',
          ],
        },
      }),
    );
    await page.route('**/api/start', (route) =>
      route.fulfill({
        json: {
          due: { items: [], total: 0 },
          relationships: { items: [], total: 0 },
          nextMeeting: null,
          portfolio: null,
          openActions: 0,
        },
      }),
    );
    await page.route('**/api/hinweise', (route) =>
      route.fulfill({ json: { hints, checkedAt: '2026-11-23T06:00:00Z' } }),
    );
    await page.route('**/api/hinweise/regeln', (route) =>
      route.fulfill({
        json: {
          rules: {},
          thresholds: defaultHintThresholds,
          ratings: [{ ruleKey: 'performance_drop', helpful: 3, notHelpful: 1 }],
        },
      }),
    );
    await page.route('**/api/einstellungen/ki', (route) =>
      route.fulfill({ json: { settings: defaultAiSettings, euOnly: true, canEdit: true } }),
    );
    await page.route('**/api/ki/kontingent', (route) =>
      route.fulfill({
        json: { month: '2026-11', budgetMonthCents: 15000, usedCents: 0, calls: 0, byFeature: [] },
      }),
    );
    const overflow = () =>
      page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );

    await page.goto('/hinweise');
    await expect(page.getByText('Das Wichtigste')).toBeVisible();
    await expect(page.locator('[data-slot="next-card"]')).toHaveCount(1);
    await page.waitForLoadState('networkidle');
    expect(await overflow()).toBe(0);
    if (process.env.KI16_SHOTS)
      await page.screenshot({
        path: `${process.env.KI16_SHOTS}/hinweise-${width}.png`,
        fullPage: true,
      });

    await page.goto('/einstellungen/ki');
    await expect(page.getByRole('heading', { level: 2, name: 'Hinweise' })).toBeVisible();
    await expect(page.getByText('3 hilfreich · 1 nicht hilfreich')).toBeVisible();
    expect(await overflow()).toBe(0);
    if (process.env.KI16_SHOTS)
      await page.screenshot({
        path: `${process.env.KI16_SHOTS}/einstellungen-ki-${width}.png`,
        fullPage: true,
      });
  });
}
