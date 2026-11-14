import { expect, type Page, test } from '@playwright/test';
import { fakeZitadel } from './fake-zitadel.js';

// Tests zu docs/specs/PLT-05.md (Teil b), die einen echten Browser brauchen: Team bearbeiten als
// eigene Seite, zurück zum Team, 390 px.

test.use({ locale: 'de-DE' });

const id = '0190a0a0-0000-7000-8000-000000000001';
const url = (path: string) => `http://localhost:5174${path}`;

async function signIn(page: Page) {
  await fakeZitadel(page);
  const names: Record<string, string> = {
    lena: 'Lena Berger',
    tom: 'Tom Krüger',
    nina: 'Nina Roth',
  };
  let members = [
    {
      userId: 'lena',
      name: 'Lena Berger',
      teamRole: 'sro',
      function: 'purchasing' as string | null,
      visibility: 'shared',
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
        actions: ['lieferanten.sehen', 'lieferanten.bearbeiten', 'team.festlegen', 'verlauf.sehen'],
      },
    }),
  );
  await page.route(`**/api/suppliers/${id}`, (route) =>
    route.fulfill({
      json: {
        relationshipId: id,
        name: 'Rheintal Elektronik GmbH (Demo)',
        organizationName: 'Rheintal Elektronik GmbH (Demo)',
        country: 'DE',
        vatId: null,
        duns: null,
        externalRef: 'L-10001',
        notes: null,
        status: 'active',
        createdAt: '2026-10-01T08:00:00Z',
        endedAt: null,
        spend: [],
        permissions: { edit: true, editTeam: true },
      },
    }),
  );
  await page.route(`**/api/suppliers/${id}/team`, (route) => {
    if (route.request().method() === 'PUT') {
      members = route
        .request()
        .postDataJSON()
        .members.map(
          (member: {
            userId: string;
            teamRole: string;
            function: string | null;
            visibility: string;
          }) => ({
            ...member,
            name: names[member.userId] ?? member.userId,
          }),
        );
    }
    return route.fulfill({
      json: {
        side: 'buyer',
        counterpart: [{ name: 'Kim Kaiser', teamRole: 'sro', function: null }],
        canEdit: true,
        sroDescription: {
          role: 'sro',
          does: ['Strategie'],
          doesNot: ['Claims'],
          updatedByName: null,
        },
        members,
        candidates: Object.entries(names).map(([userId, name]) => ({
          userId,
          name,
          defaultFunction: userId === 'tom' ? 'quality' : null,
        })),
      },
    });
  });
  await page.route('**/api/audit**', (route) => route.fulfill({ json: { entries: [] } }));
  await page.route('**/api/health', (route) => route.fulfill({ json: { status: 'ok' } }));
}

test('Team bearbeiten auf eigener Seite; Speichern und Abbrechen führen zum Team zurück', async ({
  page,
}) => {
  await signIn(page);
  await page.goto(`/lieferanten/${id}/beziehung/team`);
  const table = page.getByRole('table', { name: 'Unser Team' });
  await expect(table.getByRole('row')).toHaveCount(2);

  await page.getByRole('link', { name: 'Team bearbeiten' }).click();
  await expect(page).toHaveURL(url(`/lieferanten/${id}/beziehung/team/bearbeiten`));
  await page.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(page).toHaveURL(url(`/lieferanten/${id}/beziehung/team`));

  await page.getByRole('link', { name: 'Team bearbeiten' }).click();
  await page.getByLabel('Person hinzufügen').selectOption('tom');
  await page.getByRole('button', { name: 'Hinzufügen' }).click();
  await page.getByRole('combobox', { name: 'Teamrolle: Tom Krüger' }).selectOption('sponsor');
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page).toHaveURL(url(`/lieferanten/${id}/beziehung/team`));
  await expect(page.getByText('Gespeichert.')).toBeVisible();
  await expect(table.getByRole('row')).toHaveCount(3);
  await expect(table).toContainText('Tom KrügerInternSponsorQualität');
});

for (const width of [1440, 390]) {
  test(`Teamseiten ohne waagerechte Scrollleiste und mit 44-px-Klickflächen (${width} px)`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await signIn(page);
    for (const path of [
      `/lieferanten/${id}/beziehung/team`,
      `/lieferanten/${id}/beziehung/team/bearbeiten`,
    ]) {
      await page.goto(path);
      await expect(page.locator('#inhalt h1')).toBeVisible();
      await page.waitForLoadState('networkidle');
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, path).toBe(0);
      const small = await page.evaluate(() =>
        [
          ...document.querySelectorAll<HTMLElement>(
            '#inhalt a[href], #inhalt button, #inhalt select',
          ),
        ]
          .map((element) => ({ element, box: element.getBoundingClientRect() }))
          .filter(({ box }) => box.width > 1 && box.height < 44)
          .map(({ element }) => element.getAttribute('aria-label') ?? element.textContent?.trim()),
      );
      expect(small, path).toEqual([]);
    }
  });
}
