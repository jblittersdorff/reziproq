import { expect, type Page, test } from '@playwright/test';
import { type FakeZitadel, fakeZitadel } from './fake-zitadel.js';

// Tests zu docs/specs/UMB-02.md: Neu anmelden nach gescheiterter Erneuerung, ohne Fenster und
// Overlay, über eine Weiterleitung zum nachgebauten Zitadel. Die Eingaben kommen aus dem Entwurf.

test.use({ locale: 'de-DE' });

const me = {
  name: 'Ada Lovelace',
  firstName: 'Ada',
  email: 'ada@example.com',
  organization: { id: 'org-1', name: 'Beispiel-OEM (Demo)' },
  supportView: false,
  roles: ['nutzer'],
  permissions: { viewOrganizationSettings: false, viewSuppliers: true, switchCustomer: false },
};

const supplier = (id: string, name: string, cents: number) => ({
  relationshipId: id,
  name,
  country: 'PL',
  category: 'Guss',
  annualSpend: { amountCents: cents, currency: 'EUR' },
  spendYear: 2025,
});

async function fakeApi(page: Page) {
  await page.route('**/api/me', (route) => route.fulfill({ json: me }));
  await page.route('**/api/suppliers', (route) =>
    route.fulfill({
      json: {
        suppliers: [
          supplier('rel-1', 'Silesia Guss Sp. z o.o. (Demo)', 315_000_000),
          supplier('rel-2', 'Rheintal Elektronik GmbH (Demo)', 120_000_000),
        ],
        count: 2,
        spendYear: 2025,
        totalSpend: [{ amountCents: 435_000_000, currency: 'EUR' }],
      },
    }),
  );
  await page.route('**/api/health', (route) => route.fulfill({ json: { status: 'ok' } }));
}

/** Zählt Aufrufe von window.open, auch über Seitenwechsel hinweg. */
async function countWindowOpen(page: Page) {
  await page.addInitScript(() => {
    const opened = Number(sessionStorage.getItem('test-window-open') ?? '0');
    sessionStorage.setItem('test-window-open', String(opened));
    window.open = () => {
      sessionStorage.setItem(
        'test-window-open',
        String(Number(sessionStorage.getItem('test-window-open')) + 1),
      );
      return null;
    };
  });
}

/** Alle Tokens, die das nachgebaute Zitadel bisher ausgegeben hat. */
const issuedTokens = (zitadel: FakeZitadel) => [
  'access-token',
  'refresh-token',
  ...zitadel.idTokens,
];

const sessionStorageText = (page: Page) =>
  page.evaluate(() => JSON.stringify(Object.entries(sessionStorage)));

/** Öffnet die Lieferanten, tippt in die Suche und lässt die Erneuerung scheitern. */
async function typeUntilRenewalFails(page: Page, zitadel: FakeZitadel) {
  zitadel.reply.expiresIn = 5;
  zitadel.reply.refreshWorks = false;
  await page.goto('/lieferanten');
  await expect(page.getByText('Silesia Guss Sp. z o.o. (Demo)')).toBeVisible();
  await page.waitForLoadState('networkidle');
  await page.getByRole('searchbox').fill('Silesia');
  await page.getByLabel('Sortieren').selectOption({ index: 1 });
  const notice = page.getByRole('alert').filter({ hasText: 'Bitte melde dich neu an' });
  await expect(notice).toBeVisible();
  return notice;
}

test('Es öffnet sich kein Popup, und kein Element ist fest positioniert', async ({ page }) => {
  const zitadel = await fakeZitadel(page);
  await countWindowOpen(page);
  await fakeApi(page);
  const popups: unknown[] = [];
  page.on('popup', (popup) => popups.push(popup));

  const notice = await typeUntilRenewalFails(page, zitadel);

  // Der Hinweis steht im Seitenfluss, ganz oben; nichts auf der Seite ist fest positioniert.
  const fixed = await page.evaluate(() =>
    Array.from(document.querySelectorAll('*'))
      .filter((element) => getComputedStyle(element).position === 'fixed')
      .map((element) => element.outerHTML.slice(0, 80)),
  );
  expect(fixed).toEqual([]);
  expect((await notice.boundingBox())?.y).toBeLessThan(40);

  zitadel.reply.refreshWorks = true;
  zitadel.reply.expiresIn = 3600;
  await notice.getByRole('button', { name: 'Neu anmelden' }).click();
  await expect(page.getByText('Silesia Guss Sp. z o.o. (Demo)')).toBeVisible();
  await expect(notice).toHaveCount(0);

  expect(popups).toEqual([]);
  expect(await page.evaluate(() => sessionStorage.getItem('test-window-open'))).toBe('0');
});

test('Nach der Neuanmeldung steht der eingegebene Text wieder im Feld', async ({ page }) => {
  const zitadel = await fakeZitadel(page);
  await fakeApi(page);
  const notice = await typeUntilRenewalFails(page, zitadel);
  const sort = await page.getByLabel('Sortieren').inputValue();

  zitadel.reply.refreshWorks = true;
  zitadel.reply.expiresIn = 3600;
  const pageLoads: string[] = [];
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) pageLoads.push(frame.url());
  });
  await notice.getByRole('button', { name: 'Neu anmelden' }).click();

  // Eine echte Weiterleitung zu Zitadel und zurück auf dieselbe Adresse.
  await expect(page).toHaveURL('http://localhost:5174/lieferanten');
  await expect(page.getByRole('searchbox')).toHaveValue('Silesia');
  await expect(page.getByLabel('Sortieren')).toHaveValue(sort);
  // Die Suche wirkt wieder: nur der passende Lieferant steht in der Liste.
  await expect(page.getByText('Rheintal Elektronik GmbH (Demo)')).toHaveCount(0);
  expect(pageLoads.some((url) => url.startsWith('http://localhost:5174/auth/callback'))).toBe(true);
  expect(zitadel.authorizeRequests).toHaveLength(2);

  // Der Entwurf ist nach der Wiederherstellung gelöscht.
  expect(await page.evaluate(() => sessionStorage.getItem('reziproq-entwurf'))).toBeNull();
});

test('sessionStorage enthält zu keinem Zeitpunkt ein Token', async ({ page }) => {
  const zitadel = await fakeZitadel(page);
  await fakeApi(page);
  const snapshots: string[] = [];

  // Jeder Stand von sessionStorage beim Verlassen einer Seite, also auch kurz vor Zitadel.
  await page.exposeFunction('recordSessionStorage', (text: string) => snapshots.push(text));
  await page.addInitScript(() => {
    const record = () =>
      (window as unknown as { recordSessionStorage: (text: string) => void }).recordSessionStorage(
        JSON.stringify(Object.entries(sessionStorage)),
      );
    window.addEventListener('pagehide', record);
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key: string, value: string) {
      setItem.call(this, key, value);
      if (this === window.sessionStorage) record();
    };
  });

  const notice = await typeUntilRenewalFails(page, zitadel);
  snapshots.push(await sessionStorageText(page));

  zitadel.reply.refreshWorks = true;
  zitadel.reply.expiresIn = 3600;
  await notice.getByRole('button', { name: 'Neu anmelden' }).click();
  await expect(page.getByRole('searchbox')).toHaveValue('Silesia');
  snapshots.push(await sessionStorageText(page));

  // Der Entwurf wurde wirklich gespeichert, enthält aber kein Token.
  expect(snapshots.some((text) => text.includes('reziproq-entwurf'))).toBe(true);
  for (const snapshot of snapshots) {
    for (const token of issuedTokens(zitadel)) expect(snapshot).not.toContain(token);
  }
});
