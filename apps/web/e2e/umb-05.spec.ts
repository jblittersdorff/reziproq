import { expect, test } from '@playwright/test';
import { id, signIn } from './route-walk.js';

// Tests zu docs/specs/UMB-05.md, die einen echten Browser brauchen.

test.use({ locale: 'de-DE' });

// Dass keine Seite „Kommt mit Release“ zeigt, prüft src/locales/umb-05.test.ts in den Sprachdateien.

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
