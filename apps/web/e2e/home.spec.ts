import { expect, type Page, test } from '@playwright/test';

const issuer = 'https://zitadel.test';
const cors = { 'access-control-allow-origin': '*' };

test.use({ locale: 'de-DE' });

/** Base64url ohne Polsterung, wie in JWTs. */
const b64url = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');

/** Spielt die Zitadel-Endpunkte nach, die oidc-client-ts beim Login aufruft. */
async function fakeZitadel(page: Page) {
  await page.route(`${issuer}/.well-known/openid-configuration`, (route) =>
    route.fulfill({
      headers: cors,
      json: {
        issuer,
        authorization_endpoint: `${issuer}/oauth/v2/authorize`,
        token_endpoint: `${issuer}/oauth/v2/token`,
        end_session_endpoint: `${issuer}/oidc/v1/end_session`,
        jwks_uri: `${issuer}/oauth/v2/keys`,
      },
    }),
  );
}

test('Startseite bietet ohne Login nur die Anmeldung an', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Reziproq' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Anmelden' })).toBeVisible();
  await expect(page.getByText('API: ok')).toHaveCount(0);
});

test('Login mit PKCE zeigt danach Name und API-Status', async ({ page }) => {
  await fakeZitadel(page);

  // 1. Weiterleitung zu Zitadel: Authorization Code mit PKCE.
  const authorize = page.waitForRequest(`${issuer}/oauth/v2/authorize?**`);
  await page.route(`${issuer}/oauth/v2/authorize?**`, (route) =>
    route.fulfill({ body: 'Zitadel-Login' }),
  );
  await page.goto('/');
  await page.getByRole('button', { name: 'Anmelden' }).click();
  const params = new URL((await authorize).url()).searchParams;
  await page.waitForURL(`${issuer}/**`);
  expect(params.get('response_type')).toBe('code');
  expect(params.get('client_id')).toBe('web-client');
  expect(params.get('redirect_uri')).toBe('http://localhost:5174/auth/callback');
  expect(params.get('code_challenge_method')).toBe('S256');
  expect(params.get('code_challenge')).toBeTruthy();
  expect(params.get('scope')).toBe('openid profile email');

  // 2. Zitadel tauscht den Code gegen Tokens; der Code-Verifier muss mitkommen.
  const now = Math.floor(Date.now() / 1000);
  const idToken = `${b64url({ alg: 'none' })}.${b64url({
    iss: issuer,
    aud: 'web-client',
    sub: 'user-1',
    iat: now,
    exp: now + 3600,
  })}.`;
  let tokenRequestBody = '';
  await page.route(`${issuer}/oauth/v2/token`, (route) => {
    tokenRequestBody = route.request().postData() ?? '';
    return route.fulfill({
      headers: cors,
      json: {
        access_token: 'access-token-1',
        id_token: idToken,
        token_type: 'Bearer',
        expires_in: 3600,
      },
    });
  });

  // 3. Die API bekommt das Access Token und antwortet.
  await page.route('**/api/me', (route) =>
    route.request().headers().authorization === 'Bearer access-token-1'
      ? route.fulfill({ json: { name: 'Ada Lovelace', email: 'ada@example.com' } })
      : route.fulfill({ status: 401, json: { statusCode: 401 } }),
  );
  await page.route('**/api/health', (route) => route.fulfill({ json: { status: 'ok' } }));

  // Zitadel leitet mit Code und State zurück zur App.
  await page.goto(`/auth/callback?code=code-1&state=${params.get('state')}`, {
    waitUntil: 'commit',
  });

  await expect(page).toHaveURL('http://localhost:5174/');
  await expect(page.getByText('Ada Lovelace')).toBeVisible();
  await expect(page.getByText('ada@example.com')).toBeVisible();
  await expect(page.getByText('API: ok')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Abmelden' })).toBeVisible();
  expect(new URLSearchParams(tokenRequestBody).get('code_verifier')).toBeTruthy();

  // 4. Abmelden beendet die Sitzung bei Zitadel und kehrt zur App zurück.
  const endSession = page.waitForRequest(`${issuer}/oidc/v1/end_session?**`);
  await page.route(`${issuer}/oidc/v1/end_session?**`, (route) =>
    route.fulfill({ body: 'Abgemeldet' }),
  );
  await page.getByRole('button', { name: 'Abmelden' }).click();
  const logout = new URL((await endSession).url()).searchParams;
  expect(logout.get('post_logout_redirect_uri')).toBe('http://localhost:5174');
  expect(logout.get('id_token_hint')).toBe(idToken);
});
