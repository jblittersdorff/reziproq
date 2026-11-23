import { randomUUID } from 'node:crypto';
import { type Database, schema, sql } from '@reziproq/db';
import { myConnectionsSchema } from '@reziproq/shared';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { startTestApp } from '../../testing/test-app.js';
import { ZitadelSsoProvisioner } from '../sso/sso-provisioner.js';
import { IntegrationsService } from './integrations.service.js';
import {
  MicrosoftGraphClient,
  MicrosoftLiveProvider,
  parseMicrosoftToken,
} from './microsoft-provider.js';
import { SecretBox } from './secret-box.js';

// Vorbereitung des Durchstichs (docs/betrieb/durchstich.md): Microsoft und Zitadel echt, hier mit
// nachgebildeten Antworten der beiden Dienste. Geprüft wird, welche Aufrufe Reziproq macht und
// dass Zugangsdaten nur verschlüsselt liegen.

const app365 = {
  clientId: 'client-test',
  clientSecret: 'nur-fuer-tests',
  redirectUri: 'http://localhost:3000/api/anbindungen/oauth/microsoft/callback',
};
const realFetch = globalThis.fetch;

/** Antwortet für Microsoft und Zitadel; alles andere geht an die echte Test-App */
function fakeRemote(handler: (url: string, init: RequestInit) => Response | undefined) {
  const calls: { url: string; init: RequestInit }[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init = {}) => {
    const url = String(input);
    const answer = handler(url, init);
    if (answer) {
      calls.push({ url, init });
      return answer;
    }
    return realFetch(input, init);
  });
  return calls;
}

describe('Durchstich: Microsoft 365 echt', () => {
  afterEach(() => vi.restoreAllMocks());

  it('schickt zur Anmeldung mit delegierten Rechten und tauscht den Code gegen beide Tokens', async () => {
    const provider = new MicrosoftLiveProvider(app365);
    const url = new URL(provider.authorizeUrl('state-1'));
    expect(url.origin + url.pathname).toBe(
      'https://login.microsoftonline.com/organizations/oauth2/v2.0/authorize',
    );
    expect(url.searchParams.get('scope')).toBe(
      'offline_access openid User.Read Calendars.ReadWrite',
    );
    expect(url.searchParams.get('redirect_uri')).toBe(app365.redirectUri);
    const calls = fakeRemote((target) =>
      target.endsWith('/oauth2/v2.0/token')
        ? Response.json({ access_token: 'a-1', refresh_token: 'r-1', expires_in: 3600 })
        : undefined,
    );
    const granted = await provider.exchangeCode('code-1');
    expect(parseMicrosoftToken(granted.token)).toEqual({ access: 'a-1', refresh: 'r-1' });
    const body = new URLSearchParams(String(calls[0]?.init.body));
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('code')).toBe('code-1');
  });

  it('schreibt über Graph nur die Beschreibung des Termins', async () => {
    const provider = new MicrosoftLiveProvider(app365);
    const client = new MicrosoftGraphClient(provider);
    const calls = fakeRemote((target, init) =>
      target.startsWith('https://graph.microsoft.com/') && init.method === 'PATCH'
        ? new Response(null, { status: 200 })
        : undefined,
    );
    await client.updateEventBody(
      JSON.stringify({ access: 'a-1', refresh: 'r-1' }),
      'evt 1',
      '<p>x</p>',
    );
    expect(calls[0]?.url).toBe('https://graph.microsoft.com/v1.0/me/events/evt%201');
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({
      body: { contentType: 'HTML', content: '<p>x</p>' },
    });
    expect(((calls[0]?.init.headers ?? {}) as Record<string, string>).authorization).toBe('Bearer a-1');
  });

  it('signiert den state und lehnt veränderte oder abgelaufene ab', () => {
    const box = new SecretBox('nur-fuer-tests-kein-geheimnis');
    const state = box.sign({ o: 'org', u: 'user' }, 60_000);
    expect(box.verify(state)).toMatchObject({ o: 'org', u: 'user' });
    expect(box.verify(`${state}x`)).toBeNull();
    expect(box.verify(box.sign({ o: 'org' }, -1))).toBeNull();
    expect(new SecretBox('ein-anderer-schluessel-123').verify(state)).toBeNull();
  });
});

describe('Durchstich: Zitadel echt', () => {
  afterEach(() => vi.restoreAllMocks());

  it('legt die Login-Richtlinie an, wenn die Organisation noch keine eigene hat', async () => {
    const provisioner = new ZitadelSsoProvisioner('https://zitadel.test', 'token', {
      entra: { clientId: 'c', clientSecret: 's' },
      google: null,
    });
    const calls = fakeRemote((target, init) => {
      if (!target.startsWith('https://zitadel.test/')) return undefined;
      if (target.endsWith('/policies/login') && init.method === 'PUT') {
        return new Response(null, { status: 404 });
      }
      if (target.endsWith('/idps/azure')) return Response.json({ id: 'idp-1' });
      return Response.json({});
    });
    const idp = await provisioner.configure({
      zitadelOrgId: 'org-1',
      provider: 'entra',
      tenantId: 'tenant-1',
      hostedDomain: null,
      passwordLoginAllowed: false,
      idpRef: null,
    });
    expect(idp).toBe('idp-1');
    expect(
      calls.map((call) => `${call.init.method} ${call.url.replace('https://zitadel.test', '')}`),
    ).toEqual([
      'PUT /management/v1/policies/login',
      'POST /management/v1/policies/login',
      'POST /management/v1/idps/azure',
      'POST /management/v1/policies/login/idps',
    ]);
    expect(JSON.parse(String(calls[2]?.init.body))).toMatchObject({
      tenant: { tenantId: 'tenant-1' },
    });
    expect(((calls[0]?.init.headers ?? {}) as Record<string, string>)['x-zitadel-orgid']).toBe('org-1');
  });

  it('liest den Stand der Domain aus Zitadel, wenn die Bestätigung dort abgeschaltet ist', async () => {
    const provisioner = new ZitadelSsoProvisioner('https://zitadel.test', 'token', {
      entra: null,
      google: null,
    });
    fakeRemote((target) => {
      if (target.endsWith('/_validate')) return new Response(null, { status: 412 });
      if (target.endsWith('/domains/_search')) {
        return Response.json({ result: [{ domainName: 'dev.onmicrosoft.com', isVerified: true }] });
      }
      return undefined;
    });
    expect(
      await provisioner.confirmDomain({ zitadelOrgId: 'org-1', domain: 'dev.onmicrosoft.com' }),
    ).toBe(true);
    expect(
      await provisioner.confirmDomain({ zitadelOrgId: 'org-1', domain: 'fremd.example' }),
    ).toBe(false);
  });
});

describe('Durchstich: eigene Verbindung über die Anmeldung bei Microsoft', () => {
  const run = randomUUID().slice(0, 8);
  const org = randomUUID();
  const user = `durch-${run}`;
  let app: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  let integrations: IntegrationsService;

  beforeAll(async () => {
    app = await startTestApp();
    db = app.adminDb;
    integrations = app.app.get(IntegrationsService);
    await db.insert(schema.organization).values({ id: org, name: `Durchstich ${run}` });
    await db.insert(schema.organizationFeature).values({ organizationId: org, feature: 'buyer' });
    await db.insert(schema.appUser).values({
      id: user,
      name: 'Einkauf',
      email: `${user}@example.com`,
      organizationId: org,
      orgRole: 'member',
      rolesImportedAt: new Date(),
    });
    // Wie mit MICROSOFT_PROVIDER=live
    Object.assign(integrations, { microsoftLive: new MicrosoftLiveProvider(app365) });
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    Object.assign(integrations, { microsoftLive: null });
    await db.execute(sql`delete from connection where org_id = ${org}`);
    await db.execute(sql`delete from app_user where id = ${user}`);
    await db.execute(sql`delete from organization where id = ${org}`);
    await app.close();
  });

  it('Verbinden führt zu Microsoft; die Rückkehr legt die Verbindung mit verschlüsselten Tokens an', async () => {
    const token = await app.signToken({ subject: user });
    const started = await fetch(`${app.baseUrl}/api/profil/verbindungen/microsoft365/verbinden`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
    });
    const body = myConnectionsSchema.parse(await started.json());
    expect(body.connections).toEqual([]);
    const state = new URL(body.redirectUrl ?? '').searchParams.get('state') ?? '';
    expect(state).not.toBe('');
    fakeRemote((target) =>
      target.endsWith('/oauth2/v2.0/token')
        ? Response.json({
            access_token: `access-${run}`,
            refresh_token: `refresh-${run}`,
            expires_in: 60,
          })
        : undefined,
    );
    const back = await fetch(
      `${app.baseUrl}/api/anbindungen/oauth/microsoft/callback?code=c1&state=${encodeURIComponent(state)}`,
      { redirect: 'manual' },
    );
    expect(back.status).toBe(302);
    expect(back.headers.get('location')).toMatch(/\/profil\?verbindung=ok#verbindungen$/);
    const stored = await db.execute<{ ciphertext: string; status: string }>(sql`
      select s.ciphertext, c.status from connection c join connection_secret s on s.connection_id = c.id
      where c.org_id = ${org} and c.user_id = ${user}`);
    expect(stored.rows).toHaveLength(1);
    expect(stored.rows[0]?.status).toBe('active');
    expect(stored.rows[0]?.ciphertext).not.toContain(`access-${run}`);
    // Ein veränderter state legt nichts an
    const forged = await fetch(
      `${app.baseUrl}/api/anbindungen/oauth/microsoft/callback?code=c1&state=${encodeURIComponent(`${state}x`)}`,
      { redirect: 'manual' },
    );
    expect(forged.headers.get('location')).toMatch(/verbindung=fehler/);
  });

  it('erneuert den Zugang vor der Nutzung, wenn er bald abläuft', async () => {
    fakeRemote((target, init) => {
      if (!target.endsWith('/oauth2/v2.0/token')) return undefined;
      expect(new URLSearchParams(String(init.body)).get('refresh_token')).toBe(`refresh-${run}`);
      return Response.json({
        access_token: `neu-${run}`,
        refresh_token: `refresh2-${run}`,
        expires_in: 3600,
      });
    });
    const used = await integrations.withUserToken(org, user, 'microsoft365', async (token) =>
      parseMicrosoftToken(token),
    );
    expect(used).toEqual({ access: `neu-${run}`, refresh: `refresh2-${run}` });
  });
});
