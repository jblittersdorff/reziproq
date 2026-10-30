import { expect, type Page, test } from '@playwright/test';
import { fakeZitadel } from './fake-zitadel.js';

// Tests zu docs/specs/PLT-12.md, die einen echten Browser brauchen: Tastenkürzel, Fokus, Maße.
// Die API wird nachgebaut; die Antwort kommt als NDJSON wie von der echten API.

test.use({ locale: 'de-DE' });

const pages = [
  '/uebersicht',
  '/lieferanten',
  '/beziehungen',
  '/puls',
  '/jbp',
  '/qbr',
  '/pnl',
  '/einstellungen',
];

async function signIn(page: Page) {
  // Seit PLT-01 über den echten Ablauf mit nachgebautem Zitadel; Tokens liegen nur im Speicher.
  await fakeZitadel(page);
  await page.route('**/api/me', (route) =>
    route.fulfill({
      json: {
        name: 'Anna Schmidt',
        firstName: 'Anna',
        email: 'anna@example.com',
        organization: { id: 'org-1', name: 'Beispiel-OEM (Demo)' },
        supportView: false,
        permissions: {
          viewOrganizationSettings: false,
          viewSuppliers: true,
          switchCustomer: false,
        },
      },
    }),
  );
  await page.route('**/api/suppliers', (route) =>
    route.fulfill({ json: { suppliers: [], count: 0, totalSpend: [], spendYear: null } }),
  );
  await page.route('**/api/prompt', (route) => {
    const question = route.request().postDataJSON().messages.at(-1).content as string;
    const events = question.includes('Beziehungspuls')
      ? [
          { type: 'text', delta: 'Ich öffne Beziehungspuls.' },
          { type: 'navigate', to: '/puls' },
          { type: 'done' },
        ]
      : [
          { type: 'text', delta: 'Ich habe 1 Lieferanten gefunden.' },
          {
            type: 'suppliers',
            suppliers: [
              {
                relationshipId: 'r1',
                name: 'Pearl River Components Ltd. (Demo)',
                country: 'CN',
                category: 'Elektronik',
                annualSpend: { amountCents: 564_000_000, currency: 'EUR' },
                spendYear: 2025,
              },
            ],
          },
          { type: 'done' },
        ];
    return route.fulfill({
      headers: { 'content-type': 'application/x-ndjson' },
      body: events.map((event) => JSON.stringify(event)).join('\n'),
    });
  });
}

const dialog = (page: Page) => page.getByRole('dialog', { name: 'Frag Reziproq' });
const field = (page: Page) => page.getByRole('textbox', { name: 'Deine Frage an Reziproq' });

/** Wartet, bis das Einblenden fertig ist; währenddessen ist das Fenster leicht verkleinert. */
const animationsDone = (page: Page) =>
  page.waitForFunction(() =>
    document.getAnimations().every((animation) => animation.playState !== 'running'),
  );

for (const shortcut of ['Meta+k', 'Control+k']) {
  test(`${shortcut} öffnet das Fenster auf jeder Seite; Fokus im Feld; Esc schließt`, async ({
    page,
  }) => {
    await signIn(page);
    for (const path of pages) {
      await page.goto(path);
      await expect(page.locator('#inhalt h1')).toBeVisible();
      await page.keyboard.press(shortcut);
      await expect(dialog(page)).toBeVisible();
      await expect(field(page)).toBeFocused();
      await page.keyboard.press('Escape');
      await expect(dialog(page)).toBeHidden();
    }
  });
}

test('Das Feld auf der Übersicht öffnet dasselbe Fenster', async ({ page }) => {
  await signIn(page);
  await page.goto('/uebersicht');
  await page.getByRole('button', { name: /Frag Reziproq …/ }).click();
  await expect(dialog(page)).toBeVisible();
  await expect(field(page)).toBeFocused();
});

test('Vorschlag übernehmen, fragen, Karten sehen, dann zum Beziehungspuls springen', async ({
  page,
}) => {
  await signIn(page);
  await page.goto('/uebersicht');
  await expect(page.locator('#inhalt h1')).toBeVisible();
  await page.keyboard.press('Control+k');

  await dialog(page)
    .getByRole('button', { name: 'Zeig mir die Lieferanten mit dem höchsten Spend' })
    .click();
  await expect(field(page)).toHaveValue('Zeig mir die Lieferanten mit dem höchsten Spend');
  await page.keyboard.press('Enter');
  await expect(dialog(page).getByText('Ich habe 1 Lieferanten gefunden.')).toBeVisible();
  await expect(
    dialog(page).getByRole('heading', { name: 'Pearl River Components Ltd. (Demo)' }),
  ).toBeVisible();

  await field(page).fill('Öffne den Beziehungspuls');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL('http://localhost:5174/puls');
  await expect(dialog(page)).toBeHidden();
});

for (const width of [1440, 390]) {
  test(`Alle Klickflächen im Fenster sind mindestens 44 × 44 px groß (${width} px)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await signIn(page);
    await page.goto('/uebersicht');
    await expect(page.locator('#inhalt h1')).toBeVisible();
    await page.keyboard.press('Control+k');
    await expect(dialog(page)).toBeVisible();
    await animationsDone(page);

    const tooSmall = () =>
      dialog(page).evaluate((root) =>
        [...root.querySelectorAll<HTMLElement>('a[href], button')]
          .map((element) => ({ element, box: element.getBoundingClientRect() }))
          .filter(({ box }) => box.width > 1 && (box.width < 44 || box.height < 44))
          .map(
            ({ element, box }) => `${element.textContent?.trim()}: ${box.width} × ${box.height}`,
          ),
      );
    expect(await tooSmall()).toEqual([]);

    await field(page).fill('Zeig mir die Lieferanten mit dem höchsten Spend');
    await page.keyboard.press('Enter');
    await expect(dialog(page).getByRole('button', { name: 'Neu beginnen' })).toBeVisible();
    expect(await tooSmall()).toEqual([]);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
  });
}
