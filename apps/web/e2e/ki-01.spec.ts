import { expect, test } from '@playwright/test';
import { defaultAiSettings } from '@reziproq/shared';
import { signIn } from './route-walk.js';

for (const width of [390, 1440]) {
  test(`KI-Einstellungen passen bei ${width} px in die Ansicht`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 950 });
    await signIn(page, { locale: 'de' });
    await page.route('**/api/einstellungen/ki', (route) =>
      route.fulfill({ json: { settings: defaultAiSettings, euOnly: true, canEdit: true } }),
    );
    await page.route('**/api/ki/kontingent', (route) =>
      route.fulfill({
        json: {
          month: '2026-11',
          budgetMonthCents: 15000,
          usedCents: 2400,
          calls: 12,
          byFeature: [{ feature: 'prompt', calls: 12, costCents: 2400 }],
        },
      }),
    );
    await page.goto('/einstellungen/ki');
    await expect(page.getByRole('heading', { level: 1, name: 'KI einstellen' })).toBeVisible();
    await expect(page.getByRole('switch', { name: /nur in der EU/i })).toBeChecked();
    // MA-01 (K1-f.4): Aufgaben von Reziproq an oder aus, beim Postfach mit Obergrenze
    await expect(page.getByRole('switch', { name: 'Postfach' })).toBeChecked();
    await expect(page.getByRole('combobox', { name: 'Höchste Stufe für „Postfach“' })).toHaveValue(
      'do',
    );
    await expect(page.getByRole('switch', { name: 'Termin-Briefing' })).not.toBeChecked();
    await page.waitForLoadState('networkidle');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    await page.screenshot({
      path: process.env.UX_SHOTS
        ? `${process.env.UX_SHOTS}/ki-einstellungen-${width}.png`
        : testInfo.outputPath(`ki-einstellungen-${width}.png`),
      fullPage: true,
    });
  });
}
