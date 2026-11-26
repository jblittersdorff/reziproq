import { randomUUID } from 'node:crypto';
import { type Database, schema, sql, withTenant } from '@reziproq/db';
import {
  commitmentsSchema,
  dueListSchema,
  initiativeDetailSchema,
  jbpPreparationSchema,
  meetingDetailSchema,
} from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';

// Tests zu docs/specs/JBP-05.md: Zusagen beider Seiten. Überfällige oben und markiert, nur die
// zusagende Seite setzt den Status, offene Zusagen auf Start der verantwortlichen Person, live im
// Termin. Dazu die Wahl der eigenen Person bei Initiativen und offene Meilensteine auf Start.
describe('JBP-05 Zusagen', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const run = randomUUID().slice(0, 8);
  const orgs = { oem: randomUUID(), supplier: randomUUID() };
  const rel = randomUUID();
  const users = {
    sro: `jbp05-sro-${run}`,
    member: `jbp05-member-${run}`,
    kam: `jbp05-kam-${run}`,
  };
  const buyer = `/suppliers/${rel}/jbp`;
  const supplier = `/kunden/${rel}/jbp`;
  let meetingId = '';
  let lateId = '';
  let supplierId = '';

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
  const list = async (user: string, base: string) =>
    commitmentsSchema.parse((await call(user, 'GET', `${base}/zusagen`)).body);

  beforeAll(async () => {
    testApp = await startTestApp();
    db = testApp.adminDb;
    await db.insert(schema.organization).values([
      { id: orgs.oem, name: `JBP5-OEM ${run}` },
      { id: orgs.supplier, name: `JBP5-Lieferant ${run}` },
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
    const created = jbpPreparationSchema.parse(
      (
        await call(users.sro, 'POST', buyer, {
          startsAt: '2099-01-15T09:00:00Z',
          location: null,
          locale: 'de',
        })
      ).body,
    );
    meetingId = created.meeting?.id as string;
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

  it('jede Seite wählt nur Personen der eigenen Seite; überfällige stehen oben und sind markiert', async () => {
    const own = await list(users.sro, buyer);
    expect(own.people.map((person) => person.name)).toEqual(['Mia Mitglied', 'Sara Ost']);
    // Eine Person der anderen Seite lässt sich nicht eintragen.
    const foreign = await call(users.sro, 'POST', `${buyer}/zusagen`, {
      title: 'x',
      ownerUserId: users.kam,
      dueOn: '2099-01-01',
      initiativeId: null,
    });
    expect(foreign.status).toBe(400);
    await call(users.sro, 'POST', `${buyer}/zusagen`, {
      title: 'Bedarfsausblick 2027',
      ownerUserId: users.member,
      dueOn: '2099-03-31',
      initiativeId: null,
    });
    const late = commitmentsSchema.parse(
      (
        await call(users.sro, 'POST', `${buyer}/zusagen`, {
          title: 'Zeichnungen freigeben',
          ownerUserId: users.member,
          dueOn: '2020-01-31',
          initiativeId: null,
        })
      ).body,
    );
    lateId = late.buyer[0]?.id as string;
    expect(late.buyer.map((entry) => [entry.title, entry.overdue])).toEqual([
      ['Zeichnungen freigeben', true],
      ['Bedarfsausblick 2027', false],
    ]);
    const theirs = commitmentsSchema.parse(
      (
        await call(users.kam, 'POST', `${supplier}/zusagen`, {
          title: 'Kapazität reservieren',
          ownerUserId: users.kam,
          dueOn: '2099-02-28',
          initiativeId: null,
        })
      ).body,
    );
    supplierId = theirs.supplier[0]?.id as string;
    expect(theirs.supplier[0]).toMatchObject({
      side: 'supplier',
      own: true,
      ownerName: 'Kim Kaiser',
    });
    expect(theirs.buyer.every((entry) => !entry.own)).toBe(true);
  });

  it('nur die zusagende Seite setzt kept oder missed', async () => {
    const denied = await call(users.sro, 'PUT', `${buyer}/zusagen/${supplierId}/status`, {
      status: 'kept',
    });
    expect(denied.status).toBe(403);
    const direct = await withTenant(db, { userId: users.sro, organizationId: orgs.oem }, (tx) =>
      tx.execute(sql`update commitment set status = 'kept' where id = ${supplierId} returning id`),
    );
    expect(direct.rows).toEqual([]);
    // ZQ-01 T2-ZQ2: gehalten ohne Beleg wird abgelehnt, in der API und in der Datenbank
    const withoutEvidence = await call(
      users.kam,
      'PUT',
      `${supplier}/zusagen/${supplierId}/status`,
      {
        status: 'kept',
      },
    );
    expect(withoutEvidence).toMatchObject({ status: 422, body: { code: 'beleg_fehlt' } });
    await expect(
      db.execute(sql`update commitment set status = 'kept' where id = ${supplierId}`),
    ).rejects.toMatchObject({ cause: { constraint: 'commitment_kept_evidence' } });
    const kept = commitmentsSchema.parse(
      (
        await call(users.kam, 'PUT', `${supplier}/zusagen/${supplierId}/status`, {
          status: 'kept',
          evidence: { kind: 'delivery_advice', note: 'Lieferavis 4711' },
        })
      ).body,
    );
    expect(kept.supplier[0]?.status).toBe('kept');
    expect(kept.supplier[0]?.evidence).toMatchObject({
      kind: 'delivery_advice',
      note: 'Lieferavis 4711',
      byName: expect.any(String),
      at: expect.any(String),
    });
    // Jede Änderung steht im Verlauf, auch für die andere Seite.
    const history = (await call(
      users.sro,
      'GET',
      `/audit?object_type=commitment&object_id=${supplierId}`,
    )) as { body: { entries: { action: string }[] } };
    expect(history.body.entries.map((entry) => entry.action)).toEqual(['updated', 'created']);
  });

  it('offene Zusagen erscheinen auf Start der verantwortlichen Person', async () => {
    const due = dueListSchema.parse((await call(users.member, 'GET', '/start/due')).body);
    expect(
      due.items.filter((item) => item.kind === 'commitment').map((item) => item.detail),
    ).toEqual(['Zeichnungen freigeben', 'Bedarfsausblick 2027']);
    expect(due.items.find((item) => item.id === lateId)?.href).toBe(
      `/lieferanten/${rel}/plan/zusagen#${lateId}`,
    );
    // Die eingetragene Person der anderen Seite bekommt nichts; gehaltene Zusagen verschwinden.
    const kam = dueListSchema.parse((await call(users.kam, 'GET', '/start/due')).body);
    expect(kam.items.filter((item) => item.kind === 'commitment')).toEqual([]);
  });

  it('Zusagen erscheinen live im Termin; die Agenda meldet sie bereit', async () => {
    const detail = meetingDetailSchema.parse(
      (await call(users.kam, 'GET', `/kunden/${rel}/termine/${meetingId}`)).body,
    );
    const section = detail.live.sections.find((entry) => entry.key === 'commitments');
    expect(section?.items.map((item) => [item.title, item.status])).toEqual([
      ['Zeichnungen freigeben', 'overdue'],
      ['Bedarfsausblick 2027', 'open'],
    ]);
    const prep = jbpPreparationSchema.parse((await call(users.sro, 'GET', buyer)).body);
    expect(prep.agenda.find((item) => item.section === 'commitments')?.ready).toBe(true);
  });

  it('bei Initiativen wählt jede Seite ihre Person; offene Meilensteine stehen auf ihrem Start', async () => {
    const created = initiativeDetailSchema.parse(
      (
        await call(users.sro, 'POST', `${buyer}/initiativen`, {
          title: 'Zweitquelle',
          goal: 'Sichern',
          benefitBuyer: 'A',
          benefitSupplier: 'B',
          ownerBuyerName: 'egal',
          ownerSupplierName: 'Kim Kaiser',
          ownerUserId: users.member,
          startsOn: '2099-01-01',
          endsOn: '2099-12-31',
        })
      ).body,
    );
    expect(created.initiative).toMatchObject({
      ownerBuyerName: 'Mia Mitglied',
      ownerBuyerUserId: users.member,
      ownerSupplierUserId: null,
    });
    const id = created.initiative.id;
    // Der Lieferant wählt seine Person; der Verantwortliche des Käufers bleibt, wie er ist.
    const changed = initiativeDetailSchema.parse(
      (
        await call(users.kam, 'PUT', `${supplier}/initiativen/${id}`, {
          title: 'Zweitquelle',
          goal: 'Sichern',
          benefitBuyer: 'A',
          benefitSupplier: 'B',
          ownerBuyerName: 'Überschrieben?',
          ownerSupplierName: 'egal',
          ownerUserId: users.kam,
          startsOn: '2099-01-01',
          endsOn: '2099-12-31',
        })
      ).body,
    );
    expect(changed.initiative).toMatchObject({
      ownerBuyerName: 'Mia Mitglied',
      ownerBuyerUserId: users.member,
      ownerSupplierName: 'Kim Kaiser',
      ownerSupplierUserId: users.kam,
    });
    await call(users.kam, 'POST', `${supplier}/initiativen/${id}/meilensteine`, {
      title: 'Muster frei',
      dueOn: '2099-03-15',
      doneOn: null,
    });
    for (const user of [users.member, users.kam]) {
      const due = dueListSchema.parse((await call(user, 'GET', '/start/due')).body);
      expect(
        due.items.filter((item) => item.kind === 'milestone').map((item) => item.detail),
      ).toEqual(['Muster frei']);
    }
    const sro = dueListSchema.parse((await call(users.sro, 'GET', '/start/due')).body);
    expect(sro.items.filter((item) => item.kind === 'milestone')).toEqual([]);
  });
});
