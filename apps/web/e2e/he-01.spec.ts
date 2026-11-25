import { expect, type Page, test } from '@playwright/test';
import { signIn } from './route-walk.js';
import { mockReview, mockToday } from './today-fixture.js';

// HE-01 (K1-e.1): Heute mit den Ansichten Fokus und Alles im Browser. T1-HE6: bei 390 px kein
// waagerechter Bildlauf; Fokus mit genau einer Karte „Als Nächstes“, Alles ohne. Mit UX_SHOTS
// entstehen Bilder bei 390 und 1440 px zum Vergleich mit den Vorlagen Main, A-MeinTag und Heute-Alles.

test.use({ locale: 'de-DE', colorScheme: 'light' });

const sideScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

const views = [
  { path: '/heute', name: 'Fokus', cards: 1, shot: 'heute-fokus' },
  { path: '/heute?ansicht=alles', name: 'Alles', cards: 0, shot: 'heute-alles' },
];

for (const view of views) {
  for (const width of [390, 1440]) {
    test(`T1-HE6 Heute, Ansicht ${view.name}, bei ${width} px ohne seitliches Scrollen`, async ({
      page,
    }) => {
      await signIn(page, { locale: 'de' });
      await mockToday(page);
      await page.setViewportSize({ width, height: 900 });
      await page.goto(view.path);
      await expect(page.getByRole('heading', { level: 1, name: 'Heute' })).toBeVisible();
      await expect(
        page.getByRole('navigation', { name: 'Ansicht' }).getByRole('link', { name: view.name }),
      ).toHaveAttribute('aria-current', 'page');
      await page.waitForLoadState('networkidle');
      expect(await sideScroll(page)).toBe(0);
      await expect(page.locator('[data-slot="next-card"]')).toHaveCount(view.cards);
      // Klickflächen der Seite mindestens 44 px hoch (PLT-10)
      const small = await page.locator('#inhalt a[href], #inhalt button').evaluateAll((elements) =>
        elements
          .filter((element) => (element as HTMLElement).offsetParent !== null)
          .filter((element) => element.getBoundingClientRect().height < 43.5)
          .map((element) => element.textContent?.trim()),
      );
      expect(small).toEqual([]);
      if (process.env.UX_SHOTS) {
        await page.screenshot({
          path: `${process.env.UX_SHOTS}/${view.shot}-${width}.png`,
          fullPage: true,
        });
      }
    });
  }
}

test('Heute, Ansicht Alles: Filter Frist klappt in der Seite auf und schreibt die Wahl in die Adresse', async ({
  page,
}) => {
  await signIn(page, { locale: 'de' });
  await mockToday(page);
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto('/heute?ansicht=alles');
  await page.getByRole('button', { name: 'Frist', exact: true }).click();
  await page
    .getByRole('group', { name: 'Auswahl Frist' })
    .getByRole('button', { name: 'Überfällig' })
    .click();
  await expect(page).toHaveURL(/frist=ueberfaellig/);
  await expect(page.getByRole('region', { name: 'Für dich · 1' })).toBeVisible();
  expect(await sideScroll(page)).toBe(0);
  // keine Überlagerung: der Filter ist Teil der Seite (E-K0-01)
  await expect(page.locator('dialog[open]')).toHaveCount(0);
});

for (const width of [390, 1440]) {
  test(`T1-HE6 Kurz prüfen bei ${width} px: mit einer Hand, Knöpfe mindestens 44 px, kein seitliches Scrollen`, async ({
    page,
  }) => {
    await signIn(page, { locale: 'de' });
    await mockToday(page);
    await mockReview(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/kurz-pruefen');
    await expect(page.getByRole('heading', { level: 1, name: 'Kurz prüfen' })).toBeVisible();
    await expect(page.getByText('Entwurf 1 von 5')).toBeVisible();
    await page.waitForLoadState('networkidle');
    expect(await sideScroll(page)).toBe(0);
    const buttons = page.locator('#inhalt button, #inhalt a[href]');
    const small = await buttons.evaluateAll((elements) =>
      elements
        .filter((element) => (element as HTMLElement).offsetParent !== null)
        .filter((element) => element.getBoundingClientRect().height < 43.5)
        .map((element) => element.textContent?.trim()),
    );
    expect(small).toEqual([]);
    const accept = await page.getByRole('button', { name: 'Übernehmen' }).boundingBox();
    const discard = await page.getByRole('button', { name: 'Verwerfen' }).boundingBox();
    if (width === 390) {
      // Vorlage mobil: Verwerfen und Übernehmen nebeneinander, je die halbe Breite, 52 px hoch
      expect(Math.round(accept?.y ?? 0)).toBe(Math.round(discard?.y ?? 1));
      expect(accept?.height ?? 0).toBeGreaterThanOrEqual(52);
      expect((discard?.x ?? 0) < (accept?.x ?? 0)).toBe(true);
    }
    if (process.env.UX_SHOTS) {
      await page.screenshot({
        path: `${process.env.UX_SHOTS}/kurz-pruefen-${width}.png`,
        fullPage: true,
      });
    }
    // Durchklicken bis zum Ende
    for (let index = 0; index < 5; index += 1) {
      await page.getByRole('button', { name: 'Übernehmen' }).click();
    }
    await expect(page.getByText('Alles geprüft. 5 von 5 übernommen.')).toBeVisible();
    expect(await sideScroll(page)).toBe(0);
  });
}
