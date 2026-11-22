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
    await expect(page.getByRole('heading', { level: 1 })).toContainText('KI');
    await expect(page.getByRole('switch', { name: /nur in der EU/i })).toBeChecked();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    await page.screenshot({
      path: testInfo.outputPath(`ki-einstellungen-${width}.png`),
      fullPage: true,
    });
  });
}
