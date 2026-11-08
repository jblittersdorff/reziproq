import { randomUUID } from 'node:crypto';
import { and, type Database, eq, schema, sql } from '@reziproq/db';
import {
  defaultSegmentCriteria,
  defaultSegmentTypes,
  type OrgRole,
  type RoundDetail,
  roundCandidatesSchema,
  roundDetailSchema,
  roundListSchema,
} from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';

describe('SEG-03 Bewertungsrunden über die API', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const run = randomUUID().slice(0, 8);
  const orgs = { oem: randomUUID(), zweit: randomUUID() };
  const supplierOrgs = Array.from({ length: 10 }, () => randomUUID());
  const relationships = supplierOrgs.map(() => randomUUID());
  const users = {
    admin: `rnd-admin-${run}`,
    sro: `rnd-sro-${run}`,
    quality: `rnd-quality-${run}`,
    purchasing: `rnd-purchasing-${run}`,
    other: `rnd-other-${run}`,
    viewer: `rnd-viewer-${run}`,
    zweit: `rnd-zweit-${run}`,
    supplier: `rnd-supplier-${run}`,
  };
  const dueDate = '2099-12-31';
  let roundId = '';
  let unitA = '';
  let unitB = '';
  let group = '';

  const call = async (user: string, method: string, path: string, body?: unknown) => {
    const response = await fetch(`${testApp.baseUrl}/api${path}`, {
      method,
      headers: {
        authorization: `Bearer ${await testApp.signToken({ subject: user })}`,
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: (await response.json().catch(() => null)) as unknown };
  };

  const detail = async (user: string, id = roundId): Promise<RoundDetail> => {
    const response = await call(user, 'GET', `/rounds/${id}`);
    expect(response.status).toBe(200);
    return roundDetailSchema.parse(response.body);
  };

  const person = (
    id: string,
    role: OrgRole,
    organizationId: string,
    defaultFunction: 'purchasing' | 'quality' | null = null,
  ) => ({
    id,
    name: `Person ${id}`,
    givenName: 'Pat',
    email: `${id}@example.com`,
    organizationId,
    orgRole: role,
    defaultFunction,
    rolesImportedAt: new Date(),
  });

  const addModel = async (orgId: string, version: number, status: 'active' | 'retired') => {
    const [model] = await db
      .insert(schema.segmentModel)
      .values({ orgId, version, status, lowMax: 33, midMax: 66, activatedAt: new Date() })
      .returning({ id: schema.segmentModel.id });
    if (!model) throw new Error('Modell fehlt');
    await db
      .insert(schema.segmentCriterion)
      .values(defaultSegmentCriteria.map((criterion) => ({ ...criterion, modelId: model.id })));
    await db
      .insert(schema.segmentType)
      .values(defaultSegmentTypes.map((type) => ({ ...type, modelId: model.id })));
  };

  const invitations = () =>
    db
      .select({
        recipient: schema.outboxEvent.emailRecipient,
        title: schema.outboxEvent.emailTitle,
        link: schema.outboxEvent.emailLink,
        firstName: schema.outboxEvent.emailFirstName,
        deadline: schema.outboxEvent.emailDeadline,
      })
      .from(schema.outboxEvent)
      .where(
        and(
          eq(schema.outboxEvent.objectId, roundId),
          eq(schema.outboxEvent.emailTemplate, 'invitation'),
        ),
      );

  beforeAll(async () => {
    testApp = await startTestApp();
    db = testApp.adminDb;
    await db
      .insert(schema.organization)
      .values([
        { id: orgs.oem, name: `RND-OEM ${run}` },
        { id: orgs.zweit, name: `RND-Zweit ${run}` },
        ...supplierOrgs.map((id, index) => ({ id, name: `RND-Lieferant ${run} ${index + 1}` })),
      ]);
    await db.insert(schema.organizationFeature).values([
      { organizationId: orgs.oem, feature: 'buyer' },
      { organizationId: orgs.zweit, feature: 'buyer' },
    ]);
    await db
      .insert(schema.appUser)
      .values([
        person(users.admin, 'admin', orgs.oem),
        person(users.sro, 'member', orgs.oem),
        person(users.quality, 'member', orgs.oem, 'quality'),
        person(users.purchasing, 'member', orgs.oem, 'purchasing'),
        person(users.other, 'member', orgs.oem),
        person(users.viewer, 'viewer', orgs.oem),
        person(users.zweit, 'admin', orgs.zweit),
        person(users.supplier, 'admin', supplierOrgs[0] as string),
      ]);
    await insertRelationships(
      db,
      supplierOrgs.map((supplier, index) => ({
        id: relationships[index] as string,
        buyer: orgs.oem,
        supplier,
      })),
    );
    const units = await db
      .insert(schema.businessUnit)
      .values([
        { orgId: orgs.oem, name: 'Antrieb', code: `A-${run}` },
        { orgId: orgs.oem, name: 'Karosserie', code: `B-${run}` },
      ])
      .returning({ id: schema.businessUnit.id });
    unitA = units[0]?.id as string;
    unitB = units[1]?.id as string;
    const [materialGroup] = await db
      .insert(schema.materialGroup)
      .values({ orgId: orgs.oem, name: 'Stahl', code: `S-${run}` })
      .returning({ id: schema.materialGroup.id });
    group = materialGroup?.id as string;
    await db
      .insert(schema.relationshipBusinessUnit)
      .values(relationships.map((id) => ({ relationshipId: id, businessUnitId: unitA })));
    await db.insert(schema.relationshipMaterialGroup).values(
      relationships.map((id) => ({
        relationshipId: id,
        materialGroupId: group,
        isPrimary: true,
      })),
    );
    await db.insert(schema.relationshipMember).values([
      {
        relationshipId: relationships[0] as string,
        orgId: orgs.oem,
        userId: users.sro,
        teamRole: 'sro',
        function: 'engineering',
      },
      {
        relationshipId: relationships[0] as string,
        orgId: orgs.oem,
        userId: users.quality,
        teamRole: 'member',
        function: 'quality',
      },
      {
        relationshipId: relationships[1] as string,
        orgId: orgs.oem,
        userId: users.other,
        teamRole: 'sro',
      },
    ]);
    await addModel(orgs.oem, 3, 'active');
    await addModel(orgs.zweit, 1, 'active');
  });

  afterAll(async () => {
    await deleteRelationships(db, [...Object.values(orgs), ...supplierOrgs]);
    await db
      .delete(schema.segmentModel)
      .where(sql`${schema.segmentModel.orgId} in ${Object.values(orgs)}`);
    await db.delete(schema.appUser).where(sql`${schema.appUser.id} in ${Object.values(users)}`);
    await db
      .delete(schema.organization)
      .where(sql`${schema.organization.id} in ${[...Object.values(orgs), ...supplierOrgs]}`);
    await testApp.close();
  });

  it('eine Runde für zehn Lieferanten lässt sich in einem Ablauf starten', async () => {
    const created = await call(users.admin, 'POST', '/rounds', { name: 'Runde 2099', dueDate });
    expect(created.status).toBe(201);
    roundId = roundDetailSchema.parse(created.body).id;

    const candidates = roundCandidatesSchema.parse(
      (await call(users.admin, 'GET', `/rounds/${roundId}/candidates`)).body,
    );
    expect(candidates.candidates).toHaveLength(10);
    expect(candidates.candidates.every((candidate) => !candidate.selected)).toBe(true);
    expect(candidates.candidates[0]?.businessUnits.map((unit) => unit.name)).toEqual(['Antrieb']);

    const picked = await call(users.admin, 'PUT', `/rounds/${roundId}/suppliers`, {
      relationshipIds: relationships,
    });
    expect(picked.status).toBe(200);
    const draft = roundDetailSchema.parse(picked.body);
    expect(draft.status).toBe('draft');
    expect(draft.suppliers).toHaveLength(10);

    const started = await call(users.admin, 'POST', `/rounds/${roundId}/start`);
    expect(started.status).toBe(201);
    const open = roundDetailSchema.parse(started.body);
    expect(open.status).toBe('open');
    expect(open.suppliers).toHaveLength(10);
    expect(open.total).toBe(open.suppliers.reduce((sum, supplier) => sum + supplier.total, 0));
  });

  it('die Auswahl bleibt als Entwurf erhalten, auch beim Zurückgehen', async () => {
    const created = roundDetailSchema.parse(
      (await call(users.admin, 'POST', '/rounds', { name: 'Entwurf', dueDate })).body,
    );
    await call(users.admin, 'PUT', `/rounds/${created.id}/suppliers`, {
      relationshipIds: relationships.slice(0, 3),
    });
    const renamed = await call(users.admin, 'PATCH', `/rounds/${created.id}`, {
      name: 'Entwurf neu',
      dueDate: '2099-11-30',
    });
    expect(renamed.status).toBe(200);
    const back = roundCandidatesSchema.parse(
      (await call(users.admin, 'GET', `/rounds/${created.id}/candidates`)).body,
    );
    expect(back.candidates.filter((candidate) => candidate.selected)).toHaveLength(3);
    const again = await detail(users.admin, created.id);
    expect(again.name).toBe('Entwurf neu');
    expect(again.dueDate).toBe('2099-11-30');
    expect(again.suppliers).toHaveLength(3);

    await call(users.admin, 'PUT', `/rounds/${created.id}/suppliers`, {
      relationshipIds: relationships.slice(0, 2),
    });
    expect((await detail(users.admin, created.id)).suppliers).toHaveLength(2);
    expect(
      (
        await call(users.admin, 'PUT', `/rounds/${created.id}/suppliers`, {
          relationshipIds: [randomUUID()],
        })
      ).status,
    ).toBe(400);
  });

  it('Vorschläge kommen aus Team und Standardfunktion und lassen sich ändern', async () => {
    const created = roundDetailSchema.parse(
      (await call(users.admin, 'POST', '/rounds', { name: 'Vorschläge', dueDate })).body,
    );
    const picked = roundDetailSchema.parse(
      (
        await call(users.admin, 'PUT', `/rounds/${created.id}/suppliers`, {
          relationshipIds: [relationships[0], relationships[5]],
        })
      ).body,
    );
    const byName = (name: string) =>
      picked.suppliers.find((supplier) => supplier.name.endsWith(name));
    const fromTeam = byName('1');
    expect(fromTeam?.assignments.map((entry) => [entry.function, entry.rater?.id]).sort()).toEqual([
      ['engineering', users.sro],
      ['quality', users.quality],
    ]);
    const fromDefault = byName('6');
    expect(
      fromDefault?.assignments.map((entry) => [entry.function, entry.rater?.id]).sort(),
    ).toEqual([
      ['purchasing', users.purchasing],
      ['quality', users.quality],
    ]);

    const target = fromDefault?.assignments[0];
    const changed = await call(
      users.admin,
      'PATCH',
      `/rounds/${created.id}/assignments/${target?.id}`,
      { raterUserId: users.other },
    );
    expect(changed.status).toBe(200);
    const updated = roundDetailSchema.parse(changed.body);
    expect(
      updated.suppliers
        .flatMap((supplier) => supplier.assignments)
        .find((entry) => entry.id === target?.id)?.rater?.id,
    ).toBe(users.other);
    expect(
      (
        await call(users.admin, 'PATCH', `/rounds/${created.id}/assignments/${target?.id}`, {
          raterUserId: users.zweit,
        })
      ).status,
    ).toBe(400);
  });

  it('beim Start gibt es genau eine Mail je bewertender Person, nur mit Titel und Link', async () => {
    const mails = await invitations();
    const raters = new Set(
      (await detail(users.admin)).suppliers.flatMap((supplier) =>
        supplier.assignments.map((entry) => entry.rater?.id),
      ),
    );
    expect(raters).toEqual(new Set([users.sro, users.quality, users.purchasing]));
    expect(mails).toHaveLength(raters.size);
    expect(new Set(mails.map((mail) => mail.recipient)).size).toBe(raters.size);
    for (const mail of mails) {
      expect(mail.title).toBe('Runde 2099');
      expect(mail.link).toBe('/bewertungen');
      expect(mail.deadline).toBe(dueDate);
      expect(mail.firstName).toBe('Pat');
    }
  });

  it('die Runde speichert die beim Start aktive Modellversion', async () => {
    expect((await detail(users.admin)).modelVersion).toBe(3);
    await db
      .update(schema.segmentModel)
      .set({ status: 'retired' })
      .where(
        and(eq(schema.segmentModel.orgId, orgs.oem), eq(schema.segmentModel.status, 'active')),
      );
    await addModel(orgs.oem, 4, 'active');
    expect((await detail(users.admin)).modelVersion).toBe(3);
  });

  it('nur Admins starten Runden; ein SRO nominiert nur für seine Lieferanten nach', async () => {
    const draft = roundDetailSchema.parse(
      (await call(users.admin, 'POST', '/rounds', { name: 'Nur Admin', dueDate })).body,
    );
    for (const user of [users.sro, users.viewer, users.supplier]) {
      expect((await call(user, 'POST', `/rounds/${draft.id}/start`)).status, user).toBe(403);
    }
    expect((await call(users.sro, 'POST', '/rounds', { name: 'x', dueDate })).status).toBe(403);

    const before = (await invitations()).length;
    const own = {
      relationshipId: relationships[0],
      businessUnitId: unitA,
      materialGroupId: group,
      function: 'logistics',
      raterUserId: users.other,
    };
    const nominated = await call(users.sro, 'POST', `/rounds/${roundId}/assignments`, own);
    expect(nominated.status).toBe(201);
    expect(
      roundDetailSchema
        .parse(nominated.body)
        .suppliers.find((supplier) => supplier.relationshipId === relationships[0])
        ?.assignments.some((entry) => entry.rater?.id === users.other),
    ).toBe(true);
    expect((await invitations()).length).toBe(before + 1);
    expect((await call(users.sro, 'POST', `/rounds/${roundId}/assignments`, own)).status).toBe(409);

    const foreign = await call(users.sro, 'POST', `/rounds/${roundId}/assignments`, {
      ...own,
      relationshipId: relationships[3],
    });
    expect(foreign.status).toBe(403);
    expect(
      (
        await call(users.sro, 'POST', `/rounds/${roundId}/assignments`, {
          ...own,
          businessUnitId: unitB,
          function: 'programs',
        })
      ).status,
    ).toBe(400);
  });

  it('Sichtbarkeit: Admin alles, SRO seine Lieferanten, andere nur eigene Einladungen', async () => {
    const admin = await detail(users.admin);
    expect(admin.canManage).toBe(true);
    expect(admin.suppliers).toHaveLength(10);

    const sro = await detail(users.sro);
    expect(sro.canManage).toBe(false);
    expect(sro.suppliers.map((supplier) => supplier.relationshipId)).toEqual([relationships[0]]);
    expect(sro.suppliers[0]?.canNominate).toBe(true);

    const purchasing = await detail(users.purchasing);
    expect(purchasing.suppliers).toHaveLength(9);
    expect(
      purchasing.suppliers
        .flatMap((supplier) => supplier.assignments)
        .every((entry) => entry.rater?.id === users.purchasing),
    ).toBe(true);
    expect(purchasing.suppliers.every((supplier) => !supplier.canNominate)).toBe(true);

    expect((await call(users.viewer, 'GET', `/rounds/${roundId}`)).status).toBe(404);
    expect(roundListSchema.parse((await call(users.viewer, 'GET', '/rounds')).body).rounds).toEqual(
      [],
    );
    expect((await call(users.supplier, 'GET', '/rounds')).status).toBe(403);
  });

  it('eine geschlossene Runde nimmt keine Bewertungen und Zuordnungen mehr an', async () => {
    expect((await call(users.other, 'POST', `/rounds/${roundId}/close`)).status).toBe(403);
    const extended = await call(users.admin, 'POST', `/rounds/${roundId}/extend`, {
      dueDate: '2100-01-31',
    });
    expect(extended.status).toBe(201);
    expect(roundDetailSchema.parse(extended.body).dueDate).toBe('2100-01-31');
    expect(
      (await call(users.admin, 'POST', `/rounds/${roundId}/extend`, { dueDate: '2100-01-01' }))
        .status,
    ).toBe(400);

    const closed = await call(users.admin, 'POST', `/rounds/${roundId}/close`);
    expect(closed.status).toBe(201);
    expect(roundDetailSchema.parse(closed.body).status).toBe('closed');
    expect(
      (await call(users.admin, 'POST', `/rounds/${roundId}/extend`, { dueDate: '2100-02-28' }))
        .status,
    ).toBe(409);
    expect(
      (
        await call(users.admin, 'POST', `/rounds/${roundId}/assignments`, {
          relationshipId: relationships[0],
          businessUnitId: unitA,
          materialGroupId: null,
          function: 'programs',
          raterUserId: users.other,
        })
      ).status,
    ).toBe(409);
    await expect(
      db
        .update(schema.ratingAssignment)
        .set({ status: 'submitted' })
        .where(eq(schema.ratingAssignment.roundId, roundId)),
    ).rejects.toThrow();
  });

  it('der Zweit-OEM sieht keine Runde des Test-OEM', async () => {
    expect(roundListSchema.parse((await call(users.zweit, 'GET', '/rounds')).body).rounds).toEqual(
      [],
    );
    expect((await call(users.zweit, 'GET', `/rounds/${roundId}`)).status).toBe(404);
    expect((await call(users.zweit, 'POST', `/rounds/${roundId}/start`)).status).toBe(404);
    expect((await call(users.zweit, 'POST', `/rounds/${roundId}/close`)).status).toBe(404);
    expect(
      (await call(users.zweit, 'PUT', `/rounds/${roundId}/suppliers`, { relationshipIds: [] }))
        .status,
    ).toBe(404);
  });
});
