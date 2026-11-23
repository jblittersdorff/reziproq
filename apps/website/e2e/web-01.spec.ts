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
