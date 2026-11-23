import { randomUUID } from 'node:crypto';
import { type Database, schema, sql } from '@reziproq/db';
import { ssoHintSchema, ssoOverviewSchema, startSchema } from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp } from '../../testing/test-app.js';
import { type FakeSsoProvisioner, SSO_PROVISIONER } from './sso-provisioner.js';

// Tests zu docs/specs/IN-02.md mit dem Anbieter fake (über Zitadel, Entscheidung F10): Anlegen
// mit Standardrolle aus bestätigter Domain, falscher Mandant, falsches hd, unbestätigte Domain,
// Passwort aus, eine Person trotz geänderter Mail, Lieferant weiter über Einladung; Freigabe.
describe('IN-02 Anmeldung über Microsoft und Google', () => {
  const run = randomUUID().slice(0, 8);
  const orgs = { a: randomUUID(), supplier: randomUUID() };
  const zitadel = { a: `zit-a-${run}`, supplier: `zit-s-${run}` };
  const domain = `firma-${run}.example`;
  const users = { admin: `in02-adm-${run}`, member: `in02-mem-${run}` };
  let app: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  let fake: FakeSsoProvisioner;
  const replies = new Map<string, Record<string, unknown>>();

  async function call(user: string, method: string, path: string, body?: unknown) {
    const token = await app.signToken({ subject: user });
    const response = await fetch(`${app.baseUrl}/api${path}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: (await response.json().catch(() => null)) as unknown };
  }
  /** Anmeldung, wie die App sie nach Zitadel meldet; Userinfo liefert, was Zitadel liefern würde */
  async function login(subject: string, info: Record<string, unknown>) {
    const token = await app.signToken({ subject });
    replies.set(token, { sub: subject, name: 'Neue Person', ...info });
    const response = await fetch(`${app.baseUrl}/api/me/anmeldung`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ browserLocale: 'de' }),
    });
    return {
      status: response.status,
      body: (await response.json().catch(() => null)) as unknown,
      token,
    };
  }
  const entra = (subject: string, tenant = 'tenant-a') => ({
    provider: 'entra',
    subject,
    tenant,
  });
  const stored = async (id: string) =>
    (
      await db.execute<{
        org_role: string;
        approval_pending: boolean;
        organization_id: string;
        email: string;
      }>(
        sql`select org_role, approval_pending, organization_id, email from app_user where id = ${id}`,
      )
    ).rows[0];
  const save = (provider: string, body: Record<string, unknown>) =>
    call(users.admin, 'PUT', `/einstellungen/anbindungen/anmeldung/${provider}`, body);

  beforeAll(async () => {
    app = await startTestApp();
    db = app.adminDb;
    fake = app.app.get(SSO_PROVISIONER);
    app.zitadel.replyUserinfo((token) => {
      const body = replies.get(token);
      return body ? { status: 200, body } : { status: 401 };
    });
    await db.insert(schema.organization).values([
      { id: orgs.a, name: `IN02 OEM ${run}`, zitadelOrgId: zitadel.a },
      { id: orgs.supplier, name: `IN02 Lieferant ${run}`, zitadelOrgId: zitadel.supplier },
    ]);
    await db
      .insert(schema.organizationFeature)
      .values({ organizationId: orgs.a, feature: 'buyer' });
    await db.insert(schema.appUser).values([
      {
        id: users.admin,
        name: 'Admin',
        email: `admin@${domain}`,
        organizationId: orgs.a,
        orgRole: 'admin',
        rolesImportedAt: new Date(),
      },
      {
        id: users.member,
        name: 'Mitglied',
        email: `mitglied@${domain}`,
        organizationId: orgs.a,
        orgRole: 'member',
        rolesImportedAt: new Date(),
      },
    ]);
  });

  afterAll(async () => {
    await db.execute(sql`delete from audit_event where org_id = ${orgs.a}`).catch(() => undefined);
    await db.execute(sql`delete from app_user where organization_id in ${[orgs.a, orgs.supplier]}`);
    await db.execute(sql`delete from app_user where id like ${`in02-%-${run}`}`);
    await db.execute(sql`delete from org_sso where org_id = ${orgs.a}`);
    await db.execute(sql`delete from organization where id in ${[orgs.a, orgs.supplier]}`);
    await app.close();
  });

  it('Einrichten: Domain mit DNS-Eintrag, aktiv erst nach Bestätigung; nur Admins', async () => {
    expect((await call(users.member, 'GET', '/einstellungen/anbindungen/anmeldung')).status).toBe(
      403,
    );
    const saved = ssoOverviewSchema.parse(
      (
        await save('entra', {
          tenantId: 'tenant-a',
          domains: [domain],
          defaultRole: 'member',
          passwordLoginAllowed: true,
        })
      ).body,
    );
    expect(saved.entra).toMatchObject({
      status: 'draft',
      domains: [{ domain, recordName: `_zitadel-challenge.${domain}`, verifiedAt: null }],
    });
    const verified = ssoOverviewSchema.parse(
      (
        await call(
          users.admin,
          'POST',
          `/einstellungen/anbindungen/anmeldung/entra/domains/${domain}/bestaetigen`,
        )
      ).body,
    );
    expect(verified.entra?.status).toBe('active');
    expect(fake.configured.at(-1)).toMatchObject({ provider: 'entra', tenantId: 'tenant-a' });
    // Google für dieselbe Domain
    await save('google', { hostedDomain: domain, domains: [domain], defaultRole: 'viewer' });
    await call(
      users.admin,
      'POST',
      `/einstellungen/anbindungen/anmeldung/google/domains/${domain}/bestaetigen`,
    );
    const hint = ssoHintSchema.parse(
      await (
        await fetch(`${app.baseUrl}/api/anmeldung/sso`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email: `jemand@${domain}` }),
        })
      ).json(),
    );
    expect(hint.provider).not.toBeNull();
    expect(hint.scope).toMatch(/^urn:zitadel:iam:org:idp:id:fake-idp-/);
  });

  it('mit Anbieter fake meldet sich eine Person aus einer bestätigten Domain an und wird mit der Standardrolle angelegt', async () => {
    const id = `in02-neu-${run}`;
    const first = await login(id, {
      email: `anna@${domain}`,
      'urn:zitadel:iam:user:resourceowner:id': zitadel.a,
      'urn:reziproq:idp': entra(`oid-anna-${run}`),
    });
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({
      pendingApproval: true,
      orgRole: null,
      permissions: { viewBuyerAreas: false, viewSuppliers: false },
    });
    expect(await stored(id)).toMatchObject({
      org_role: 'member',
      approval_pending: true,
      organization_id: orgs.a,
    });
    // Bis zur Freigabe sieht sie nichts
    const suppliers = await fetch(`${app.baseUrl}/api/suppliers`, {
      headers: { authorization: `Bearer ${first.token}` },
    });
    expect(suppliers.status).toBe(403);
    // Der Admin bekommt die Aufgabe „Neue Person prüfen“ und gibt frei
    const start = startSchema.parse((await call(users.admin, 'GET', '/start')).body);
    expect(start.due.items).toContainEqual(
      expect.objectContaining({ kind: 'member_review', detail: 'Neue Person' }),
    );
    expect(
      (await call(users.member, 'POST', `/organisation/mitglieder/${id}/freigeben`)).status,
    ).toBe(403);
    const approved = await call(users.admin, 'POST', `/organisation/mitglieder/${id}/freigeben`);
    expect(approved.body).toMatchObject({ approvalPending: false, orgRole: 'member' });
    const after = await fetch(`${app.baseUrl}/api/suppliers`, {
      headers: { authorization: `Bearer ${first.token}` },
    });
    expect(after.status).toBe(200);
  });

  it('eine Person aus einem anderen Entra-Mandanten wird abgelehnt, auch mit passender Mail', async () => {
    const id = `in02-fremd-${run}`;
    const response = await login(id, {
      email: `fremd@${domain}`,
      'urn:zitadel:iam:user:resourceowner:id': zitadel.a,
      'urn:reziproq:idp': entra(`oid-fremd-${run}`, 'tenant-anders'),
    });
    expect(response).toMatchObject({ status: 403, body: { code: 'falscher_mandant' } });
    expect(await stored(id)).toBeUndefined();
  });

  it('ein Google-Konto ohne passenden hd-Claim wird abgelehnt', async () => {
    const id = `in02-gmail-${run}`;
    const response = await login(id, {
      email: `privat@${domain}`,
      'urn:zitadel:iam:user:resourceowner:id': zitadel.a,
      'urn:reziproq:idp': { provider: 'google', subject: `g-${run}` },
    });
    expect(response).toMatchObject({ status: 403, body: { code: 'falsche_domain' } });
    expect(await stored(id)).toBeUndefined();
  });

  it('eine unbestätigte Domain legt keine Person an', async () => {
    const other = `neu-${run}.example`;
    fake.failing.add(other);
    await save('entra', {
      tenantId: 'tenant-a',
      domains: [domain, other],
      defaultRole: 'member',
      passwordLoginAllowed: true,
    });
    await call(
      users.admin,
      'POST',
      `/einstellungen/anbindungen/anmeldung/entra/domains/${other}/bestaetigen`,
    );
    const id = `in02-unbest-${run}`;
    const response = await login(id, {
      email: `bert@${other}`,
      'urn:zitadel:iam:user:resourceowner:id': zitadel.a,
      'urn:reziproq:idp': entra(`oid-bert-${run}`),
    });
    expect(response).toMatchObject({ status: 403, body: { code: 'domain_nicht_bestaetigt' } });
    expect(await stored(id)).toBeUndefined();
  });

  it('ist die Anmeldung mit Passwort aus, scheitert sie für Mails der Domain', async () => {
    await save('entra', {
      tenantId: 'tenant-a',
      domains: [domain],
      defaultRole: 'member',
      passwordLoginAllowed: false,
    });
    expect(fake.configured.at(-1)).toMatchObject({ passwordLoginAllowed: false });
    const response = await login(`in02-pw-${run}`, {
      email: `passwort@${domain}`,
      'urn:zitadel:iam:user:resourceowner:id': zitadel.a,
    });
    expect(response).toMatchObject({ status: 403, body: { code: 'nur_sso', provider: 'entra' } });
    // Über Microsoft geht es weiter
    const sso = await login(`in02-pw-sso-${run}`, {
      email: `passwort@${domain}`,
      'urn:zitadel:iam:user:resourceowner:id': zitadel.a,
      'urn:reziproq:idp': entra(`oid-pw-${run}`),
    });
    expect(sso.status).toBe(200);
  });

  it('zwei Anmeldungen derselben Person ergeben eine Person, auch wenn sich ihre Mail geändert hat', async () => {
    const id = `in02-zwei-${run}`;
    const subject = `oid-zwei-${run}`;
    const base = {
      'urn:zitadel:iam:user:resourceowner:id': zitadel.a,
      'urn:reziproq:idp': entra(subject),
    };
    expect((await login(id, { ...base, email: `carla@${domain}` })).status).toBe(200);
    expect((await login(id, { ...base, email: `carla.neu@${domain}` })).status).toBe(200);
    const people = await db.execute(sql`select id from app_user where id = ${id}`);
    expect(people.rows).toHaveLength(1);
    const identities = await db.execute<{ user_id: string; email: string }>(
      sql`select user_id, email from user_identity where provider = 'entra' and subject = ${subject}`,
    );
    expect(identities.rows).toEqual([{ user_id: id, email: `carla.neu@${domain}` }]);
    expect((await stored(id))?.email).toBe(`carla.neu@${domain}`);
    // Dieselbe Identität für ein anderes Konto: abgelehnt
    const takeover = await login(`in02-dritte-${run}`, { ...base, email: `carla@${domain}` });
    expect(takeover).toMatchObject({ status: 403, body: { code: 'identitaet_vergeben' } });
  });

  it('der Test-Lieferant meldet sich weiter über seine Einladung an', async () => {
    const id = `in02-lief-${run}`;
    const response = await login(id, {
      email: `kam@lieferant-${run}.example`,
      'urn:zitadel:iam:user:resourceowner:id': zitadel.supplier,
    });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ pendingApproval: false });
    expect(await stored(id)).toMatchObject({
      organization_id: orgs.supplier,
      approval_pending: false,
    });
  });
});
