import { randomUUID } from 'node:crypto';
import { type Database, schema, sql } from '@reziproq/db';
import {
  demoPersonsSchema,
  demoSessionSchema,
  meResponseSchema,
  supportHeader,
} from '@reziproq/shared';
import { SignJWT } from 'jose';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { env } from '../../config/env.js';
import { startTestApp } from '../../testing/test-app.js';

// DM-01, E-K0-05 (K1-b.2): Demo-Sitzung je Person ohne Zitadel. Nur mit DEMO_SESSIONS=true (nie im
// Betrieb, siehe env.test.ts), nur für Personen eines Demo-Mandanten; sonst gibt es die Adressen
// nicht, und ein Demo-Token gilt nicht.
describe('DM-01 Demo-Sitzung je Person', () => {
  let app: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const run = randomUUID().slice(0, 8);
  const orgs = { nordwind: randomUUID(), rheintal: randomUUID(), kunde: randomUUID() };
  const users = {
    janLuka: `dm01s-jl-${run}`,
    kim: `dm01s-kim-${run}`,
    kunde: `dm01s-kunde-${run}`,
  };
  const flag = (value: 'true' | 'false') => {
    (env as { DEMO_SESSIONS: string }).DEMO_SESSIONS = value;
  };
  async function request(
    method: string,
    path: string,
    options: { token?: string; body?: unknown; headers?: Record<string, string> } = {},
  ) {
    const response = await fetch(`${app.baseUrl}/api${path}`, {
      method,
      headers: {
        ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
        ...(options.body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...options.headers,
      },
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    });
    return { status: response.status, body: (await response.json().catch(() => null)) as unknown };
  }
  const startFor = async (userId: string) => request('POST', '/demo/sitzung', { body: { userId } });

  beforeAll(async () => {
    app = await startTestApp();
    db = app.adminDb;
    await db.insert(schema.organization).values([
      { id: orgs.nordwind, name: `Nordwind Antriebe ${run}`, isDemo: true },
      { id: orgs.rheintal, name: `Rheintal Elektronik ${run}`, isDemo: true },
      { id: orgs.kunde, name: `Echter Kunde ${run}` },
    ]);
    await db.insert(schema.organizationFeature).values([
      { organizationId: orgs.nordwind, feature: 'buyer' },
      { organizationId: orgs.kunde, feature: 'buyer' },
    ]);
    const person = (id: string, org: string, orgRole: 'admin' | 'member') => ({
      id,
      name: id,
      email: `${id}@example.com`,
      organizationId: org,
      orgRole,
      rolesImportedAt: new Date(),
    });
    await db
      .insert(schema.appUser)
      .values([
        person(users.janLuka, orgs.nordwind, 'member'),
        person(users.kim, orgs.rheintal, 'admin'),
        person(users.kunde, orgs.kunde, 'admin'),
      ]);
  });

  afterEach(() => flag('false'));

  afterAll(async () => {
    flag('false');
    const ids = Object.values(orgs);
    await db.execute(sql`delete from app_user where organization_id in ${ids}`);
    await db.execute(sql`delete from organization_feature where organization_id in ${ids}`);
    await db.execute(sql`delete from organization where id in ${ids}`);
    await app.close();
  });

  it('ohne Schalter gibt es die Adressen nicht', async () => {
    flag('false');
    expect((await request('GET', '/demo/personen')).status).toBe(404);
    expect((await startFor(users.janLuka)).status).toBe(404);
  });

  it('mit Schalter: nur Personen der Demo-Mandanten, Käufer und Lieferant', async () => {
    flag('true');
    const listed = demoPersonsSchema.parse((await request('GET', '/demo/personen')).body);
    const mine = listed.persons.filter((entry) => entry.id.endsWith(run));
    expect(mine.map((entry) => entry.id).sort()).toEqual([users.janLuka, users.kim].sort());
    expect(mine.find((entry) => entry.id === users.janLuka)).toMatchObject({ buyer: true });
    expect(mine.find((entry) => entry.id === users.kim)).toMatchObject({ buyer: false });
    expect(listed.persons.some((entry) => entry.id === users.kunde)).toBe(false);
  });

  it('eine Demo-Person meldet sich ohne Zitadel an; eine Person eines echten Kunden nicht', async () => {
    flag('true');
    const started = await startFor(users.janLuka);
    expect(started.status).toBe(200);
    const session = demoSessionSchema.parse(started.body);
    const me = await request('GET', '/me', { token: session.accessToken });
    expect(me.status).toBe(200);
    expect(meResponseSchema.parse(me.body).organization?.id).toBe(orgs.nordwind);
    expect((await startFor(users.kunde)).status).toBe(404);
    expect((await startFor('unbekannt')).status).toBe(404);
  });

  it('ein Demo-Token gilt nicht ohne Schalter, nicht gefälscht, nicht nach Ende des Demo-Mandanten und nie für den Betreiber-Zugang', async () => {
    flag('true');
    const session = demoSessionSchema.parse((await startFor(users.janLuka)).body);
    // Ohne Schalter
    flag('false');
    expect((await request('GET', '/me', { token: session.accessToken })).status).toBe(401);
    flag('true');
    // Mit anderem Schlüssel signiert: die Person eines echten Kunden lässt sich nicht vortäuschen
    const forged = await new SignJWT({ demo: true })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(users.kunde)
      .setIssuer('reziproq-demo')
      .setAudience('reziproq-demo')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode('ein-anderer-schluessel-mit-genug-laenge'));
    expect((await request('GET', '/me', { token: forged })).status).toBe(401);
    // Betreiber-Zugang mit Demo-Token: nie
    expect(
      (
        await request('GET', '/me', {
          token: session.accessToken,
          headers: { [supportHeader]: orgs.kunde },
        })
      ).status,
    ).toBe(403);
    // Ist der Mandant kein Demo-Mandant mehr, gilt das Token nicht mehr
    await db.execute(sql`update organization set is_demo = false where id = ${orgs.nordwind}`);
    try {
      expect((await request('GET', '/me', { token: session.accessToken })).status).toBe(401);
    } finally {
      await db.execute(sql`update organization set is_demo = true where id = ${orgs.nordwind}`);
    }
  });
});
