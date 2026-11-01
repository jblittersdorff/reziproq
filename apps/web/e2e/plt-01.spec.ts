import { expect, type Page, test } from '@playwright/test';
import { fakeZitadel, issuer } from './fake-zitadel.js';

// Tests zu docs/specs/PLT-01.md, die einen echten Browser brauchen: Anmelden mit PKCE über ein
// nachgebautes Zitadel, Erneuerung im Hintergrund, Abmelden.

test.use({ locale: 'de-DE' });

const ada = {
  name: 'Ada Lovelace',
  firstName: 'Ada',
  email: 'ada@example.com',
  organization: { id: 'org-1', name: 'Beispiel-OEM (Demo)' },
  supportView: false,
  orgRole: 'member',
  permissions: { viewOrganizationSettings: false, viewSuppliers: true, switchCustomer: false },
};

const suppliers = {
  suppliers: [
    {
      relationshipId: 'rel-1',
      name: 'Silesia Guss Sp. z o.o. (Demo)',
      country: 'PL',
      externalRef: null,
      status: 'active',
      spend: { amountCents: 315_000_000, currency: 'EUR' },
    },
  ],
  count: 1,
  spendYear: 2025,
  totalSpend: [{ amountCents: 315_000_000, currency: 'EUR' }],
};

/** Beantwortet die API und merkt sich, mit welchem Token sie aufgerufen wurde. */
async function fakeApi(page: Page) {
  const tokens: string[] = [];
  const record = (header: string | undefined) => tokens.push(header?.replace('Bearer ', '') ?? '');
  await page.route('**/api/me', (route) => {
    record(route.request().headers().authorization);
    return route.fulfill({ json: ada });
  });
  await page.route('**/api/suppliers', (route) => {
    record(route.request().headers().authorization);
    return route.fulfill({ json: suppliers });
  });
  await page.route('**/api/health', (route) => route.fulfill({ json: { status: 'ok' } }));
  return tokens;
}

/** Alles, was im Browser dauerhaft gespeichert ist, als Text. */
const storedEverywhere = (page: Page) =>
  page.evaluate(() =>
    JSON.stringify({
      local: Object.fromEntries(Object.entries(localStorage)),
      session: Object.fromEntries(Object.entries(sessionStorage)),
      cookies: document.cookie,
    }),
  );

test('Ohne Anmeldung leitet jede Seite zu Zitadel; nach dem Login geht es zur ursprünglich angefragten Seite', async ({
  page,
}) => {
  const zitadel = await fakeZitadel(page);
  zitadel.session.active = false;
  await fakeApi(page);

  // 1. Ohne Sitzung direkt eine Unterseite öffnen: Die App leitet ohne Klick zu Zitadel weiter.
  await page.goto('/lieferanten?suche=guss');
  await expect(page.getByText('Zitadel-Login')).toBeVisible();
  const params = zitadel.authorizeRequests[0];
  expect(params?.get('response_type')).toBe('code');
  expect(params?.get('client_id')).toBe('web-client');
  expect(params?.get('redirect_uri')).toBe('http://localhost:5174/auth/callback');
  expect(params?.get('code_challenge_method')).toBe('S256');
  expect(params?.get('code_challenge')).toBeTruthy();
  expect(params?.get('scope')).toBe(
    'openid profile email offline_access urn:zitadel:iam:org:projects:roles urn:zitadel:iam:user:resourceowner',
  );

  // 2. Zitadel bestätigt die Anmeldung und leitet mit Code und State zurück.
  zitadel.session.active = true;
  await page.goto(`/auth/callback?code=code-1&state=${params?.get('state')}`, {
    waitUntil: 'commit',
  });

  await expect(page).toHaveURL('http://localhost:5174/lieferanten?suche=guss');
  await expect(
    page.locator('#inhalt').getByRole('heading', { level: 1, name: 'Lieferanten' }),
  ).toBeVisible();
  expect(zitadel.tokenRequests[0]).toMatchObject({ grantType: 'authorization_code' });
  expect(zitadel.tokenRequests[0]?.codeVerifier).toBeTruthy();
});

test('Tokens liegen nur im Speicher; nach dem Neuladen holt eine Weiterleitung die Sitzung', async ({
  page,
}) => {
  const zitadel = await fakeZitadel(page);
  await fakeApi(page);
  await page.goto('/start');
  await expect(page.locator('#inhalt h1')).toBeVisible();

  const stored = await storedEverywhere(page);
  expect(stored).not.toContain('access-token');
  expect(stored).not.toContain('refresh-token');
  for (const idToken of zitadel.idTokens) expect(stored).not.toContain(idToken);

  await page.reload();
  await expect(page.locator('#inhalt h1')).toBeVisible();
  await expect(page).toHaveURL('http://localhost:5174/start');
  expect(zitadel.authorizeRequests).toHaveLength(2);
});

test('Geschützte Seiten zeigen vor abgeschlossener Anmeldung keine Inhalte', async ({ page }) => {
  const zitadel = await fakeZitadel(page);
  await fakeApi(page);

  // Zitadel antwortet beim Tausch des Codes langsam; so lange darf nichts vom Inhalt erscheinen.
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.context().route(`${issuer}/oauth/v2/token`, async (route) => {
    await held;
    return route.fallback();
  });

  await page.goto('/lieferanten');
  await expect(page.getByRole('status')).toHaveText('Anmeldung wird geprüft …');
  await page.waitForTimeout(300);
  await expect(page.locator('#inhalt')).toHaveCount(0);
  await expect(page.getByText('Silesia Guss Sp. z o.o. (Demo)')).toHaveCount(0);
  await expect(page.getByRole('navigation')).toHaveCount(0);

  release();
  await expect(page.getByText('Silesia Guss Sp. z o.o. (Demo)')).toBeVisible();
  expect(zitadel.tokenRequests).toHaveLength(1);
});

test('Die App erneuert ein abgelaufenes Token ohne Neuanmeldung', async ({ page }) => {
  const zitadel = await fakeZitadel(page);
  // Kurz gültige Tokens: oidc-client-ts erneuert sie sofort im Hintergrund.
  zitadel.reply.expiresIn = 5;
  const apiTokens = await fakeApi(page);

  await page.goto('/start');
  await expect(page.locator('#inhalt h1')).toBeVisible();
  await expect
    .poll(() => zitadel.tokenRequests.filter((r) => r.grantType === 'refresh_token').length)
    .toBeGreaterThan(0);
  expect(zitadel.tokenRequests.find((r) => r.grantType === 'refresh_token')?.refreshToken).toBe(
    'refresh-token-0',
  );

  // Die nächste Anfrage an die API kommt mit dem neuen Token; Zitadel wurde nicht erneut gefragt.
  await page
    .getByRole('navigation', { name: 'Hauptnavigation' })
    .getByRole('link', { name: 'Lieferanten' })
    .click();
  await expect(page.getByText('Silesia Guss Sp. z o.o. (Demo)')).toBeVisible();
  expect(apiTokens.at(-1)).toMatch(/^access-token-erneuert-\d+$/);
  expect(zitadel.authorizeRequests).toHaveLength(1);
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('Scheitert die Erneuerung, erscheint „Bitte melde dich neu an“; Eingaben bleiben erhalten', async ({
  page,
}) => {
  const zitadel = await fakeZitadel(page);
  zitadel.reply.expiresIn = 5;
  zitadel.reply.refreshWorks = false;
  await fakeApi(page);

  await page.goto('/lieferanten');
  // Erst tippen, wenn die Liste nach der Anmeldung steht – wie ein Mensch auch.
  await expect(page.getByText('Silesia Guss Sp. z o.o. (Demo)')).toBeVisible();
  await page.waitForLoadState('networkidle');
  const search = page.getByRole('searchbox');
  await search.fill('Silesia');

  const notice = page.getByRole('alert').filter({ hasText: 'Bitte melde dich neu an' });
  await expect(notice).toBeVisible();
  await expect(search).toHaveValue('Silesia');
  expect(zitadel.authorizeRequests).toHaveLength(1);

  // Neu anmelden über eine Weiterleitung; die Eingabe kommt aus dem Entwurf zurück (UMB-02).
  zitadel.reply.refreshWorks = true;
  zitadel.reply.expiresIn = 3600;
  const before = page.url();
  await notice.getByRole('button', { name: 'Neu anmelden' }).click();

  // Zurück auf dieselbe Adresse; seit PLT-03 steht die Suche auch darin.
  await expect(page).toHaveURL(before);
  expect(before).toBe('http://localhost:5174/lieferanten?suche=Silesia');
  await expect(search).toHaveValue('Silesia');
  await expect(notice).toHaveCount(0);
});

test('Nach dem Abmelden liegt kein Token mehr im Browser, die Startseite zeigt „Anmelden“, und Zitadel fragt erneut', async ({
  page,
}) => {
  const zitadel = await fakeZitadel(page);
  await fakeApi(page);
  await page.goto('/profil');
  await expect(page.locator('#inhalt h1')).toBeVisible();

  const endSession = page.waitForRequest(`${issuer}/oidc/v1/end_session?**`);
  await page.getByRole('button', { name: 'Abmelden' }).click();

  // Die Sitzung endet auch bei Zitadel.
  const logout = new URL((await endSession).url()).searchParams;
  expect(logout.get('post_logout_redirect_uri')).toBe('http://localhost:5174');
  expect(logout.get('id_token_hint')).toBe(zitadel.idTokens.at(-1));

  // Zurück in der App: Startseite mit „Anmelden“, kein Token mehr im Browser.
  await expect(page.getByRole('button', { name: 'Anmelden' })).toBeVisible();
  await expect(page.locator('#inhalt')).toHaveCount(0);
  const stored = await storedEverywhere(page);
  expect(stored).not.toContain('access-token');
  expect(stored).not.toContain('refresh-token');
  expect(stored).not.toContain('oidc.user');

  // Die nächste Anmeldung fragt Zitadel wieder nach den Zugangsdaten.
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await expect(page.getByText('Zitadel-Login')).toBeVisible();
  expect(zitadel.authorizeRequests).toHaveLength(2);
});
