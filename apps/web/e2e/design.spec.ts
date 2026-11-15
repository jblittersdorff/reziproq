import { expect, type Page, test } from '@playwright/test';
import { fakeZitadel } from './fake-zitadel.js';

// Interne Seite /design mit allen Bausteinen der Designsprache „Zwei Kreise“
// (docs/design/designsprache.md, Abschnitt Bausteine).

test.use({ locale: 'de-DE', colorScheme: 'light' });

async function openDesign(page: Page) {
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
  await page.goto('/design');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Bausteine nachschlagen' }),
  ).toBeVisible();
  await page.waitForLoadState('networkidle');
}

const blocks = [
  'Logo',
  'Knöpfe',
  'Chip',
  'Monogramm',
  'Schalter',
  'Kette',
  'Schrittfolge',
  'Datumskreis',
  'Listenkarte',
  'Privat und Geteilt',
  'KI-Entwurf',
  'Leitfragen',
  'Tabelle',
  'Zeitachse',
  'Balken',
  'Nächster Schritt',
  'Karte und Kennzahl',
];

test('Ohne Login leitet /design zur Anmeldung weiter', async ({ page }) => {
  const zitadel = await fakeZitadel(page);
  zitadel.session.active = false;
  await page.goto('/design');
  await expect(page.getByText('Zitadel-Login')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Bausteine nachschlagen' })).toHaveCount(0);
});

test('/design zeigt jeden Baustein mit Vorlage und Datei', async ({ page }) => {
  await openDesign(page);
  for (const block of blocks) {
    const section = page.getByRole('region', { name: block, exact: true });
    await expect(section, block).toBeVisible();
    await expect(section.getByText('components/ui/').first(), block).toBeVisible();
  }
  // Status und Stand stehen als Text, nicht nur als Farbe.
  await expect(
    page.getByRole('img', { name: 'Zyklus: 3 von 6 Schritten fertig, Gemeinsamer Plan läuft' }),
  ).toBeVisible();
  await expect(page.getByRole('list', { name: 'Jahreszyklus' }).getByRole('listitem')).toHaveCount(
    6,
  );
  await expect(page.locator('[data-slot="ai-draft"][data-confirmed]')).toHaveCSS(
    'border-top-style',
    'solid',
  );
  await expect(page.locator('[data-slot="ai-draft"]:not([data-confirmed])')).toHaveCSS(
    'border-top-style',
    'dashed',
  );
  await expect(page.locator('[data-layer="private"]')).toHaveCSS('border-top-style', 'dashed');
  await expect(page.getByRole('table', { name: 'Initiativen 2027' })).toContainText('läuft');
});

test('/design nutzt die Schriften der Designsprache', async ({ page }) => {
  await openDesign(page);
  const fonts = await page.evaluate(() => ({
    title: getComputedStyle(document.querySelector('h1') as Element).fontFamily,
    text: getComputedStyle(document.body).fontFamily,
  }));
  expect(fonts.title).toContain('Outfit');
  expect(fonts.text).toContain('Figtree');
  expect(await page.evaluate(() => document.fonts.check('600 16px Outfit'))).toBe(true);
});

for (const width of [1440, 390]) {
  test(`Auf /design ist jede Klickfläche mindestens 44 px hoch, ohne Seitwärtsscrollen (${width} px)`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await openDesign(page);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
    const tooSmall = await page.evaluate(() =>
      [
        ...document.querySelectorAll<HTMLElement>(
          'a[href], button, label:has(> input[type="radio"])',
        ),
      ]
        .map((element) => {
          const box = element.getBoundingClientRect();
          const after = getComputedStyle(element, '::after');
          let height = box.height;
          if (after.content !== 'none' && after.position === 'absolute') {
            height = Math.max(
              height,
              box.height -
                (Number.parseFloat(after.top) || 0) -
                (Number.parseFloat(after.bottom) || 0),
            );
          }
          return { label: element.textContent?.trim(), height };
        })
        .filter((target) => target.height < 44),
    );
    expect(tooSmall).toEqual([]);
    await page.screenshot({ path: testInfo.outputPath(`design-${width}.png`), fullPage: true });
  });
}
