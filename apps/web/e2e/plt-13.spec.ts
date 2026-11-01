import { expect, type Page, test } from '@playwright/test';
import { fakeZitadel } from './fake-zitadel.js';

// Tests zu docs/specs/PLT-13.md im echten Browser: Kunde wechseln, Hinweisleiste, Maße.

test.use({ locale: 'de-DE' });

const customers = [
  { id: 'de300000-0000-7000-8000-000000000001', name: 'Beispiel-OEM (Demo)', country: 'DE' },
  { id: 'de300000-0000-7000-8000-000000000002', name: 'Zweit-OEM (Demo)', country: 'DE' },
];

/** Nachgebauter Login als Betreiber; die API antwortet je nach mitgeschicktem Kunden. */
async function signInAsOperator(page: Page) {
  // Seit PLT-01 über den echten Ablauf mit nachgebautem Zitadel; Tokens liegen nur im Speicher.
  await fakeZitadel(page);

  const seen: (string | null)[] = [];
  await page.route('**/api/**', (route) => {
    const url = new URL(route.request().url());
    const customer = route.request().headers()['x-reziproq-kunde'] ?? null;
    seen.push(customer);
    const chosen = customers.find((c) => c.id === customer) ?? null;
    if (url.pathname === '/api/me') {
      return route.fulfill({
        json: {
          name: 'Olaf Betrieb',
          firstName: 'Olaf',
          email: 'olaf@reziproq.test',
          organization: chosen && { id: chosen.id, name: chosen.name },
          supportView: chosen !== null,
          permissions: {
            viewOrganizationSettings: false,
            viewSuppliers: chosen !== null,
            switchCustomer: true,
          },
        },
      });
    }
    if (url.pathname === '/api/betreiber/kunden') return route.fulfill({ json: { customers } });
    if (url.pathname === '/api/suppliers') {
      return route.fulfill({ json: { suppliers: [], count: 0, totalSpend: [], spendYear: 2025 } });
    }
    return route.fulfill({ json: { status: 'ok' } });
  });
  return seen;
}

/** Seit PLT-11 über die Seite /profil; der Dialog zur Auswahl bleibt bis UMB-01. */
async function switchTo(page: Page, name: string) {
  await page
    .getByRole('navigation', { name: 'Hauptnavigation' })
    .getByRole('link', { name: 'Profil' })
    .click();
  await page.getByRole('button', { name: 'Kunde wechseln' }).click();
  await page
    .getByRole('dialog', { name: 'In einen Kunden wechseln' })
    .getByRole('button', { name: new RegExp(name) })
    .click();
}

test('Betreiber wechseln in einen Kunden und verlassen die Ansicht wieder', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const seen = await signInAsOperator(page);
  await page.goto('/lieferanten');
  // Ohne eigene Organisation sieht ein Betreiber nur den Hinweis, bis er einen Kunden wählt (PLT-02).
  await expect(page.locator('#inhalt').getByRole('status')).toContainText('Kunde wechseln');
  await expect(page.locator('#inhalt h1')).toHaveCount(0);

  await switchTo(page, 'Zweit-OEM');
  const banner = page.getByText(
    'Betreiber-Ansicht: Zweit-OEM (Demo). Alle Zugriffe werden protokolliert.',
  );
  await expect(banner).toBeVisible();
  await expect(page).toHaveURL('http://localhost:5174/start');
  expect(seen.at(-1)).toBe(customers[1]?.id);

  // Die Ansicht bleibt beim Navigieren bestehen.
  await page
    .getByRole('navigation', { name: 'Hauptnavigation' })
    .getByRole('link', { name: 'Lieferanten' })
    .click();
  await expect(banner).toBeVisible();

  await page.getByRole('button', { name: 'Verlassen' }).click();
  await expect(banner).toBeHidden();
  await expect.poll(() => seen.at(-1)).toBeNull();
});

for (const width of [1440, 390]) {
  test(`Hinweisleiste und Kundenauswahl haben 44-px-Klickflächen, ohne Scrollleiste (${width} px)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await signInAsOperator(page);
    await page.addInitScript(
      (customer) => {
        sessionStorage.setItem('reziproq-betreiber-kunde', customer);
      },
      JSON.stringify({ id: customers[0]?.id, name: customers[0]?.name }),
    );
    await page.goto('/profil');
    await expect(page.getByRole('button', { name: 'Verlassen' })).toBeVisible();

    const leave = await page.getByRole('button', { name: 'Verlassen' }).boundingBox();
    expect(leave?.height).toBeGreaterThanOrEqual(44);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);

    await page.getByRole('button', { name: 'Kunde wechseln' }).click();
    const dialog = page.getByRole('dialog', { name: 'In einen Kunden wechseln' });
    await expect(dialog.getByRole('button')).toHaveCount(2);
    await page.waitForFunction(() =>
      document.getAnimations().every((a) => a.playState !== 'running'),
    );
    const heights = await dialog
      .getByRole('button')
      .evaluateAll((buttons) => buttons.map((button) => button.getBoundingClientRect().height));
    expect(heights.every((height) => height >= 44)).toBe(true);
  });
}
