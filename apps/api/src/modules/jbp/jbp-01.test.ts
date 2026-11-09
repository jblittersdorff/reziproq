import { randomUUID } from 'node:crypto';
import { type Database, schema, sql, withTenant } from '@reziproq/db';
import { jbpPreparationSchema, meetingListSchema } from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';

// Tests zu docs/specs/JBP-01.md: Anlegen erzeugt Plan, Termin und Agenda in einem Schritt;
// Spielregeln erscheinen nur geteilt; jede Seite schreibt nur ihr Geschäftsupdate; der Hinweis zum
// Lieferantenplan und der Zyklus-Verweis bleiben beim Käufer.
describe('JBP-01 Vorbereitung des Joint Business Planning', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const run = randomUUID().slice(0, 8);
  const orgs = { oem: randomUUID(), supplier: randomUUID() };
  const rel = randomUUID();
  const cycleId = randomUUID();
  const users = {
    sro: `jbp01-sro-${run}`,
    member: `jbp01-member-${run}`,
    kam: `jbp01-kam-${run}`,
  };
  const buyer = `/suppliers/${rel}/jbp`;
  const supplier = `/kunden/${rel}/jbp`;

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
  const prep = async (user: string, url: string) =>
    jbpPreparationSchema.parse((await call(user, 'GET', url)).body);

  beforeAll(async () => {
    testApp = await startTestApp();
    db = testApp.adminDb;
    await db.insert(schema.organization).values([
      { id: orgs.oem, name: `JBP-OEM ${run}` },
      { id: orgs.supplier, name: `JBP-Lieferant ${run}` },
    ]);
    await db
      .insert(schema.organizationFeature)
      .values({ organizationId: orgs.oem, feature: 'buyer' });
    const person = (
      id: string,
      name: string,
      organizationId: string,
      orgRole: 'admin' | 'member',
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
        person(users.sro, 'Sara Ost', orgs.oem, 'member'),
        person(users.member, 'Mia Mitglied', orgs.oem, 'member'),
        person(users.kam, 'Kim Kaiser', orgs.supplier, 'admin'),
      ]);
    await insertRelationships(db, [{ id: rel, buyer: orgs.oem, supplier: orgs.supplier }]);
    await db.insert(schema.relationshipMember).values([
      { relationshipId: rel, orgId: orgs.oem, userId: users.sro, teamRole: 'sro' },
      { relationshipId: rel, orgId: orgs.oem, userId: users.member, teamRole: 'member' },
    ]);
    await db.insert(schema.cycle).values({
      id: cycleId,
      relationshipId: rel,
      label: '2026',
      status: 'active',
      jbpDate: '2099-01-15',
    });
  });

  afterAll(async () => {
    await db.execute(sql`delete from jbp where relationship_id = ${rel}`);
    await db.execute(sql`delete from meeting where relationship_id = ${rel}`);
    await deleteRelationships(db, Object.values(orgs));
    await db.execute(sql`delete from app_user where organization_id in ${Object.values(orgs)}`);
    await db.execute(sql`delete from organization_feature where organization_id = ${orgs.oem}`);
    await db.execute(sql`delete from organization where id in ${Object.values(orgs)}`);
    await testApp.close();
  });

  it('ohne Plan schlägt der Käufer den Termin aus dem Zyklus vor; nur SRO oder Admin legen an', async () => {
    const empty = await prep(users.sro, buyer);
    expect(empty).toMatchObject({ jbp: null, canCreate: true, suggestedDate: '2099-01-15' });
    expect((await prep(users.member, buyer)).canCreate).toBe(false);
    const denied = await call(users.member, 'POST', buyer, {
      startsAt: '2099-01-15T09:00:00Z',
      location: null,
      locale: 'de',
    });
    expect(denied.status).toBe(403);
    // Der Lieferant sieht weder Vorschlag noch Hinweis aus dem käuferprivaten Zyklus.
    expect(await prep(users.kam, supplier)).toMatchObject({
      jbp: null,
      canCreate: false,
      suggestedDate: null,
      buyerHint: null,
    });
  });

  it('Anlegen erzeugt Plan, Termin der Art jbp und Agenda nach Vorlage in einem Schritt', async () => {
    const { status, body } = await call(users.sro, 'POST', buyer, {
      startsAt: '2099-01-15T09:00:00Z',
      location: 'Werk Nord',
      locale: 'de',
    });
    expect(status).toBe(201);
    const created = jbpPreparationSchema.parse(body);
    expect(created.jbp).toMatchObject({ version: 1, status: 'draft' });
    expect(created.meeting).toMatchObject({
      title: 'Joint Business Planning 2099',
      location: 'Werk Nord',
    });
    expect(created.agenda.map((item) => [item.title, item.section, item.ready])).toEqual([
      ['Geschäftsupdate Käufer', 'buyer_update', false],
      ['Geschäftsupdate Lieferant', 'supplier_update', false],
      ['Themen beider Seiten', 'topics', false],
      ['Initiativen und Roadmap', 'initiatives', false],
      ['Zusagen', 'commitments', false],
      ['Scorecard', 'scorecard', false],
    ]);
    // Der Termin steht auch bei den Terminen beider Seiten.
    const meetings = meetingListSchema.parse(
      (await call(users.kam, 'GET', `/kunden/${rel}/termine`)).body,
    );
    expect(meetings.upcoming).toContainEqual(expect.objectContaining({ type: 'jbp' }));
    // Ein zweites Anlegen legt nichts doppelt an.
    await call(users.sro, 'POST', buyer, {
      startsAt: '2099-02-01T09:00:00Z',
      location: null,
      locale: 'de',
    });
    const count = await db.execute<{ count: number }>(
      sql`select count(*)::int as count from jbp where relationship_id = ${rel}`,
    );
    expect(count.rows[0]?.count).toBe(1);
  });

  it('der Zyklus-Verweis bleibt käuferprivat', async () => {
    const seen = await withTenant(
      db,
      { userId: users.kam, organizationId: orgs.supplier, customerOrganizationId: orgs.oem },
      (tx) =>
        tx.execute<{ count: number }>(
          sql`select count(*)::int as count from jbp_cycle_link where relationship_id = ${rel}`,
        ),
    );
    expect(seen.rows[0]?.count).toBe(0);
    const own = await withTenant(db, { userId: users.sro, organizationId: orgs.oem }, (tx) =>
      tx.execute<{ count: number }>(
        sql`select count(*)::int as count from jbp_cycle_link where relationship_id = ${rel}`,
      ),
    );
    expect(own.rows[0]?.count).toBe(1);
  });

  it('jede Seite schreibt nur ihr eigenes Geschäftsupdate; die Agenda zeigt, was bereit ist', async () => {
    const theirs = jbpPreparationSchema.parse(
      (
        await call(users.kam, 'PUT', `${supplier}/geschaeftsupdate`, {
          text: 'Neues Werk in Brno.',
        })
      ).body,
    );
    expect(theirs.updates).toMatchObject({
      buyer: null,
      supplier: { text: 'Neues Werk in Brno.' },
    });
    expect(theirs.agenda.find((item) => item.section === 'supplier_update')?.ready).toBe(true);
    await call(users.sro, 'PUT', `${buyer}/geschaeftsupdate`, { text: 'Volumen 2027 plus 8 %.' });
    const own = await prep(users.sro, buyer);
    expect(own.updates).toMatchObject({
      buyer: { text: 'Volumen 2027 plus 8 %.' },
      supplier: { text: 'Neues Werk in Brno.' },
    });
    // Die Zeile des Käufers kann der Lieferant auch direkt in der Datenbank nicht ändern.
    const changed = await withTenant(
      db,
      { userId: users.kam, organizationId: orgs.supplier, customerOrganizationId: orgs.oem },
      (tx) =>
        tx.execute(
          sql`update jbp_business_update set text = 'x' where relationship_id = ${rel} and side = 'buyer' returning id`,
        ),
    );
    expect(changed.rows).toEqual([]);
  });

  it('Spielregeln erscheinen nur, wenn sie geteilt sind', async () => {
    expect((await prep(users.kam, supplier)).live.rules).toBeNull();
    const ruleSetId = randomUUID();
    await db.insert(schema.ruleSet).values({
      id: ruleSetId,
      relationshipId: rel,
      ownerOrgId: orgs.oem,
      visibility: 'shared',
      version: 1,
      status: 'shared',
      targetImpactLevel: 3,
      targetQualityLevel: 3,
      typeName: 'Strategischer Partner',
      createdBy: users.sro,
      approvedBy: users.sro,
      approvedByName: 'Sara Ost',
      approvedAt: new Date(),
    });
    await db.insert(schema.relationshipTarget).values({
      relationshipId: rel,
      ownerOrgId: orgs.oem,
      visibility: 'shared',
      typeName: 'Strategischer Partner',
      typeDescription: 'Test',
      ruleSetId,
      ruleSetVersion: 1,
      sharedBy: users.sro,
      sharedByName: 'Sara Ost',
    });
    expect((await prep(users.kam, supplier)).live.rules?.typeName).toBe('Strategischer Partner');
    // Der Überblick des Käufers nennt die geteilten Spielregeln mit Version (NAV-06, A2).
    const overview = (await call(users.sro, 'GET', `/suppliers/${rel}/overview`)).body as {
      metrics: { kind: string }[];
    };
    expect(overview.metrics).toContainEqual(
      expect.objectContaining({ tile: 'relationship', kind: 'rules', version: 1 }),
    );
    await db.execute(sql`delete from relationship_target where relationship_id = ${rel}`);
    await db.execute(sql`delete from rule_set where relationship_id = ${rel}`);
  });

  it('der Hinweis zum Lieferantenplan steht nur beim Käufer', async () => {
    expect((await prep(users.sro, buyer)).buyerHint).toEqual({ supplierPlanApproved: false });
    expect((await prep(users.kam, supplier)).buyerHint).toBeNull();
  });
});
