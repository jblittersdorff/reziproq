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
      // NAV-10 2.0: Frag in der Mitte, ein Knopf für die Überlagerung
      await expect(tabBar.locator('a, button')).toHaveText([
        'Heute',
        'Lieferanten',
        'Frag',
        'Warengruppen',
        'Ergebnisse',
      ]);
      // Ganz unten liegt der letzte Inhalt über der Tab-Leiste, nicht dahinter
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      // Letzter Baustein der Seite ist der Warengruppenkopf (die Ablauf-Leiste ist entfernt).
      const lastBox = await page.locator('[data-slot="category-header"]').boundingBox();
      const tabBox = await tabBar.boundingBox();
      expect((lastBox?.y ?? 0) + (lastBox?.height ?? 0)).toBeLessThanOrEqual(tabBox?.y ?? 0);
    } else {
      await expect(tabBar).toBeHidden();
      await expect(sidebar).toBeVisible();
      await expect(
        sidebar.getByRole('link', { name: /^(Heute|Lieferanten|Warengruppen|Ergebnisse)/ }),
      ).toHaveText([/^Heute/, 'Lieferanten', 'Warengruppen', 'Ergebnisse']);
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

// E-K0-01: Das Blatt liegt 620 px breit am rechten Rand, bis 760 px als volle Seite. Der Fokus
// bleibt darin, Esc schließt es und gibt den Fokus an den Knopf zurück.
for (const width of [390, 1440]) {
  test(`Blatt bei ${width} px: Maße, Fokus und Esc`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await openBlocks(page);
    const open = page.getByRole('button', { name: 'Blatt öffnen' });
    await open.click();
    const sheet = page.getByRole('dialog', { name: 'Profil Rheintal Elektronik' });
    await expect(sheet).toBeVisible();
    const box = await sheet.boundingBox();
    expect(box?.height).toBe(900);
    if (width > 760) {
      expect(box?.width).toBe(620);
      expect(Math.round((box?.x ?? 0) + (box?.width ?? 0))).toBe(width);
    } else {
      expect(box?.width).toBe(width);
    }
    for (let step = 0; step < 4; step += 1) {
      await page.keyboard.press('Tab');
      const inside = await page.evaluate(() => {
        const dialog = document.querySelector('dialog[open]');
        const active = document.activeElement;
        return !active || active === document.body || !!dialog?.contains(active);
      });
      expect(inside, `Schritt ${step + 1}`).toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(sheet).toHaveCount(0);
    await expect(open).toBeFocused();
  });
}
