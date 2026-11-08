import { expect, type Page, test } from '@playwright/test';
import { fakeZitadel } from './fake-zitadel.js';

// Tests zu docs/specs/PLT-12.md, die einen echten Browser brauchen: Tastenkürzel, Fokus, Maße.
// Seit PLT-11 ist das Gespräch die Seite /fragen statt eines Fensters.
// Die API wird nachgebaut; die Antwort kommt als NDJSON wie von der echten API.

test.use({ locale: 'de-DE' });

const pages = ['/start', '/lieferanten', '/portfolio', '/wirkung', '/profil', '/einstellungen'];

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
    route.fulfill({ json: { suppliers: [], count: 0, totalSpend: [], spendYear: 2025 } }),
  );
  await page.route('**/api/prompt', (route) => {
    const question = route.request().postDataJSON().messages.at(-1).content as string;
    const events = question.includes('Portfolio')
      ? [
          { type: 'text', delta: 'Hier ist der Link zu Portfolio.' },
          {
            type: 'navigate',
            destination: { type: 'area', path: '/portfolio' },
          },
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
                externalRef: null,
                status: 'active',
                spend: { amountCents: 564_000_000, currency: 'EUR' },
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

const questions = (page: Page) => page.locator('#inhalt');
const field = (page: Page) => page.getByRole('textbox', { name: 'Deine Frage an Reziproq' });

for (const shortcut of ['Meta+k', 'Control+k']) {
  test(`${shortcut} öffnet /fragen von jeder Seite; Fokus im Feld; kein Fenster`, async ({
    page,
  }) => {
    await signIn(page);
    for (const path of pages) {
      await page.goto(path);
      await expect(page.locator('#inhalt h1')).toBeVisible();
      await page.keyboard.press(shortcut);
      await expect(page).toHaveURL('http://localhost:5174/fragen');
      await expect(field(page)).toBeFocused();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      // Browser-Zurück führt zur Seite davor.
      await page.goBack();
      await expect(page).toHaveURL(`http://localhost:5174${path}`);
    }
  });
}

test('Das Feld auf Start stellt eine Frage auf /fragen', async ({ page }) => {
  await signIn(page);
  await page.goto('/start');
  await page.getByRole('textbox', { name: 'Deine Frage an Reziproq' }).fill('Öffne das Portfolio');
  await page.getByRole('button', { name: 'Fragen' }).click();
  await expect(page).toHaveURL(/http:\/\/localhost:5174\/fragen\?q=/);
  await expect(questions(page).getByText('Hier ist der Link zu Portfolio.')).toBeVisible();
  await page.getByRole('link', { name: 'Bereich öffnen' }).click();
  await expect(page).toHaveURL('http://localhost:5174/portfolio');
});

test('Vorschlag übernehmen, fragen, Karten sehen, dann zum Portfolio springen', async ({
  page,
}) => {
  await signIn(page);
  await page.goto('/fragen');
  await expect(page.locator('#inhalt h1')).toBeVisible();

  await questions(page)
    .getByRole('button', { name: 'Zeig mir die Lieferanten mit dem höchsten Spend' })
    .click();
  await expect(field(page)).toHaveValue('Zeig mir die Lieferanten mit dem höchsten Spend');
  await page.keyboard.press('Enter');
  await expect(questions(page).getByText('Ich habe 1 Lieferanten gefunden.')).toBeVisible();
  await expect(
    questions(page).getByRole('heading', { name: 'Pearl River Components Ltd. (Demo)' }),
  ).toBeVisible();

  await field(page).fill('Öffne das Portfolio');
  await page.keyboard.press('Enter');
  await expect(questions(page).getByRole('link', { name: 'Bereich öffnen' })).toBeVisible();
  await questions(page).getByRole('link', { name: 'Bereich öffnen' }).click();
  await expect(page).toHaveURL('http://localhost:5174/portfolio');
});

for (const width of [1440, 390]) {
  test(`Alle Klickflächen auf /fragen sind mindestens 44 × 44 px groß (${width} px)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await signIn(page);
    await page.goto('/fragen');
    await expect(page.locator('#inhalt h1')).toBeVisible();

    const tooSmall = () =>
      questions(page).evaluate((root) =>
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
    await expect(questions(page).getByRole('button', { name: 'Neu beginnen' })).toBeVisible();
    expect(await tooSmall()).toEqual([]);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
  });
}
