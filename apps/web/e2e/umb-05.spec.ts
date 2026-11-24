import { expect, test } from '@playwright/test';
import { allRoutes, id, signIn } from './route-walk.js';

// Tests zu docs/specs/UMB-05.md, die einen echten Browser brauchen.

test.use({ locale: 'de-DE' });

test('Keine Route zeigt „Kommt mit Release“ oder „Kommt nach Release“', async ({ page }) => {
  // Rund 100 Routen; auf dem langsameren CI-Rechner braucht der Rundgang mehrere Minuten.
  test.setTimeout(900_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await signIn(page, { locale: 'de' });
  const findings: string[] = [];
  for (const path of allRoutes()) {
    await page.goto(path);
    await expect.soft(page.locator('h1').first(), path).toBeVisible({ timeout: 15_000 });
    await page.waitForLoadState('networkidle');
    const text = (await page.locator('body').textContent()) ?? '';
    if (/Kommt (mit|nach) Release/.test(text)) findings.push(path);
  }
  expect(findings).toEqual([]);
});

test('Ein Lieferant auf einer Seite: alte Bereichsadresse leitet weiter, keine Scrollleiste bei 390 px', async ({
  page,
}) => {
  await signIn(page, { locale: 'de' });
  await page.goto(`/lieferanten/${id}/beziehung`);
  // NAV-10 1.1: Die alte Bereichsadresse führt zur ersten Seite des neuen Bereichs (Team im Profil).
  await expect(page).toHaveURL(new RegExp(`/lieferanten/${id}/beziehung/team$`));
  await page.goto(`/lieferanten/${id}`);
  await expect(page.locator('[data-slot="supplier-header"]')).toBeVisible();
  await expect(page.locator('#inhalt h1')).toBeVisible();
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 844 });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `${width} px`).toBe(0);
  }
});
