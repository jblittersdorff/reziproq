import { randomUUID } from 'node:crypto';
import { type Database, schema, sql, withTenant } from '@reziproq/db';
import { accountPlanSchema, auditResponseSchema } from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';

// Tests zu docs/specs/LIF-03.md: Der Käufer bekommt auf keinem Endpunkt der eigenen Sicht eine
// Zeile oder eine Anzahl; zwei Lieferanten-Nutzer derselben Organisation sehen dieselbe Sicht;
// nur Admins und Nutzer bearbeiten, Leser lesen.
describe('LIF-03 Eigene Sicht des Lieferanten', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const run = randomUUID().slice(0, 8);
  const orgs = { oem: randomUUID(), supplier: randomUUID() };
  const rel = randomUUID();
  const users = {
    sro: `lif03-sro-${run}`,
    kam: `lif03-kam-${run}`,
    lea: `lif03-lea-${run}`,
    viewer: `lif03-viewer-${run}`,
  };
  const base = `/kunden/${rel}/eigene-sicht`;

  const call = async (user: string, method: string, url: string, body?: unknown) => {
    const response = await fetch(`${testApp.baseUrl}/api${url}`, {
      method,
      headers: {
        authorization: `Bearer ${await testApp.signToken({ subject: user })}`,
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: (await response.json().catch(() => null)) as unknown };
  };

  beforeAll(async () => {
    testApp = await startTestApp();
    db = testApp.adminDb;
    await db.insert(schema.organization).values([
      { id: orgs.oem, name: `LIF3-OEM ${run}` },
      { id: orgs.supplier, name: `LIF3-Lieferant ${run}` },
    ]);
    await db
      .insert(schema.organizationFeature)
      .values({ organizationId: orgs.oem, feature: 'buyer' });
    const user = (
      id: string,
      name: string,
      organizationId: string,
      orgRole: 'admin' | 'member' | 'viewer',
    ) => ({
      id,
      name,
      email: `${id}@example.com`,
      organizationId,
      orgRole,
      rolesImportedAt: new Date(),
    });
    await db
      .insert(schema.appUser)
      .values([
        user(users.sro, 'Sara Ost', orgs.oem, 'admin'),
        user(users.kam, 'Kim Kaiser', orgs.supplier, 'admin'),
        user(users.lea, 'Lea Lang', orgs.supplier, 'member'),
        user(users.viewer, 'Vera Leser', orgs.supplier, 'viewer'),
      ]);
    await insertRelationships(db, [{ id: rel, buyer: orgs.oem, supplier: orgs.supplier }]);
  });

  afterAll(async () => {
    await db.execute(sql`delete from supplier_account_objective where relationship_id = ${rel}`);
    await db.execute(sql`delete from supplier_account_plan where relationship_id = ${rel}`);
    await deleteRelationships(db, Object.values(orgs));
    await db.execute(sql`delete from app_user where organization_id in ${Object.values(orgs)}`);
    await db.execute(sql`delete from organization_feature where organization_id = ${orgs.oem}`);
    await db.execute(sql`delete from organization where id in ${Object.values(orgs)}`);
    await testApp.close();
  });

  it('zwei Lieferanten-Nutzer derselben Organisation sehen dieselbe eigene Sicht', async () => {
    expect(accountPlanSchema.parse((await call(users.kam, 'GET', base)).body).plan).toBeNull();
    await call(users.kam, 'PUT', `${base}/zusammenfassung`, { summary: 'A-Kunde, Wachstum 2028.' });
    await call(users.kam, 'PUT', `${base}/sicht`, {
      ownView: 'Preisfokussiert, fair.',
      importance: 4,
    });
    const created = accountPlanSchema.parse(
      (
        await call(users.kam, 'POST', `${base}/ziele`, {
          text: 'Anteil Leiterplatten auf 45 %',
          ownerUserId: users.lea,
          targetYear: 2028,
        })
      ).body,
    );
    expect(created.objectives[0]).toMatchObject({ ownerName: 'Lea Lang', targetYear: 2028 });
    const seen = accountPlanSchema.parse((await call(users.lea, 'GET', base)).body);
    expect(seen.plan).toMatchObject({
      summary: 'A-Kunde, Wachstum 2028.',
      ownView: 'Preisfokussiert, fair.',
      importance: 4,
      updatedByName: 'Kim Kaiser',
    });
    expect(seen.objectives.map((entry) => entry.text)).toEqual(['Anteil Leiterplatten auf 45 %']);
    expect(seen.canEdit).toBe(true);
  });

  it('Leser lesen, bearbeiten aber nicht', async () => {
    const view = accountPlanSchema.parse((await call(users.viewer, 'GET', base)).body);
    expect(view.canEdit).toBe(false);
    expect(view.people).toEqual([]);
    expect(
      (await call(users.viewer, 'PUT', `${base}/zusammenfassung`, { summary: 'x' })).status,
    ).toBe(403);
  });

  it('der Käufer bekommt keine Zeile und keine Anzahl', async () => {
    expect((await call(users.sro, 'GET', base)).status).toBe(403);
    expect((await call(users.sro, 'PUT', `${base}/zusammenfassung`, { summary: 'x' })).status).toBe(
      403,
    );
    const counts = await withTenant(
      db,
      { userId: users.sro, organizationId: orgs.oem },
      async (tx) => ({
        plans: (
          await tx.execute<{ n: number }>(sql`select count(*)::int as n from supplier_account_plan`)
        ).rows[0]?.n,
        objectives: (
          await tx.execute<{ n: number }>(
            sql`select count(*)::int as n from supplier_account_objective`,
          )
        ).rows[0]?.n,
      }),
    );
    expect(counts).toEqual({ plans: 0, objectives: 0 });
    // Auch der Verlauf verrät dem Käufer nichts.
    const history = auditResponseSchema.parse(
      (await call(users.sro, 'GET', `/audit?object_type=supplier_account_plan&object_id=${rel}`))
        .body,
    );
    expect(history.entries).toEqual([]);
  });

  it('ein Ziel lässt sich ändern und löschen', async () => {
    const before = accountPlanSchema.parse((await call(users.lea, 'GET', base)).body);
    const id = before.objectives[0]?.id as string;
    const changed = accountPlanSchema.parse(
      (
        await call(users.lea, 'PUT', `${base}/ziele/${id}`, {
          text: 'Anteil Leiterplatten auf 50 %',
          ownerUserId: null,
          targetYear: 2029,
        })
      ).body,
    );
    expect(changed.objectives[0]).toMatchObject({
      text: 'Anteil Leiterplatten auf 50 %',
      ownerName: null,
    });
    const removed = accountPlanSchema.parse(
      (await call(users.lea, 'DELETE', `${base}/ziele/${id}`)).body,
    );
    expect(removed.objectives).toEqual([]);
  });
});
