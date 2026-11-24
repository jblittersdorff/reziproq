import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type Page, test } from '@playwright/test';
import {
  brandFonts,
  colorFindings,
  fontFindings,
  htmlFindings,
  paletteOf,
  themeFindings,
} from '../src/testing/build-checks.js';
import { fakeZitadel } from './fake-zitadel.js';

test.use({ locale: 'de-DE', colorScheme: 'light' });

// K2-h, Designsprache „Prüfungen beim Bauen“: T-CI1 bis T-CI3 am ausgelieferten Build der App.
// playwright.config.ts baut ihn vor den Tests nach dist/e2e und liefert ihn mit vite preview aus.

const dist = fileURLToPath(new URL('../dist/e2e', import.meta.url));
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

test('T-CI2 Figtree und Outfit liegen im Build; nichts kommt von Google oder einem anderen Dienst', () => {
  expect(fontFindings(allCss())).toEqual([]);
  const html = built('.html');
  expect(html.length).toBeGreaterThan(0);
  expect(
    html.flatMap(({ file, text }) => htmlFindings(text).map((found) => `${file}: ${found}`)),
  ).toEqual([]);
});

test('T-CI3 Der Build hat ein helles Thema, keinen Farbverlauf und Schatten nur in Tinte', () => {
  expect(themeFindings(allCss())).toEqual([]);
});

async function openBlocks(page: Page) {
  await fakeZitadel(page);
  await page.route('**/api/me', (route) =>
    route.fulfill({
      json: {
        name: 'Anna Schmidt',
        firstName: 'Anna',
        email: 'anna.schmidt@beispiel-einkauf.de',
        organization: { id: 'org-1', name: 'Beispiel-OEM (Demo)' },
        supportView: false,
        permissions: { viewOrganizationSettings: true, viewSuppliers: true, switchCustomer: false },
      },
    }),
  );
  await page.route('**/api/health', (route) => route.fulfill({ json: { status: 'ok' } }));
  await page.goto('/bausteine');
  await expect(page.getByRole('heading', { level: 1, name: 'Bausteine' })).toBeVisible();
}

test('T-CI2 Im Browser laden Figtree und Outfit vom eigenen Server', async ({ page, baseURL }) => {
  const requested: string[] = [];
  page.on('request', (request) => {
    if (request.resourceType() === 'font') requested.push(request.url());
  });
  await openBlocks(page);
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

  test('T-CI3 Die App bleibt hell', async ({ page }) => {
    await openBlocks(page);
    const look = await page.evaluate(() => ({
      scheme: getComputedStyle(document.documentElement).colorScheme,
      background: getComputedStyle(document.documentElement).backgroundColor,
    }));
    // paper aus der Designsprache
    expect(look).toEqual({ scheme: 'light', background: 'rgb(244, 245, 242)' });
  });
});
