import { randomUUID } from 'node:crypto';
import { type Database, schema, sql, withTenant } from '@reziproq/db';
import {
  auditResponseSchema,
  initiativeDetailSchema,
  initiativesSchema,
  jbpPreparationSchema,
  jbpTopicsSchema,
} from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';

// Tests zu docs/specs/JBP-03.md: Initiativen und Roadmap. Nutzen für beide Seiten ist Pflicht,
// beide Seiten bearbeiten, nach der Freigabe nur Status und Meilensteine, jede Änderung im
// geteilten Verlauf, Zusammenführen setzt Themen auf merged.
describe('JBP-03 Initiativen und Roadmap', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const run = randomUUID().slice(0, 8);
  const orgs = { oem: randomUUID(), supplier: randomUUID() };
  const rel = randomUUID();
  const users = {
    sro: `jbp03-sro-${run}`,
    outsider: `jbp03-out-${run}`,
    kam: `jbp03-kam-${run}`,
  };
  const buyer = `/suppliers/${rel}/jbp`;
  const supplier = `/kunden/${rel}/jbp`;
  const valid = {
    title: 'Zweitquelle Leiterplatten',
    goal: 'Lieferfähigkeit sichern',
    benefitBuyer: 'Weniger Ausfälle',
    benefitSupplier: 'Mehr Volumen',
    ownerBuyerName: 'Sara Ost',
    ownerSupplierName: 'Kim Kaiser',
    startsOn: '2027-01-01',
    endsOn: '2027-12-31',
  };
  let initiativeId = '';

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
  const detail = (response: { body: unknown }) => initiativeDetailSchema.parse(response.body);

  beforeAll(async () => {
    testApp = await startTestApp();
    db = testApp.adminDb;
    await db.insert(schema.organization).values([
      { id: orgs.oem, name: `JBP3-OEM ${run}` },
      { id: orgs.supplier, name: `JBP3-Lieferant ${run}` },
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
        person(users.outsider, 'Otto Außen', orgs.oem, 'member'),
        person(users.kam, 'Kim Kaiser', orgs.supplier, 'admin'),
      ]);
    await insertRelationships(db, [{ id: rel, buyer: orgs.oem, supplier: orgs.supplier }]);
    await db
      .insert(schema.relationshipMember)
      .values({ relationshipId: rel, orgId: orgs.oem, userId: users.sro, teamRole: 'sro' });
    await call(users.sro, 'POST', buyer, {
      startsAt: '2099-01-15T09:00:00Z',
      location: null,
      locale: 'de',
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

  it('ohne Nutzen für beide Seiten lässt sich keine Initiative speichern', async () => {
    for (const missing of ['benefitBuyer', 'benefitSupplier'] as const) {
      const response = await call(users.sro, 'POST', `${buyer}/initiativen`, {
        ...valid,
        [missing]: '  ',
      });
      expect(response.status).toBe(400);
    }
    // Auch an der API vorbei verhindert die Datenbank eine Initiative ohne Nutzen.
    const [plan] = await db
      .select({ id: schema.jbp.id })
      .from(schema.jbp)
      .where(sql`relationship_id = ${rel}`);
    await expect(
      db.insert(schema.initiative).values({
        relationshipId: rel,
        ownerOrgId: orgs.oem,
        jbpId: plan?.id as string,
        ...valid,
        benefitSupplier: '',
        createdBy: users.sro,
        createdByName: 'Sara Ost',
      }),
    ).rejects.toThrow();
    // Wer nicht im Team ist, legt beim Käufer nichts an.
    expect((await call(users.outsider, 'POST', `${buyer}/initiativen`, valid)).status).toBe(403);
  });

  it('Zusammenführen setzt die Themen beider Seiten auf merged und verknüpft sie', async () => {
    await call(users.sro, 'POST', `${buyer}/themen`, { title: 'Ausfälle senken', description: '' });
    await call(users.kam, 'POST', `${supplier}/themen`, { title: 'Neues Werk', description: '' });
    const before = jbpTopicsSchema.parse((await call(users.sro, 'GET', `${buyer}/themen`)).body);
    const topicIds = [before.buyer[0]?.id, before.supplier[0]?.id] as string[];
    const created = await call(users.sro, 'POST', `${buyer}/initiativen`, { ...valid, topicIds });
    expect(created.status).toBe(201);
    const initiative = detail(created).initiative;
    initiativeId = initiative.id;
    expect(initiative.topics.map((topic) => topic.side).sort()).toEqual(['buyer', 'supplier']);
    const after = jbpTopicsSchema.parse((await call(users.kam, 'GET', `${supplier}/themen`)).body);
    expect([...after.buyer, ...after.supplier].map((topic) => topic.status)).toEqual([
      'merged',
      'merged',
    ]);
    // Ein zusammengeführtes Thema geht nicht ein zweites Mal ein.
    const again = await call(users.kam, 'POST', `${supplier}/initiativen`, {
      ...valid,
      topicIds: [topicIds[1]],
    });
    expect(again.status).toBe(400);
    // Die Agenda meldet Initiativen bereit.
    const prep = jbpPreparationSchema.parse((await call(users.sro, 'GET', buyer)).body);
    expect(prep.agenda.find((item) => item.section === 'initiatives')?.ready).toBe(true);
  });

  it('beide Seiten bearbeiten; jede Änderung steht im Verlauf für beide Seiten', async () => {
    // Der Lieferant ändert die Initiative, die der Käufer angelegt hat.
    const changed = await call(users.kam, 'PUT', `${supplier}/initiativen/${initiativeId}`, {
      ...valid,
      endsOn: '2028-06-30',
    });
    expect(changed.status).toBe(200);
    expect(detail(changed).initiative.endsOn).toBe('2028-06-30');
    const milestone = await call(
      users.kam,
      'POST',
      `${supplier}/initiativen/${initiativeId}/meilensteine`,
      { title: 'Muster frei', dueOn: '2027-03-15', doneOn: null },
    );
    expect(milestone.status).toBe(201);
    for (const user of [users.sro, users.kam]) {
      const history = auditResponseSchema.parse(
        (
          await call(
            user,
            'GET',
            `/audit?object_type=initiative&object_id=${initiativeId}&relationship_id=${rel}`,
          )
        ).body,
      );
      expect(history.entries.map((entry) => entry.action)).toEqual([
        'updated',
        'updated',
        'created',
      ]);
      expect(history.entries[0]?.changes.milestones?.to).toBe('Muster frei 2027-03-15');
      expect(history.entries[1]?.changes.ends_on).toEqual({ from: '2027-12-31', to: '2028-06-30' });
    }
    // An der Funktion vorbei kann der Lieferant die Zeile des Käufers nicht ändern.
    const direct = await withTenant(
      db,
      { userId: users.kam, organizationId: orgs.supplier, customerOrganizationId: orgs.oem },
      (tx) =>
        tx.execute(sql`update initiative set title = 'x' where id = ${initiativeId} returning id`),
    );
    expect(direct.rows).toEqual([]);
  });

  it('die Roadmap-Daten nennen Zeitraum und Meilensteine jeder Initiative', async () => {
    const list = initiativesSchema.parse(
      (await call(users.kam, 'GET', `${supplier}/initiativen`)).body,
    );
    expect(list).toMatchObject({ hasPlan: true, approved: false, canEdit: true });
    expect(list.initiatives).toHaveLength(1);
    expect(list.initiatives[0]).toMatchObject({
      startsOn: '2027-01-01',
      endsOn: '2028-06-30',
      milestones: [{ title: 'Muster frei', dueOn: '2027-03-15', doneOn: null }],
    });
  });

  it('nach der Freigabe sind nur Status und Meilensteine änderbar', async () => {
    await db.execute(sql`update jbp set status = 'approved' where relationship_id = ${rel}`);
    try {
      expect(
        (await call(users.sro, 'PUT', `${buyer}/initiativen/${initiativeId}`, valid)).status,
      ).toBe(409);
      expect((await call(users.kam, 'POST', `${supplier}/initiativen`, valid)).status).toBe(409);
      const status = await call(
        users.kam,
        'PUT',
        `${supplier}/initiativen/${initiativeId}/status`,
        {
          status: 'running',
        },
      );
      expect(detail(status).initiative.status).toBe('running');
      const [milestone] = detail(status).initiative.milestones;
      const done = await call(
        users.sro,
        'PUT',
        `${buyer}/initiativen/${initiativeId}/meilensteine/${milestone?.id}`,
        { title: 'Muster frei', dueOn: '2027-03-15', doneOn: '2027-03-10' },
      );
      expect(detail(done).initiative.milestones[0]?.doneOn).toBe('2027-03-10');
      expect(detail(done).approved).toBe(true);
      // Auch die Funktion selbst lehnt Inhaltsänderungen ab.
      await expect(
        withTenant(db, { userId: users.sro, organizationId: orgs.oem }, (tx) =>
          tx.execute(
            sql`select app_initiative_save(${initiativeId}, 'x', 'x', 'x', 'x', 'x', 'x', '2027-01-01'::date, '2027-02-01'::date)`,
          ),
        ),
      ).rejects.toThrow();
    } finally {
      await db.execute(sql`update jbp set status = 'draft' where relationship_id = ${rel}`);
    }
  });

  it('ein Meilenstein lässt sich löschen; eine fremde Beziehung sieht nichts', async () => {
    const current = detail(await call(users.sro, 'GET', `${buyer}/initiativen/${initiativeId}`));
    const id = current.initiative.milestones[0]?.id as string;
    const removed = await call(
      users.kam,
      'DELETE',
      `${supplier}/initiativen/${initiativeId}/meilensteine/${id}`,
    );
    expect(detail(removed).initiative.milestones).toEqual([]);
    const other = randomUUID();
    expect((await call(users.kam, 'GET', `/kunden/${other}/jbp/initiativen`)).status).toBe(404);
  });
});
