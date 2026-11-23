import { randomUUID } from 'node:crypto';
import { type Database, schema, sql, withTenant } from '@reziproq/db';
import { meResponseSchema } from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp } from '../../testing/test-app.js';

// UX-20: Modul-Schalter org_module. Ohne Zeile gilt der Standard (Claims, Risiko, Vertrag aus),
// jede Organisation liest nur ihre eigenen Zeilen, die App darf nicht umschalten.
describe('UX-20 Module je Organisation', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const run = randomUUID().slice(0, 8);
  const orgs = { a: randomUUID(), b: randomUUID() };
  const users = { a: `ux20-a-${run}`, b: `ux20-b-${run}` };

  const me = async (user: string) => {
    const org = user === users.a ? 'a' : 'b';
    testApp.zitadel.replyUserinfo(() => ({
      status: 200,
      body: {
        sub: user,
        name: 'Test Person',
        given_name: 'Test',
        email: `${user}@example.com`,
        'urn:zitadel:iam:user:resourceowner:id': `ux20-${org}-${run}`,
      },
    }));
    const token = await testApp.signToken({
      subject: user,
      claims: { 'urn:zitadel:iam:org:project:test-project:roles': { admin: { '1': 'test' } } },
    });
    const res = await testApp.get('/api/me', token);
    return meResponseSchema.parse(await res.json());
  };

  beforeAll(async () => {
    testApp = await startTestApp();
    db = testApp.adminDb;
    await db.insert(schema.organization).values([
      { id: orgs.a, name: `UX20-A ${run}`, zitadelOrgId: `ux20-a-${run}` },
      { id: orgs.b, name: `UX20-B ${run}`, zitadelOrgId: `ux20-b-${run}` },
    ]);
    await db.insert(schema.organizationFeature).values([
      { organizationId: orgs.a, feature: 'buyer' },
      { organizationId: orgs.b, feature: 'buyer' },
    ]);
    await db.insert(schema.appUser).values(
      (['a', 'b'] as const).map((key) => ({
        id: users[key],
        name: 'Test Person',
        email: `${users[key]}@example.com`,
        organizationId: orgs[key],
        orgRole: 'admin' as const,
        rolesImportedAt: new Date(),
      })),
    );
    // Organisation B hat Claims eingeschaltet und den Wertpotenzial-Finder aus
    await db.insert(schema.orgModule).values([
      { orgId: orgs.b, module: 'claims', enabled: true },
      { orgId: orgs.b, module: 'value_finder', enabled: false },
    ]);
  });

  afterAll(async () => {
    const orgIds = Object.values(orgs);
    await db.execute(sql`delete from org_module where org_id in ${orgIds}`);
    await db.execute(sql`delete from app_user where organization_id in ${orgIds}`);
    await db.execute(sql`delete from organization_feature where organization_id in ${orgIds}`);
    await db.execute(sql`delete from organization where id in ${orgIds}`);
    await testApp.close();
  });

  it('ohne Zeile sind Claims, Risiko und Vertrag aus, Wertpotenziale und Strategie an', async () => {
    const result = await me(users.a);
    expect(result.organization?.id).toBe(orgs.a);
    expect(result.modules).toEqual({
      claims: false,
      risk: false,
      contract: false,
      value_finder: true,
      category_strategy: true,
    });
  });

  it('gespeicherte Zeilen überschreiben den Standard nur für die eigene Organisation', async () => {
    expect((await me(users.b)).modules).toMatchObject({ claims: true, value_finder: false });
    expect((await me(users.a)).modules).toMatchObject({ claims: false, value_finder: true });
  });

  it('die App liest nur die eigene Organisation und schaltet nichts um', async () => {
    const own = await withTenant(db, { userId: users.a, organizationId: orgs.a }, (tx) =>
      tx.execute(sql`select org_id from org_module`),
    );
    expect(own.rows).toEqual([]);
    await expect(
      withTenant(db, { userId: users.a, organizationId: orgs.a }, (tx) =>
        tx.execute(
          sql`insert into org_module (org_id, module, enabled) values (${orgs.a}, 'claims', true)`,
        ),
      ),
    ).rejects.toThrow();
  });
});
