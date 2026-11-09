import { randomUUID } from 'node:crypto';
import { type Database, schema, sql, withTenant } from '@reziproq/db';
import { jbpPreparationSchema, jbpTopicCandidatesSchema, jbpTopicsSchema } from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';

// Tests zu docs/specs/JBP-02.md: Themen beider Seiten. Übernommene Themen zeigen dem Lieferanten
// nur Titel und teilbare Beschreibung, die Herkunft sieht nur der Käufer, jede Seite ändert nur
// ihre Themen, geparkte bleiben mit Begründung sichtbar.
describe('JBP-02 Themen beider Seiten', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const run = randomUUID().slice(0, 8);
  const orgs = { oem: randomUUID(), supplier: randomUUID() };
  const rel = randomUUID();
  const cycleId = randomUUID();
  const planId = randomUUID();
  const strategicTopicId = randomUUID();
  const users = {
    sro: `jbp02-sro-${run}`,
    member: `jbp02-member-${run}`,
    kam: `jbp02-kam-${run}`,
  };
  const buyer = `/suppliers/${rel}/jbp`;
  const supplier = `/kunden/${rel}/jbp`;
  const secretReason = 'Interne Begründung: Preisdruck wegen Margenziel';
  let buyerTopicId = '';
  let supplierTopicId = '';

  const call = async (user: string, method: string, url: string, body?: unknown) => {
    const response = await fetch(`${testApp.baseUrl}/api${url}`, {
      method,
      headers: {
        authorization: `Bearer ${await testApp.signToken({ subject: user })}`,
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return {
      status: response.status,
      text: await response.text(),
    };
  };
  const json = (response: { text: string }) => JSON.parse(response.text) as unknown;
  const topics = async (user: string, base: string) =>
    jbpTopicsSchema.parse(json(await call(user, 'GET', `${base}/themen`)));

  beforeAll(async () => {
    testApp = await startTestApp();
    db = testApp.adminDb;
    await db.insert(schema.organization).values([
      { id: orgs.oem, name: `JBP2-OEM ${run}` },
      { id: orgs.supplier, name: `JBP2-Lieferant ${run}` },
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
    await db
      .insert(schema.cycle)
      .values({ id: cycleId, relationshipId: rel, label: '2026', status: 'active' });
    await db
      .insert(schema.supplierPlan)
      .values({ id: planId, relationshipId: rel, cycleId, summary: 'Intern' });
    await db.insert(schema.strategicTopic).values({
      id: strategicTopicId,
      relationshipId: rel,
      planId,
      title: 'Kosten der Plattform senken',
      reason: secretReason,
      priority: 1,
    });
    await call(users.sro, 'POST', buyer, {
      startsAt: '2099-01-15T09:00:00Z',
      location: null,
      locale: 'de',
    });
  });

  afterAll(async () => {
    await db.execute(sql`delete from jbp where relationship_id = ${rel}`);
    await db.execute(sql`delete from meeting where relationship_id = ${rel}`);
    await db.execute(sql`delete from supplier_plan where relationship_id = ${rel}`);
    await deleteRelationships(db, Object.values(orgs));
    await db.execute(sql`delete from app_user where organization_id in ${Object.values(orgs)}`);
    await db.execute(sql`delete from organization_feature where organization_id = ${orgs.oem}`);
    await db.execute(sql`delete from organization where id in ${Object.values(orgs)}`);
    await testApp.close();
  });

  it('der SRO sieht die internen Themen mit Begründung als Vorschlag; andere übernehmen nicht', async () => {
    const { candidates } = jbpTopicCandidatesSchema.parse(
      json(await call(users.sro, 'GET', `${buyer}/themen/vorschlaege`)),
    );
    expect(candidates).toEqual([
      { id: strategicTopicId, title: 'Kosten der Plattform senken', reason: secretReason },
    ]);
    expect((await topics(users.member, buyer)).canImport).toBe(false);
    const denied = await call(users.member, 'POST', `${buyer}/themen/uebernehmen`, {
      items: [{ strategicTopicId, description: 'x' }],
    });
    expect(denied.status).toBe(403);
    expect((await call(users.kam, 'GET', `${supplier}/themen/vorschlaege`)).status).toBe(404);
  });

  it('übernommene Themen zeigen dem Lieferanten nur Titel und teilbare Beschreibung', async () => {
    const imported = await call(users.sro, 'POST', `${buyer}/themen/uebernehmen`, {
      items: [{ strategicTopicId, description: 'Gemeinsam die Stückkosten der Plattform senken.' }],
    });
    expect(imported.status).toBe(201);
    const own = jbpTopicsSchema.parse(json(imported));
    buyerTopicId = own.buyer[0]?.id ?? '';
    expect(own.buyer[0]).toMatchObject({
      title: 'Kosten der Plattform senken',
      description: 'Gemeinsam die Stückkosten der Plattform senken.',
      origin: { title: 'Kosten der Plattform senken' },
    });
    // Ein zweites Mal steht das Thema nicht mehr zur Wahl.
    const { candidates } = jbpTopicCandidatesSchema.parse(
      json(await call(users.sro, 'GET', `${buyer}/themen/vorschlaege`)),
    );
    expect(candidates).toEqual([]);

    const theirs = await call(users.kam, 'GET', `${supplier}/themen`);
    expect(theirs.text).not.toContain(secretReason);
    const parsed = jbpTopicsSchema.parse(json(theirs));
    expect(parsed.buyer[0]).toMatchObject({
      title: 'Kosten der Plattform senken',
      description: 'Gemeinsam die Stückkosten der Plattform senken.',
      origin: null,
      own: false,
    });
  });

  it('die Herkunft eines Themas sieht nur der Käufer', async () => {
    const count = async (session: Parameters<typeof withTenant>[1]) =>
      (
        await withTenant(db, session, (tx) =>
          tx.execute<{ count: number }>(
            sql`select count(*)::int as count from jbp_topic_origin where relationship_id = ${rel}`,
          ),
        )
      ).rows[0]?.count;
    expect(
      await count({
        userId: users.kam,
        organizationId: orgs.supplier,
        customerOrganizationId: orgs.oem,
      }),
    ).toBe(0);
    expect(await count({ userId: users.sro, organizationId: orgs.oem })).toBe(1);
  });

  it('jede Seite ändert nur ihre eigenen Themen', async () => {
    const created = await call(users.kam, 'POST', `${supplier}/themen`, {
      title: 'Neues Werk in Brno',
      description: 'Mehr Kapazität ab 2027.',
    });
    expect(created.status).toBe(201);
    supplierTopicId = jbpTopicsSchema.parse(json(created)).supplier[0]?.id ?? '';
    const foreign = { title: 'Anders', description: '' };
    expect(
      (await call(users.kam, 'PUT', `${supplier}/themen/${buyerTopicId}`, foreign)).status,
    ).toBe(403);
    expect(
      (await call(users.sro, 'PUT', `${buyer}/themen/${supplierTopicId}`, foreign)).status,
    ).toBe(403);
    // Auch direkt in der Datenbank ändert der Lieferant keine Zeile des Käufers.
    const changed = await withTenant(
      db,
      { userId: users.kam, organizationId: orgs.supplier, customerOrganizationId: orgs.oem },
      (tx) =>
        tx.execute(sql`update jbp_topic set title = 'x' where id = ${buyerTopicId} returning id`),
    );
    expect(changed.rows).toEqual([]);
    // Die Vorbereitung meldet „Themen bereit“, sobald beide Seiten Themen haben.
    const prep = jbpPreparationSchema.parse(json(await call(users.sro, 'GET', buyer)));
    expect(prep.agenda.find((item) => item.section === 'topics')?.ready).toBe(true);
  });

  it('geparkte Themen bleiben mit Begründung sichtbar; Parken braucht eine Begründung', async () => {
    expect(
      (await call(users.kam, 'PUT', `${supplier}/themen/${supplierTopicId}/parken`, { reason: '' }))
        .status,
    ).toBe(400);
    await call(users.kam, 'PUT', `${supplier}/themen/${supplierTopicId}/parken`, {
      reason: 'Erst nach der Werksentscheidung',
    });
    const seen = await topics(users.sro, buyer);
    expect(seen.supplier[0]).toMatchObject({
      status: 'parked',
      parkReason: 'Erst nach der Werksentscheidung',
    });
    await call(users.kam, 'PUT', `${supplier}/themen/${supplierTopicId}/wieder-aufnehmen`);
    expect((await topics(users.sro, buyer)).supplier[0]?.status).toBe('proposed');
  });

  it('jede Seite ordnet ihre Themen', async () => {
    await call(users.sro, 'POST', `${buyer}/themen`, { title: 'Zweites Thema', description: '' });
    const before = await topics(users.sro, buyer);
    const ids = before.buyer.map((topic) => topic.id).reverse();
    await call(users.sro, 'PUT', `${buyer}/themen/reihenfolge`, { ids });
    const after = await topics(users.sro, buyer);
    expect(after.buyer.map((topic) => topic.id)).toEqual(ids);
    expect(
      (await call(users.sro, 'PUT', `${buyer}/themen/reihenfolge`, { ids: [ids[0]] })).status,
    ).toBe(400);
  });
});
