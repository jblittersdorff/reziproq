import { expect, test } from '@playwright/test';
import { signIn } from './route-walk.js';

// IN-03: das Outlook-Add-in schmal wie ein Aufgabenbereich, ohne seitliches Scrollen.

const uuid = (n: number) => `0190a0a0-0000-7000-8000-0000000000${String(n).padStart(2, '0')}`;
// Neu eingegangen geht seit K1-e.3 in Heute auf (Kurz prüfen, Erledigt); siehe he-01.spec.ts.

test('Outlook-Add-in im schmalen Aufgabenbereich', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await signIn(page, { locale: 'de' });
  await page.route('**/api/termine/addin/erkennen', (route) =>
    route.fulfill({
      json: {
        supplier: { relationshipId: uuid(50), name: 'Rheintal Elektronik' },
        candidates: [{ relationshipId: uuid(50), name: 'Rheintal Elektronik' }],
        reason: 'Rheintal Elektronik: Teilnehmer von rheintal-elektronik.de.',
        suggestedType: 'quarterly_review',
      },
    }),
  );
  await page.goto('/addin/outlook');
  await expect(page.getByRole('button', { name: 'Als Aktivität speichern' })).toBeVisible();
  await expect(page.getByText('Erkannter Lieferant')).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ),
  ).toBe(0);
  if (process.env.IN03_SHOTS) {
    await page.screenshot({ path: `${process.env.IN03_SHOTS}/addin-320.png`, fullPage: true });
  }
});
