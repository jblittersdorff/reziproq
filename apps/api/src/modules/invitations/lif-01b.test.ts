import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { HttpException, Logger } from '@nestjs/common';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeIdentityProvisioner, UnavailableIdentityProvisioner } from './identity-provisioner.js';
import { identityProvisionerFor } from './invitations.module.js';
import { splitName, ZitadelIdentityProvisioner } from './zitadel-provisioner.js';

// Tests zu docs/specs/LIF-01.md, Teil b: Organisation und Person über die Zitadel-
// Verwaltungsschnittstelle. Zitadel ist ein lokaler HTTP-Server; kein Test braucht Internet.

interface Seen {
  method: string;
  path: string;
  authorization: string | undefined;
  body: unknown;
}

const token = 'pat-test-0123456789abcdefghij';
let server: Server;
let issuer: string;
let seen: Seen[];
/** Antworten je Pfad; eine Funktion darf je nach Aufruf anders antworten. */
let routes: Record<string, (body: unknown, call: number) => { status: number; json?: unknown }>;

async function readBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);
  const text = Buffer.concat(chunks).toString('utf8');
  return text ? JSON.parse(text) : undefined;
}

beforeAll(async () => {
  server = createServer(async (request, response) => {
    const path = request.url ?? '';
    const body = await readBody(request);
    seen.push({
      method: request.method ?? '',
      path,
      authorization: request.headers.authorization,
      body,
    });
    const route = routes[path];
    const calls = seen.filter((entry) => entry.path === path).length;
    const answer = route ? route(body, calls) : { status: 404, json: { message: 'unbekannt' } };
    response.writeHead(answer.status, { 'content-type': 'application/json' });
    response.end(JSON.stringify(answer.json ?? {}));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  issuer = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

beforeEach(() => {
  seen = [];
  routes = {};
  vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
});

afterEach(() => vi.restoreAllMocks());

const provisioner = () => new ZitadelIdentityProvisioner(issuer, token, 2_000);

describe('LIF-01b Organisation in Zitadel', () => {
  it('die erste Annahme legt die Zitadel-Organisation mit dem Namen des Lieferanten an', async () => {
    routes['/v2/organizations'] = () => ({ status: 200, json: { organizationId: 'org-zit-1' } });
    const id = await provisioner().ensureOrganization({
      supplierOrgId: '0196aaaa-0000-7000-8000-000000000001',
      name: 'Rheintal Elektronik GmbH',
      existingId: null,
    });
    expect(id).toBe('org-zit-1');
    expect(seen).toEqual([
      {
        method: 'POST',
        path: '/v2/organizations',
        authorization: `Bearer ${token}`,
        body: { name: 'Rheintal Elektronik GmbH' },
      },
    ]);
  });

  it('eine schon verknüpfte Organisation wird nicht neu angelegt', async () => {
    const id = await provisioner().ensureOrganization({
      supplierOrgId: '0196aaaa-0000-7000-8000-000000000001',
      name: 'Rheintal Elektronik GmbH',
      existingId: 'org-zit-vorhanden',
    });
    expect(id).toBe('org-zit-vorhanden');
    expect(seen).toEqual([]);
  });

  it('gibt es den Namen in Zitadel schon, hängt sie die eigene ID an', async () => {
    routes['/v2/organizations'] = (_body, call) =>
      call === 1 ? { status: 409 } : { status: 200, json: { organizationId: 'org-zit-2' } };
    const id = await provisioner().ensureOrganization({
      supplierOrgId: '0196bbbb-0000-7000-8000-000000000001',
      name: 'Müller GmbH',
      existingId: null,
    });
    expect(id).toBe('org-zit-2');
    expect(seen.map((entry) => entry.body)).toEqual([
      { name: 'Müller GmbH' },
      { name: 'Müller GmbH (0196bbbb)' },
    ]);
  });
});

describe('LIF-01b Person und Passkey in Zitadel', () => {
  const registrationLink = '/v2/users/user-zit-1/passkeys/registration_link';

  it('legt die Person mit bestätigter E-Mail an und führt zur Passkey-Seite des Logins', async () => {
    routes['/v2/users'] = () => ({ status: 200, json: { result: [] } });
    routes['/v2/users/human'] = () => ({ status: 200, json: { userId: 'user-zit-1' } });
    routes[registrationLink] = () => ({
      status: 200,
      json: { code: { id: 'code-id-1', code: 'Ab&12' } },
    });
    const result = await provisioner().createUser({
      zitadelOrgId: 'org-zit-1',
      email: 'kim@rheintal.example',
      name: 'Kim Kaiser',
    });
    expect(seen.map((entry) => entry.path)).toEqual([
      '/v2/users',
      '/v2/users/human',
      registrationLink,
    ]);
    expect(seen[0]?.body).toEqual({
      queries: [
        {
          emailQuery: {
            emailAddress: 'kim@rheintal.example',
            method: 'TEXT_QUERY_METHOD_EQUALS_IGNORE_CASE',
          },
        },
        { organizationIdQuery: { organizationId: 'org-zit-1' } },
      ],
    });
    expect(seen[1]?.body).toEqual({
      organization: { orgId: 'org-zit-1' },
      profile: { givenName: 'Kim', familyName: 'Kaiser' },
      email: { email: 'kim@rheintal.example', isVerified: true },
    });
    expect(seen[2]?.body).toEqual({ returnCode: {} });
    expect(result.userId).toBe('user-zit-1');
    const url = new URL(result.passkeySetupUrl);
    expect(`${url.origin}${url.pathname}`).toBe(`${issuer}/ui/login/login/passwordless/init`);
    expect(Object.fromEntries(url.searchParams)).toEqual({
      userID: 'user-zit-1',
      orgID: 'org-zit-1',
      codeID: 'code-id-1',
      code: 'Ab&12',
    });
    expect(seen.every((entry) => entry.authorization === `Bearer ${token}`)).toBe(true);
  });

  it('eine Person mit Passkey (z. B. vom ersten Kunden) meldet sich einfach an', async () => {
    routes['/v2/users'] = () => ({ status: 200, json: { result: [{ userId: 'user-zit-1' }] } });
    routes['/v2/users/user-zit-1/passkeys/_search'] = () => ({
      status: 200,
      json: { result: [{ id: 'passkey-1' }] },
    });
    const result = await provisioner().createUser({
      zitadelOrgId: 'org-zit-1',
      email: 'kim@rheintal.example',
      name: 'Kim Kaiser',
    });
    expect(result).toEqual({ userId: 'user-zit-1', passkeySetupUrl: '/start' });
    expect(seen.some((entry) => entry.path === '/v2/users/human')).toBe(false);
  });

  it('eine angelegte Person ohne Passkey bekommt einen neuen Code statt eines zweiten Kontos', async () => {
    routes['/v2/users'] = () => ({ status: 200, json: { result: [{ userId: 'user-zit-1' }] } });
    routes['/v2/users/user-zit-1/passkeys/_search'] = () => ({ status: 200, json: {} });
    routes[registrationLink] = () => ({ status: 200, json: { code: { id: 'c2', code: 'x' } } });
    const result = await provisioner().createUser({
      zitadelOrgId: 'org-zit-1',
      email: 'kim@rheintal.example',
      name: 'Kim Kaiser',
    });
    expect(result.passkeySetupUrl).toContain('codeID=c2');
    expect(seen.some((entry) => entry.path === '/v2/users/human')).toBe(false);
  });

  it('ein Fehler von Zitadel wird zu 502, ohne Token oder Details in der Antwort', async () => {
    routes['/v2/users'] = () => ({ status: 500, json: { message: 'intern' } });
    const error = await provisioner()
      .createUser({ zitadelOrgId: 'org-zit-1', email: 'kim@rheintal.example', name: 'Kim' })
      .catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(HttpException);
    expect((error as HttpException).getStatus()).toBe(502);
    expect(JSON.stringify((error as HttpException).getResponse())).not.toContain(token);
    expect((error as HttpException).getResponse()).toMatchObject({
      code: 'identity_provider_failed',
    });
  });

  it('eine unerwartete Antwort von Zitadel wird ebenfalls zu 502', async () => {
    routes['/v2/organizations'] = () => ({ status: 200, json: { anders: true } });
    const error = await provisioner()
      .ensureOrganization({ supplierOrgId: 'x', name: 'Neu', existingId: null })
      .catch((caught: unknown) => caught);
    expect((error as HttpException).getStatus()).toBe(502);
  });

  it('Vor- und Nachname: ein einzelnes Wort gilt für beide', () => {
    expect(splitName('  Kim   von Kaiser ')).toEqual({
      givenName: 'Kim',
      familyName: 'von Kaiser',
    });
    expect(splitName('Kim')).toEqual({ givenName: 'Kim', familyName: 'Kim' });
  });
});

describe('LIF-01b Auswahl des Anbieters', () => {
  const base = {
    ZITADEL_ISSUER: 'https://zitadel.test',
    ZITADEL_SERVICE_TOKEN: undefined,
  };

  it('mit IDENTITY_PROVIDER=zitadel und Token die Verwaltungsschnittstelle', () => {
    expect(
      identityProvisionerFor({
        ...base,
        NODE_ENV: 'production',
        IDENTITY_PROVIDER: 'zitadel',
        ZITADEL_SERVICE_TOKEN: token,
      }),
    ).toBeInstanceOf(ZitadelIdentityProvisioner);
  });

  it('der Nachbau läuft nie im Betrieb; dort ist Annehmen ohne Zitadel aus', () => {
    expect(
      identityProvisionerFor({ ...base, NODE_ENV: 'production', IDENTITY_PROVIDER: 'fake' }),
    ).toBeInstanceOf(UnavailableIdentityProvisioner);
    expect(
      identityProvisionerFor({ ...base, NODE_ENV: 'development', IDENTITY_PROVIDER: 'fake' }),
    ).toBeInstanceOf(FakeIdentityProvisioner);
  });
});
