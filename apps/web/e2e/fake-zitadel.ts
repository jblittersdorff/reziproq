import type { Page } from '@playwright/test';

// Nachgebautes Zitadel für die Browser-Tests. Seit PLT-01 liegen Tokens nur im Speicher; jeder
// Seitenaufruf meldet sich deshalb über den echten Ablauf an: Weiterleitung zu authorize, zurück
// mit Code, Tausch gegen Tokens. Dieses Zitadel leitet sofort zurück, als wäre die Sitzung aktiv.

export const issuer = 'https://zitadel.test';
const cors = { 'access-control-allow-origin': '*' };

/** Base64url ohne Polsterung, wie in JWTs. */
const b64url = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');

export function idTokenFor(sub = 'user-1') {
  const now = Math.floor(Date.now() / 1000);
  return `${b64url({ alg: 'none' })}.${b64url({ iss: issuer, aud: 'web-client', sub, iat: now, exp: now + 3600 })}.`;
}

export interface TokenRequest {
  grantType: string | null;
  refreshToken: string | null;
  codeVerifier: string | null;
}

export interface FakeZitadel {
  /** Alle Aufrufe des Token-Endpunkts, z. B. um die Erneuerung zu prüfen. */
  tokenRequests: TokenRequest[];
  /** Alle ausgegebenen ID Tokens, das neueste zuletzt. */
  idTokens: string[];
  /** Alle Aufrufe von authorize mit ihren Parametern. */
  authorizeRequests: URLSearchParams[];
  /** Wie der Token-Endpunkt antwortet; jeder Test kann das ändern. */
  reply: {
    /** Gültigkeit des Access Tokens in Sekunden */
    expiresIn: number;
    /** false: Zitadel lehnt den Refresh Token ab (Erneuerung scheitert). */
    refreshWorks: boolean;
  };
  /** Sitzung bei Zitadel: Ist sie aktiv, leitet authorize sofort zurück, sonst fragt es nach
   *  den Zugangsdaten. Abmelden über end_session beendet sie. */
  session: { active: boolean };
}

/**
 * Spielt Discovery, authorize, token und end_session nach. Jede Anmeldung bekommt das Access
 * Token access-token-1, jede Erneuerung ein neues: access-token-erneuert-1, -2 …
 */
export async function fakeZitadel(page: Page): Promise<FakeZitadel> {
  const fake: FakeZitadel = {
    tokenRequests: [],
    idTokens: [],
    authorizeRequests: [],
    reply: { expiresIn: 3600, refreshWorks: true },
    session: { active: true },
  };
  // Für den ganzen Browser-Kontext, damit auch das Fenster zum Neu-Anmelden (Popup) hier landet.
  const context = page.context();
  let renewed = 0;

  await context.route(`${issuer}/.well-known/openid-configuration`, (route) =>
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

  await context.route(`${issuer}/oauth/v2/authorize?**`, (route) => {
    const params = new URL(route.request().url()).searchParams;
    fake.authorizeRequests.push(params);
    if (!fake.session.active) return route.fulfill({ body: 'Zitadel-Login' });
    const back = new URL(params.get('redirect_uri') ?? '');
    back.searchParams.set('code', `code-${fake.authorizeRequests.length}`);
    back.searchParams.set('state', params.get('state') ?? '');
    return route.fulfill({ status: 302, headers: { location: back.toString() } });
  });

  await context.route(`${issuer}/oauth/v2/token`, (route) => {
    const body = new URLSearchParams(route.request().postData() ?? '');
    const request = {
      grantType: body.get('grant_type'),
      refreshToken: body.get('refresh_token'),
      codeVerifier: body.get('code_verifier'),
    };
    fake.tokenRequests.push(request);
    if (request.grantType === 'refresh_token' && !fake.reply.refreshWorks) {
      return route.fulfill({ status: 400, headers: cors, json: { error: 'invalid_grant' } });
    }
    const isRenewal = request.grantType === 'refresh_token';
    if (isRenewal) renewed += 1;
    const idToken = idTokenFor();
    fake.idTokens.push(idToken);
    return route.fulfill({
      headers: cors,
      json: {
        access_token: isRenewal ? `access-token-erneuert-${renewed}` : 'access-token-1',
        refresh_token: `refresh-token-${renewed}`,
        id_token: idToken,
        token_type: 'Bearer',
        expires_in: fake.reply.expiresIn,
      },
    });
  });

  await context.route(`${issuer}/oidc/v1/end_session?**`, (route) => {
    fake.session.active = false;
    const back = new URL(route.request().url()).searchParams.get('post_logout_redirect_uri');
    return back
      ? route.fulfill({ status: 302, headers: { location: back } })
      : route.fulfill({ body: 'Abgemeldet' });
  });

  // Die App meldet jede Anmeldung der API (PLT-01); die Tests brauchen die Antwort nicht.
  await context.route('**/api/me/anmeldung', (route) => route.fulfill({ json: {} }));

  return fake;
}
