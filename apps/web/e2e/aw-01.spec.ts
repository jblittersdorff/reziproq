import { expect, type Page, test } from '@playwright/test';
import type { Bridge, SecuredResults } from '@reziproq/shared';
import { id, signIn } from './route-walk.js';

// AW-01 Ergebnisse · Gesichert: Aussage, Tinte-Karte für offene Bestätigungen, Brücke nur aus
// bestätigten Werten, darunter Plan und Ist; auf Telefonbreite und am Schreibtisch.

const secured: SecuredResults = {
  fiscalYear: 2026,
  fiscalYears: [2025, 2026],
  currency: 'EUR',
  steps: [
    {
      initiativeId: '0190a0a0-0000-7000-8000-000000000010',
      title: 'Kupferklausel',
      maturity: 4,
      securedCents: 18_000_000,
    },
    {
      initiativeId: '0190a0a0-0000-7000-8000-000000000011',
      title: 'Verpackung neu',
      maturity: 5,
      securedCents: 6_500_000,
    },
  ],
  securedEbitCents: 24_500_000,
  target: { ebitTargetCents: 40_000_000, approved: true },
  pending: { months: 2, initiatives: 1, amountCents: 4_000_000 },
  others: [{ effectType: 'cash', securedCents: 3_000_000 }],
  statement: {
    id: '0190a0a0-0000-7000-8000-000000000020',
    headline: 'Mit Rheintal sind 61 % des Ziels gesichert.',
    body: 'Den größten Beitrag liefert Kupferklausel mit 180.000 €. 2 Monate warten noch auf die Bestätigung durch das Controlling.',
    sources: [{ key: 'ledger', label: 'Impact-Ledger, vom Controlling bestätigt' }],
  },
};
const bridge: Bridge = {
  view: 'jahreswirkung',
  fiscalYear: 2026,
  fiscalYearStartMonth: 1,
  fiscalYears: [2026],
  steps: [
    {
      initiativeId: '0190a0a0-0000-7000-8000-000000000010',
      title: 'Kupferklausel',
      maturity: 4,
      amountCents: 22_000_000,
    },
  ],
  ebitTotal: 22_000_000,
  others: [],
  excluded: [],
};

async function mock(page: Page) {
  await signIn(page, { locale: 'de' });
  await page.route(`**/api/suppliers/${id}/ergebnisse/gesichert*`, (route) =>
    route.fulfill({ json: secured }),
  );
  await page.route(`**/api/suppliers/${id}/wirkung/bruecke*`, (route) =>
    route.fulfill({ json: bridge }),
  );
}

for (const width of [390, 1440]) {
  test(`Gesichert: Brücke aus bestätigten Werten ohne seitliches Scrollen (${width})`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await mock(page);
    await page.goto(`/lieferanten/${id}/wirkung/bruecke`);
    await expect(page.getByText('Mit Rheintal sind 61 % des Ziels gesichert.')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: '2 Monate warten auf das Controlling' }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Plan und Ist nach Reifegrad' })).toBeVisible();
    await page.waitForLoadState('networkidle');
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBe(0);
    await page.screenshot({
      path: process.env.AW01_SHOTS
        ? `${process.env.AW01_SHOTS}/gesichert-${width}.png`
        : testInfo.outputPath(`gesichert-${width}.png`),
      fullPage: true,
    });
  });
}
