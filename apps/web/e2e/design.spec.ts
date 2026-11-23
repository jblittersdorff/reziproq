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
  'Aussage, Beleg und Daten',
  'Kopfleiste',
  'Lieferanten-Leiste',
  'Ablauf-Leiste',
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
  // Designsprache 2: Entwurf mit 1 px Mint-Rand und Doppelring, bestätigt ohne Doppelring
  await expect(page.locator('[data-slot="ai-draft"]:not([data-confirmed])')).toHaveCSS(
    'border-top-color',
    'rgb(207, 229, 221)',
  );
  await expect(
    page.locator('[data-slot="ai-draft"]:not([data-confirmed]) [data-slot="brand-mark"]').first(),
  ).toBeVisible();
  await expect(
    page.locator('[data-slot="ai-draft"][data-confirmed] [data-slot="brand-mark"]'),
  ).toHaveCount(0);
  await expect(page.locator('[data-layer="private"]')).toHaveCSS('border-top-style', 'dashed');
  await expect(page.getByRole('table', { name: 'Initiativen 2027' })).toContainText('läuft');
  // Kopfleiste: aktiver Punkt markiert, Profil als Kreis mit Initialen und Namen
  const header = page.getByRole('navigation', { name: 'Hauptnavigation (Beispiel)' });
  await expect(header.getByRole('link', { name: 'Lieferanten' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(header.getByRole('link', { name: 'Profil' })).toHaveText('AS');
  // Lieferanten-Leiste: Bereich und Unterseite markiert, Kette mit Text
  await expect(
    page
      .getByRole('navigation', { name: 'Bereiche des Lieferanten (Beispiel)' })
      .getByRole('link', { name: 'Gemeinsamer Plan' }),
  ).toHaveAttribute('aria-current', 'page');
  await expect(
    page
      .getByRole('navigation', { name: 'Seiten im Bereich (Beispiel)' })
      .getByRole('link', { name: 'Initiativen' }),
  ).toHaveAttribute('aria-current', 'page');
  await expect(page.getByRole('img', { name: 'Schritt 4 von 6 · Gemeinsamer Plan' })).toBeVisible();
  // Ablauf-Leiste: Schritt n von m und „Fertig, wenn“
  const flow = page.getByRole('region', { name: 'Ablauf-Leiste', exact: true });
  await expect(flow.getByText('Fertig, wenn', { exact: true })).toBeVisible();
  await expect(
    flow.getByRole('list', { name: 'Schritt 2 von 6' }).getByRole('listitem'),
  ).toHaveCount(6);
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
        // Unsichtbare Ziele, z. B. der Menüknopf auf breiten Bildschirmen, zählen nicht.
        .filter((element) => element.getBoundingClientRect().width > 1)
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
    const evidence = page.getByRole('region', { name: 'Aussage, Beleg und Daten' });
    await evidence.screenshot({ path: testInfo.outputPath(`auswertung-${width}.png`) });
    await page.screenshot({ path: testInfo.outputPath(`design-${width}.png`), fullPage: true });
  });
}

test('Aussage und Ringpaar führen zum zunächst verborgenen Rechenweg', async ({ page }) => {
  await openDesign(page);
  const section = page.getByRole('region', { name: 'Aussage, Beleg und Daten' });
  await expect(section.getByRole('heading', { name: /Das Jahresziel ist zu 69/ })).toBeVisible();
  await expect(section.getByText('412 von 600 T€')).toBeVisible();
  const bars = section.getByText('Guss trägt mit 180 T€ am meisten bei.');
  await expect(bars).toBeHidden();
  await section.getByRole('link', { name: 'Wie setzt sich das Ergebnis zusammen?' }).click();
  await expect(bars).toBeVisible();
  await expect(page).toHaveURL(/#design-breakdown$/);
});
