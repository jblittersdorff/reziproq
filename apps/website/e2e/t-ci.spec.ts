import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import {
  brandFonts,
  colorFindings,
  fontFindings,
  htmlFindings,
  paletteOf,
  themeFindings,
} from '../../web/src/testing/build-checks.js';

// K2-h, Designsprache „Prüfungen beim Bauen“: T-CI1 bis T-CI3 am ausgelieferten Build der Website
// (WEB-01: dieselben Tokens und Schriften wie die App). playwright.config.ts baut ihn vor den Tests
// nach dist/client, samt vorgerenderter Seiten.

const dist = fileURLToPath(new URL('../dist/client', import.meta.url));
const palette = paletteOf(
  readFileSync(new URL('../../../docs/design/designsprache.md', import.meta.url), 'utf8'),
);

function built(extension: string) {
  return readdirSync(dist, { recursive: true, encoding: 'utf8' })
    .filter((file) => file.endsWith(extension))
    .map((file) => ({ file, text: readFileSync(join(dist, file), 'utf8') }));
}

// Erst im Test lesen: Playwright lädt diese Datei, bevor der webServer gebaut hat.
const builtCss = () => built('.css');
const allCss = () =>
  builtCss()
    .map(({ text }) => text)
    .join('\n');

test('T-CI1 Der Build nutzt nur Farben der Designsprache', () => {
  const css = builtCss();
  expect(css.length).toBeGreaterThan(0);
  expect(
    css.flatMap(({ file, text }) =>
      colorFindings(text, palette).map((found) => `${file}: ${found}`),
    ),
  ).toEqual([]);
});

test('T-CI2 Figtree und Outfit liegen im Build; keine Seite lädt von Google oder einem anderen Dienst', () => {
  expect(fontFindings(allCss())).toEqual([]);
  const html = built('.html');
  expect(html.length).toBeGreaterThan(1);
  expect(
    html.flatMap(({ file, text }) => htmlFindings(text).map((found) => `${file}: ${found}`)),
  ).toEqual([]);
});

test('T-CI3 Der Build hat ein helles Thema, keinen Farbverlauf und Schatten nur in Tinte', () => {
  expect(themeFindings(allCss())).toEqual([]);
});

test('T-CI2 Im Browser laden Figtree und Outfit vom eigenen Server', async ({ page, baseURL }) => {
  const requested: string[] = [];
  page.on('request', (request) => {
    if (request.resourceType() === 'font') requested.push(request.url());
  });
  await page.goto('/');
  await expect(page.locator('h1')).toHaveCount(1);
  const loaded = await page.evaluate(async () => {
    await document.fonts.ready;
    return [...document.fonts]
      .filter((face) => face.status === 'loaded')
      .map((face) => face.family.replaceAll('"', ''));
  });
  expect([...new Set(loaded)].sort()).toEqual([...brandFonts]);
  expect(requested.length).toBeGreaterThan(0);
  for (const url of requested) expect(new URL(url).origin, url).toBe(new URL(baseURL ?? '').origin);
});

test.describe('bei dunkel eingestelltem System', () => {
  test.use({ colorScheme: 'dark' });

  test('T-CI3 Die Website bleibt hell', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toHaveCount(1);
    const look = await page.evaluate(() => ({
      scheme: getComputedStyle(document.documentElement).colorScheme,
      background: getComputedStyle(document.body).backgroundColor,
    }));
    // paper aus der Designsprache
    expect(look).toEqual({ scheme: 'light', background: 'rgb(244, 245, 242)' });
  });
});
