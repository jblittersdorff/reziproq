import { expect, type Page, test } from '@playwright/test';
import { fakeZitadel } from './fake-zitadel.js';

// UX-20 Phase 1: Testseite /bausteine im neuen Rahmen (NAV-10 1.1). Ab 761 px Seitenleiste, bis
// 760 px Tab-Leiste mit fünf Zielen; kein seitliches Scrollen; nichts hinter der Tab-Leiste.

test.use({ locale: 'de-DE', colorScheme: 'light' });

async function openBlocks(page: Page) {
  await fakeZitadel(page);
  await page.route('**/api/me', (route) =>
    route.fulfill({
      json: {
        name: 'Jan-Luka',
        firstName: 'Jan-Luka',
        email: 'jan-luka@beispiel-einkauf.de',
        organization: { id: 'org-1', name: 'Beispiel-OEM (Demo)' },
        supportView: false,
        permissions: { viewOrganizationSettings: true, viewSuppliers: true, switchCustomer: false },
      },
    }),
  );
  await page.route('**/api/health', (route) => route.fulfill({ json: { status: 'ok' } }));
  await page.goto('/bausteine');
  await expect(page.getByRole('heading', { level: 1, name: 'Bausteine' })).toBeVisible();
  await page.waitForLoadState('networkidle');
}

const sideScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

for (const width of [390, 760, 761, 1440]) {
  test(`Bausteine im Rahmen bei ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await openBlocks(page);
    expect(await sideScroll(page)).toBe(0);
    const sidebar = page.locator('[data-slot="sidebar"]');
    const tabBar = page.locator('[data-slot="tab-bar"]');
    if (width <= 760) {
      await expect(sidebar).toBeHidden();
      await expect(tabBar).toBeVisible();
      await expect(tabBar.getByRole('link')).toHaveText([
        'Übersicht',
        'Mein Tag',
        'Lieferanten',
        'Warengruppen',
        'Frag',
      ]);
      // Ganz unten liegt der letzte Inhalt über der Tab-Leiste, nicht dahinter
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      const lastBox = await page.locator('[data-slot="flow-bar"]').boundingBox();
      const tabBox = await tabBar.boundingBox();
      expect((lastBox?.y ?? 0) + (lastBox?.height ?? 0)).toBeLessThanOrEqual(tabBox?.y ?? 0);
    } else {
      await expect(tabBar).toBeHidden();
      await expect(sidebar).toBeVisible();
      await expect(
        sidebar.getByRole('link', { name: /Übersicht|Mein Tag|Lieferanten|Warengruppen/ }),
      ).toHaveText(['Übersicht', /^Mein Tag/, 'Lieferanten', 'Warengruppen']);
      await expect(sidebar.getByRole('link', { name: 'Einstellungen' })).toBeVisible();
      // Seitenleiste so hoch wie der Bildschirm; sie bleibt stehen, nur der Inhalt scrollt
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
      const sideBox = await sidebar.boundingBox();
      // Toleranz bis 1 px: am Seitenende rundet der Browser Bruchteile der Seitenhöhe
      expect(Math.abs(sideBox?.y ?? 99)).toBeLessThanOrEqual(1);
      expect(Math.abs((sideBox?.height ?? 0) - 900)).toBeLessThanOrEqual(1);
      await expect(sidebar.getByRole('link', { name: 'Profil' })).toBeInViewport();
      expect(await sidebar.evaluate((element) => element.scrollHeight - element.clientHeight)).toBe(
        0,
      );
    }
    // Eingeklappt beim Laden, öffnet mit der Tastatur
    const questions = page.locator('details[data-slot="collapsible"]').first();
    await expect(questions).not.toHaveAttribute('open', '');
    await questions.locator('summary').focus();
    await page.keyboard.press('Enter');
    await expect(questions).toHaveAttribute('open', '');
    if (process.env.UX_SHOTS && (width === 390 || width === 1440)) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: `${process.env.UX_SHOTS}/bausteine-${width}.png`,
        fullPage: true,
      });
    }
  });
}
