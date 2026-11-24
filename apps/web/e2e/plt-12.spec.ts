import { expect, type Page, test } from '@playwright/test';
import { fakeZitadel } from './fake-zitadel.js';

// Tests zu docs/specs/PLT-12.md, die einen echten Browser brauchen: Tastenkürzel, Fokus, Maße.
// Seit NAV-10 2.0 (K1-d) liegt das Gespräch in der Überlagerung Frag Reziproq (E-K0-01).
// Die API wird nachgebaut; die Antwort kommt als NDJSON wie von der echten API.

test.use({ locale: 'de-DE' });

// NAV-10: die neuen Adressen; die alten leiten weiter und hätten kein eigenes Zurück-Ziel.
const pages = ['/heute', '/beziehungen', '/wert', '/profil', '/einstellungen'];

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

const questions = (page: Page) => page.getByRole('dialog', { name: 'Frag Reziproq' });
const field = (page: Page) => page.getByRole('textbox', { name: 'Deine Frage an Reziproq' });

for (const shortcut of ['Meta+k', 'Control+k']) {
  test(`${shortcut} öffnet Frag Reziproq über jeder Seite; Fokus im Feld; Esc schließt`, async ({
    page,
  }) => {
    await signIn(page);
    for (const path of pages) {
      await page.goto(path);
      await expect(page.locator('#inhalt h1')).toBeVisible();
      await page.keyboard.press(shortcut);
      // NAV-10 2.0, E-K0-01: eine Überlagerung über der Seite; offen, solange ?frag dasteht.
      await expect(questions(page)).toBeVisible();
      await expect(field(page)).toBeFocused();
      await expect(page).toHaveURL(`http://localhost:5174${path}?frag=1`);
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await expect(page).toHaveURL(`http://localhost:5174${path}`);
    }
  });
}

test('Browser-Zurück schließt Frag Reziproq und bleibt auf der Seite', async ({ page }) => {
  await signIn(page);
  await page.goto('/beziehungen');
  await expect(page.locator('#inhalt h1')).toBeVisible();
  await page.keyboard.press('Control+k');
  await expect(questions(page)).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page).toHaveURL('http://localhost:5174/beziehungen');
  await expect(page.locator('#inhalt h1')).toHaveText('Beziehungen');
});

test('Der Fokus bleibt in Frag Reziproq, bis sie schließt; danach ist die Seite wieder bedienbar', async ({
  page,
}) => {
  await signIn(page);
  await page.goto('/heute');
  await expect(page.locator('#inhalt h1')).toBeVisible();
  await page.keyboard.press('Control+k');
  await expect(field(page)).toBeFocused();
  for (let step = 0; step < 8; step += 1) {
    await page.keyboard.press('Tab');
    const outside = await page.evaluate(() => {
      const dialog = document.querySelector('dialog[open]');
      const active = document.activeElement;
      return !!active && active !== document.body && !dialog?.contains(active);
    });
    expect(outside, `Schritt ${step + 1}: Fokus außerhalb`).toBe(false);
  }
  await page.getByRole('button', { name: 'Schließen' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page
    .getByRole('navigation', { name: 'Hauptnavigation' })
    .getByRole('link', { name: 'Beziehungen' })
    .click();
  await expect(page).toHaveURL('http://localhost:5174/beziehungen');
});

test('„Frag“ in der Tab-Leiste öffnet auf dem Telefon Frag Reziproq und stellt dort die Frage', async ({
  page,
}) => {
  // NAV-10 2.0: auf dem Telefon „Frag“ in der Tab-Leiste, als Vollbild; am Schreibtisch ⌘K
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  await page.goto('/heute');
  await expect(page.locator('#inhalt h1')).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Tab-Leiste' })
    .getByRole('button', { name: 'Frag', exact: true })
    .click();
  await expect(questions(page)).toBeVisible();
  const box = await questions(page).boundingBox();
  expect(box?.width).toBe(390);
  await field(page).fill('Öffne das Portfolio');
  await page.keyboard.press('Enter');
  await expect(questions(page).getByText('Hier ist der Link zu Portfolio.')).toBeVisible();
  await page.getByRole('link', { name: 'Bereich öffnen' }).click();
  await expect(page).toHaveURL(/\/beziehungen\?ansicht=matrix$/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('Vorschlag übernehmen, fragen, Karten sehen, dann zum Portfolio springen', async ({
  page,
}) => {
  await signIn(page);
  // Die frühere Seite /fragen öffnet Frag Reziproq über Heute (TN-07).
  await page.goto('/fragen');
  await expect(questions(page)).toBeVisible();
  await expect(page).toHaveURL('http://localhost:5174/heute?frag=1');

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
  await expect(page).toHaveURL(/\/beziehungen\?ansicht=matrix$/);
});

for (const width of [1440, 390]) {
  test(`Alle Klickflächen in Frag Reziproq sind mindestens 44 × 44 px groß (${width} px)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await signIn(page);
    await page.goto('/fragen');
    await expect(questions(page)).toBeVisible();

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
