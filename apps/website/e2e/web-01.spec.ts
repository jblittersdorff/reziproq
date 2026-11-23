import { expect, test } from '@playwright/test';
import { locales, pageKeys, pathOf } from '../src/site';

// WEB-01: jede Seite in beiden Sprachen auf Telefonbreite und am Schreibtisch ohne seitliches
// Scrollen; der Umschalter führt zur gleichen Seite in der anderen Sprache.

for (const width of [390, 1440]) {
  for (const locale of locales) {
    for (const page of pageKeys) {
      test(`${page} ${locale} ${width}`, async ({ page: browser }) => {
        await browser.setViewportSize({ width, height: 900 });
        await browser.goto(pathOf(page, locale));
        await expect(browser.locator('h1')).toHaveCount(1);
        expect(
          await browser.evaluate(
            () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
          ),
        ).toBe(0);
        if (process.env.WEB01_SHOTS) {
          await browser.screenshot({
            path: `${process.env.WEB01_SHOTS}/${page}-${locale}-${width}.png`,
            fullPage: true,
          });
        }
      });
    }
  }
}

test('der Umschalter führt zur gleichen Seite in der anderen Sprache', async ({ page }) => {
  await page.goto(pathOf('pricing', 'en'));
  await page
    .getByRole('navigation', { name: 'Language' })
    .getByRole('link', { name: 'DE' })
    .click();
  await expect(page).toHaveURL(/\/de\/preise\/?$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'de');
  await page.getByRole('navigation', { name: 'Sprache' }).getByRole('link', { name: 'EN' }).click();
  await expect(page).toHaveURL(/\/pricing\/?$/);
});

test('ein Wechsel im Menü lädt die Seite nicht neu; Zurück zeigt die vorige Seite', async ({
  page,
}) => {
  await page.goto(pathOf('home', 'de'));
  await expect(page.locator('h1')).toHaveCount(1);
  const home = await page.locator('h1').textContent();
  // Merker im Fenster: nach einem echten Neuladen wäre er weg
  await page.evaluate(() => {
    (window as unknown as { marker: string }).marker = 'noch da';
  });
  await page.getByRole('navigation').first().getByRole('link').nth(4).click();
  await expect(page).toHaveURL(new RegExp(`${pathOf('pricing', 'de')}$`));
  await expect(page.locator('h1')).not.toHaveText(home ?? '');
  expect(await page.evaluate(() => (window as unknown as { marker?: string }).marker)).toBe(
    'noch da',
  );
  await page.goBack();
  await expect(page.locator('h1')).toHaveText(home ?? '');
  expect(await page.evaluate(() => (window as unknown as { marker?: string }).marker)).toBe(
    'noch da',
  );
});

test('auf Telefonbreite öffnet „Menü“ die Seiten untereinander und schließt nach der Wahl', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto(pathOf('home', 'de'));
  await expect(page.getByRole('navigation', { name: 'Hauptnavigation' })).toBeHidden();
  await page.getByRole('button', { name: 'Menü' }).click();
  const menu = page.getByRole('navigation', { name: 'Menü' });
  await expect(menu.getByRole('link')).toHaveCount(5);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ),
  ).toBe(0);
  if (process.env.WEB01_SHOTS)
    await page.screenshot({ path: `${process.env.WEB01_SHOTS}/menu-open-390.png` });
  await menu.getByRole('link', { name: 'Preise' }).click();
  await expect(page).toHaveURL(new RegExp(`${pathOf('pricing', 'de')}$`));
  await expect(page.getByRole('navigation', { name: 'Menü' })).toHaveCount(0);
});
