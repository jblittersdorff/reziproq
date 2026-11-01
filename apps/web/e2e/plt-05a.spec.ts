import { expect, type Page, test } from '@playwright/test';
import { fakeZitadel } from './fake-zitadel.js';

// Tests zu docs/specs/PLT-05.md (Teil a), die einen echten Browser brauchen: Rolle ändern als
// eigene Seite, zurück zur Liste, 390 px.

test.use({ locale: 'de-DE' });

const url = (path: string) => `http://localhost:5174${path}`;

async function signIn(page: Page) {
  await fakeZitadel(page);
  const members = [
    {
      id: 'lena',
      name: 'Lena Berger',
      email: 'lena@example.com',
      orgRole: 'admin',
      isControlling: false,
      defaultFunction: null as string | null,
    },
    {
      id: 'nina',
      name: 'Nina Roth',
      email: 'nina@example.com',
      orgRole: 'viewer',
      isControlling: false,
      defaultFunction: null as string | null,
    },
  ];
  await page.route('**/api/me', (route) =>
    route.fulfill({
      json: {
        name: 'Lena Berger',
        firstName: 'Lena',
        email: 'lena@example.com',
        organization: { id: 'org-1', name: 'Test-OEM (Demo)' },
        supportView: false,
        orgRole: 'admin',
        permissions: { viewOrganizationSettings: true, viewSuppliers: true, switchCustomer: false },
      },
    }),
  );
  await page.route('**/api/me/permissions', (route) =>
    route.fulfill({
      json: {
        actions: [
          'organisation.sehen',
          'rollen.aendern',
          'einstellungen.verwalten',
          'verlauf.sehen',
        ],
      },
    }),
  );
  await page.route('**/api/organisation', (route) =>
    route.fulfill({ json: { name: 'Test-OEM (Demo)', country: 'DE', members } }),
  );
  await page.route('**/api/organisation/mitglieder/*', (route) => {
    const id = route.request().url().split('/').at(-1);
    const member = members.find((candidate) => candidate.id === id);
    if (!member) return route.fulfill({ status: 404, json: { statusCode: 404 } });
    if (route.request().method() === 'PUT') Object.assign(member, route.request().postDataJSON());
    return route.fulfill({ json: member });
  });
  await page.route('**/api/audit**', (route) => route.fulfill({ json: { entries: [] } }));
  await page.route('**/api/health', (route) => route.fulfill({ json: { status: 'ok' } }));
}

test('Rolle ändern auf eigener Seite; Speichern und Abbrechen führen zur Liste zurück', async ({
  page,
}) => {
  await signIn(page);
  await page.goto('/einstellungen/organisation');
  const table = page.getByRole('table', { name: 'Mitglieder' });
  await expect(table.getByRole('row')).toHaveCount(3);

  await table.getByRole('link', { name: 'Nina Roth bearbeiten' }).click();
  await expect(page).toHaveURL(url('/einstellungen/organisation/nina'));
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(page).toHaveURL(url('/einstellungen/organisation'));

  await table.getByRole('link', { name: 'Nina Roth bearbeiten' }).click();
  await page.getByText('Nutzer', { exact: true }).click();
  await page.getByRole('switch', { name: 'Controlling' }).click();
  await page.getByLabel('Standardfunktion').selectOption('quality');
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page).toHaveURL(url('/einstellungen/organisation'));
  await expect(page.getByText('Gespeichert.')).toBeVisible();
  await expect(table.getByRole('row').nth(2)).toContainText('Nutzer');
  await expect(table.getByRole('row').nth(2)).toContainText('Controlling');
});

for (const width of [1440, 390]) {
  test(`Mitgliederseiten ohne waagerechte Scrollleiste und mit 44-px-Klickflächen (${width} px)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await signIn(page);
    for (const path of ['/einstellungen/organisation', '/einstellungen/organisation/nina']) {
      await page.goto(path);
      await expect(page.locator('#inhalt h1')).toBeVisible();
      await page.waitForLoadState('networkidle');
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, path).toBe(0);
      // Klickfläche wie im Styleguide-Test (PLT-10): Eine Fläche über ::after zählt mit.
      const small = await page.evaluate(() => {
        const px = (value: string) => Number.parseFloat(value) || 0;
        const selector =
          '#inhalt a[href], #inhalt button, #inhalt select, #inhalt label:has(> input[type="radio"])';
        return [...document.querySelectorAll<HTMLElement>(selector)]
          .map((element) => {
            const box = element.getBoundingClientRect();
            const after = getComputedStyle(element, '::after');
            let { width, height } = box;
            if (after.content !== 'none' && after.position === 'absolute') {
              width = Math.max(width, box.width - px(after.left) - px(after.right));
              height = Math.max(height, box.height - px(after.top) - px(after.bottom));
            }
            return { element, width, height };
          })
          .filter(({ width, height }) => width > 1 && height < 44)
          .map(({ element }) => element.getAttribute('aria-label') ?? element.textContent?.trim());
      });
      expect(small, path).toEqual([]);
    }
  });
}
