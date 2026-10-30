import { expect, type Page, test } from '@playwright/test';

test.use({ locale: 'de-DE' });

const pages = [
  { path: '/', nav: 'Übersicht', release: '0.1' },
  { path: '/lieferanten', nav: 'Lieferanten', release: '0.1' },
  { path: '/beziehungen', nav: 'Beziehungen', release: '0.2' },
  { path: '/beziehungspuls', nav: 'Beziehungspuls', release: '0.2' },
  { path: '/joint-business-plans', nav: 'Joint Business Plans', release: '0.3' },
  { path: '/qbrs', nav: 'QBRs und Maßnahmen', release: '0.3' },
  { path: '/pnl-impact', nav: 'P&L-Impact', release: '1.0' },
  { path: '/einstellungen', nav: 'Einstellungen', release: undefined },
];

/**
 * Nachgebauter Login: legt eine Sitzung so ab, wie oidc-client-ts sie nach dem Login speichert,
 * und beantwortet die API-Aufrufe. Den echten Ablauf mit PKCE prüft home.spec.ts.
 */
async function signIn(page: Page) {
  const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const user = {
    id_token: `${b64({ alg: 'none' })}.${b64({ iss: 'https://zitadel.test', aud: 'web-client', sub: 'user-1', exp: now + 3600 })}.`,
    access_token: 'access-token-1',
    token_type: 'Bearer',
    scope: 'openid profile email',
    profile: { sub: 'user-1' },
    expires_at: now + 3600,
  };
  await page.addInitScript((value) => {
    sessionStorage.setItem('oidc.user:https://zitadel.test:web-client', value);
  }, JSON.stringify(user));
  await page.route('**/api/me', (route) =>
    route.fulfill({ json: { name: 'Ada Lovelace', email: 'ada@example.com' } }),
  );
  await page.route('**/api/health', (route) => route.fulfill({ json: { status: 'ok' } }));
}

test('Durch alle Seiten klicken; die aktive Seite ist markiert', async ({ page }) => {
  await signIn(page);
  await page.goto('/');
  const nav = page.getByRole('navigation', { name: 'Hauptnavigation' });

  for (const { path, nav: label, release } of pages) {
    await nav.getByRole('link', { name: label }).click();
    await expect(page).toHaveURL(`http://localhost:5174${path}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(nav.getByRole('link', { name: label })).toHaveAttribute('aria-current', 'page');
    await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
    if (release) await expect(page.getByText(`Kommt mit Release ${release}`)).toBeVisible();
  }
});

test('In schmalen Fenstern klappt die Seitenleiste ein', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  await page.goto('/');

  await expect(page.getByRole('navigation', { name: 'Hauptnavigation' })).toBeHidden();
  await page.getByRole('button', { name: 'Navigation öffnen' }).click();

  const sheet = page.getByRole('dialog', { name: 'Hauptnavigation' });
  await sheet.getByRole('link', { name: 'Lieferanten' }).click();
  await expect(page).toHaveURL('http://localhost:5174/lieferanten');
  await expect(sheet).toBeHidden();
  await expect(page.getByRole('heading', { level: 1, name: 'Lieferanten' })).toBeVisible();

  // Esc schließt die eingeblendete Seitenleiste wieder.
  await page.getByRole('button', { name: 'Navigation öffnen' }).click();
  await expect(sheet).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();
});

test('Darstellung folgt der Systemeinstellung', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await signIn(page);
  await page.goto('/einstellungen');
  await expect(page.locator('html')).toHaveClass(/dark/);
  await expect(page.getByRole('radio', { name: 'System' })).toBeChecked();

  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).not.toHaveClass(/dark/);
});
