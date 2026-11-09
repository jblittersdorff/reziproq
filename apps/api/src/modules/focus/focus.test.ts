import { randomUUID } from 'node:crypto';
import { type Database, schema, sql } from '@reziproq/db';
import {
  defaultSegmentCriteria,
  defaultSegmentTypes,
  focusDetailSchema,
  focusListSchema,
  lastFullYear,
  supplierOverviewSchema,
} from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';
import { suggestFocus } from './suggest.js';

describe('SEG-02 Fokuslieferanten über die API', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const run = randomUUID().slice(0, 8);
  const orgs = { oem: randomUUID(), zweit: randomUUID() };
  // Spend 1, 2, 3 und 4 Mio.: bei 80 % gehören die drei größten zum Spend-Anteil.
  const suppliers = Array.from({ length: 4 }, () => ({ org: randomUUID(), id: randomUUID() }));
  const [small, second, third, large] = suppliers as [
    (typeof suppliers)[number],
    (typeof suppliers)[number],
    (typeof suppliers)[number],
    (typeof suppliers)[number],
  ];
  const users = {
    admin: `fk-admin-${run}`,
    member: `fk-member-${run}`,
    zweit: `fk-zweit-${run}`,
    supplier: `fk-sup-${run}`,
  };
  const year = lastFullYear();

  const call = async (user: string, method: string, path: string, body?: unknown) => {
    const response = await fetch(`${testApp.baseUrl}/api${path}`, {
      method,
      headers: {
        authorization: `Bearer ${await testApp.signToken({ subject: user })}`,
        'content-type': 'application/json',
      },
      ...(body !== undefined && { body: JSON.stringify(body) }),
    });
    return { status: response.status, body: (await response.json().catch(() => null)) as unknown };
  };
  const person = (id: string, role: 'admin' | 'member', organizationId: string) => ({
    id,
    name: `Person ${id}`,
    givenName: 'Pat',
    email: `${id}@example.com`,
    organizationId,
    orgRole: role,
    rolesImportedAt: new Date(),
  });
  const list = async (user: string) =>
    focusListSchema.parse((await call(user, 'GET', '/portfolio/fokus')).body);

  beforeAll(async () => {
    testApp = await startTestApp();
    db = testApp.adminDb;
    await db.insert(schema.organization).values([
      { id: orgs.oem, name: `FK-OEM ${run}` },
      { id: orgs.zweit, name: `FK-Zweit ${run}` },
      ...suppliers.map((entry, index) => ({
        id: entry.org,
        name: `FK-Lieferant ${index} ${run}`,
      })),
    ]);
    await db.insert(schema.organizationFeature).values([
      { organizationId: orgs.oem, feature: 'buyer' },
      { organizationId: orgs.zweit, feature: 'buyer' },
    ]);
    await db
      .insert(schema.appUser)
      .values([
        person(users.admin, 'admin', orgs.oem),
        person(users.member, 'member', orgs.oem),
        person(users.zweit, 'admin', orgs.zweit),
        person(users.supplier, 'admin', large.org),
      ]);
    await insertRelationships(
      db,
      suppliers.map((entry, index) => ({
        id: entry.id,
        buyer: orgs.oem,
        supplier: entry.org,
        spend: [{ year, amountCents: (index + 1) * 1_000_000 }],
      })),
    );
    const [model] = await db
      .insert(schema.segmentModel)
      .values({
        orgId: orgs.oem,
        version: 1,
        status: 'active',
        lowMax: 33,
        midMax: 66,
        activatedAt: new Date(),
      })
      .returning({ id: schema.segmentModel.id });
    if (!model) throw new Error('Modell fehlt');
    await db
      .insert(schema.segmentCriterion)
      .values(defaultSegmentCriteria.map((criterion) => ({ ...criterion, modelId: model.id })));
    await db
      .insert(schema.segmentType)
      .values(defaultSegmentTypes.map((type) => ({ ...type, modelId: model.id })));
    // Hoher Business Impact im Soll: der kleinste Lieferant (nur dieser Grund) und der zweite (beide Gründe).
    await db.insert(schema.segmentDecision).values(
      [small, second].map((entry) => ({
        relationshipId: entry.id,
        scope: 'total' as const,
        businessUnitId: null,
        materialGroupId: null,
        istImpactLevel: 2,
        istQualityLevel: 2,
        sollImpactLevel: 3,
        sollQualityLevel: 3,
        reason: 'Test',
        modelVersion: 1,
        decidedBy: users.admin,
        version: 1,
      })),
    );
  });

  afterAll(async () => {
    await deleteRelationships(db, [...Object.values(orgs), ...suppliers.map((entry) => entry.org)]);
    await db.delete(schema.segmentModel).where(sql`${schema.segmentModel.orgId} = ${orgs.oem}`);
    await db.delete(schema.appUser).where(sql`${schema.appUser.id} in ${Object.values(users)}`);
    await db
      .delete(schema.organization)
      .where(
        sql`${schema.organization.id} in ${[...Object.values(orgs), ...suppliers.map((s) => s.org)]}`,
      );
    await testApp.close();
  });

  it('der Vorschlag nennt die richtigen Lieferanten und den richtigen Grund', async () => {
    const { suggestions, focus } = await list(users.member);
    expect(focus).toEqual([]);
    const reasons = new Map(suggestions.map((entry) => [entry.relationshipId, entry.reasons]));
    expect(reasons.get(large.id)).toEqual(['spend_share']);
    expect(reasons.get(third.id)).toEqual(['spend_share']);
    expect(reasons.get(second.id)).toEqual(['spend_share', 'target_type']);
    expect(reasons.get(small.id)).toEqual(['target_type']);
    const top = suggestions[0];
    expect(top?.relationshipId).toBe(large.id);
    expect(top?.sharePercent).toBe(40);
    expect(suggestions.find((entry) => entry.relationshipId === small.id)?.soll?.impactLevel).toBe(
      3,
    );
  });

  it('kein Lieferant wird ohne Klick eines Admins Fokuslieferant', async () => {
    await list(users.admin);
    const rows = await db
      .select({ id: schema.relationshipSide.id })
      .from(schema.relationshipSide)
      .where(
        sql`${schema.relationshipSide.isFocus} and ${schema.relationshipSide.orgId} = ${orgs.oem}`,
      );
    expect(rows).toEqual([]);
    const denied = await call(users.member, 'PUT', `/portfolio/fokus/${large.id}`, {
      isFocus: true,
      reason: 'Darf ich nicht',
    });
    expect(denied.status).toBe(403);
    expect((await list(users.member)).focus).toEqual([]);
  });

  it('ohne Begründung lässt sich der Fokus nicht setzen und nicht entfernen', async () => {
    for (const body of [
      { isFocus: true, reason: '' },
      { isFocus: true, reason: '   ' },
      { isFocus: false },
    ]) {
      expect((await call(users.admin, 'PUT', `/portfolio/fokus/${large.id}`, body)).status).toBe(
        400,
      );
    }
    expect((await list(users.admin)).focus).toEqual([]);
  });

  it('ein Admin setzt und entfernt den Fokus mit Begründung, beides steht im internen Verlauf', async () => {
    const set = await call(users.admin, 'PUT', `/portfolio/fokus/${second.id}`, {
      isFocus: true,
      reason: 'Strategischer Partner',
    });
    expect(set.status).toBe(200);
    const detail = focusDetailSchema.parse(set.body);
    expect(detail).toMatchObject({
      isFocus: true,
      reason: 'Strategischer Partner',
      setBy: `Person ${users.admin}`,
      spendCents: 2_000_000,
      sharePercent: 20,
    });
    const after = await list(users.member);
    expect(after.focus.map((entry) => entry.relationshipId)).toEqual([second.id]);
    expect(after.focus[0]?.reason).toBe('Strategischer Partner');
    expect(after.suggestions.map((entry) => entry.relationshipId)).not.toContain(second.id);

    const activeCycles = async () =>
      db
        .select({ id: schema.cycle.id })
        .from(schema.cycle)
        .where(
          sql`${schema.cycle.relationshipId} = ${second.id} and ${schema.cycle.status} = 'active'`,
        );
    expect(await activeCycles()).toHaveLength(1);
    await db.delete(schema.cycle).where(sql`${schema.cycle.relationshipId} = ${second.id}`);
    expect((await call(users.admin, 'POST', `/suppliers/${second.id}/cycle`)).status).toBe(201);
    expect(await activeCycles()).toHaveLength(1);
    expect((await call(users.admin, 'POST', `/suppliers/${second.id}/cycle`)).status).toBe(201);
    expect(await activeCycles()).toHaveLength(1);
    expect((await call(users.member, 'POST', `/suppliers/${second.id}/cycle`)).status).toBe(403);
    await db.insert(schema.relationshipMember).values({
      relationshipId: second.id,
      orgId: orgs.oem,
      userId: users.member,
      teamRole: 'sro',
    });
    expect((await call(users.member, 'POST', `/suppliers/${second.id}/cycle`)).status).toBe(201);
    await db
      .delete(schema.relationshipMember)
      .where(sql`${schema.relationshipMember.relationshipId} = ${second.id}`);
    expect((await call(users.admin, 'POST', `/suppliers/${small.id}/cycle`)).status).toBe(409);

    const workspace = supplierOverviewSchema.parse(
      (await call(users.admin, 'GET', `/suppliers/${second.id}/overview`)).body,
    );
    expect(workspace.cycle?.steps).toMatchObject([
      { key: 'segment', status: 'completed' },
      { key: 'feedback', status: 'unavailable' },
      { key: 'touchpoints', status: 'unavailable' },
      { key: 'supplierPlan', status: 'open' },
      // JBP-06: Der Schritt Gemeinsamer Plan ist gebaut; ohne Plan ist er offen.
      { key: 'jbp', status: 'open' },
      // JBP-07: Die Scorecard ist gebaut; ohne Plan ist der Schritt offen.
      { key: 'scorecard', status: 'open' },
      { key: 'execution', status: 'unavailable' },
    ]);
    expect((await call(users.supplier, 'GET', `/suppliers/${second.id}/overview`)).status).toBe(
      403,
    );

    const removed = await call(users.admin, 'PUT', `/portfolio/fokus/${second.id}`, {
      isFocus: false,
      reason: 'Spend gesunken',
    });
    expect(focusDetailSchema.parse(removed.body).isFocus).toBe(false);
    expect((await list(users.admin)).focus).toEqual([]);
    expect(
      supplierOverviewSchema.parse(
        (await call(users.admin, 'GET', `/suppliers/${second.id}/overview`)).body,
      ).cycle,
    ).toBeNull();

    const events = await db
      .select({
        visibility: schema.auditEvent.visibility,
        changes: schema.auditEvent.changes,
      })
      .from(schema.auditEvent)
      .where(
        sql`${schema.auditEvent.objectType} = 'relationship_side' and ${schema.auditEvent.objectId} = ${second.id}`,
      );
    expect(events).toHaveLength(2);
    expect(events.every((event) => event.visibility === 'internal')).toBe(true);
    expect(JSON.stringify(events.map((event) => event.changes))).toContain('Spend gesunken');
  });

  it('der Lieferant sieht das Feld nie, andere Käufer auch nicht', async () => {
    await call(users.admin, 'PUT', `/portfolio/fokus/${large.id}`, {
      isFocus: true,
      reason: 'Wichtig',
    });
    expect((await call(users.supplier, 'GET', '/portfolio/fokus')).status).toBe(403);
    expect((await call(users.supplier, 'GET', `/portfolio/fokus/${large.id}`)).status).toBe(403);
    const asSupplier = await call(users.supplier, 'GET', `/suppliers/${large.id}`);
    expect((asSupplier.body as { isFocus?: boolean } | null)?.isFocus ?? false).toBe(false);
    const other = await call(users.zweit, 'GET', `/portfolio/fokus/${large.id}`);
    expect(other.status).toBe(404);
    expect((await list(users.zweit)).focus).toEqual([]);
    const detail = await call(users.admin, 'GET', `/suppliers/${large.id}`);
    expect((detail.body as { isFocus: boolean }).isFocus).toBe(true);
  });
});

describe('suggestFocus', () => {
  const candidate = (
    relationshipId: string,
    spendCents: number,
    sollImpact: number | null = null,
  ) => ({
    relationshipId,
    spendCents,
    currency: 'EUR',
    sollImpact,
  });

  it('nimmt die größten, bis der Anteil erreicht ist', () => {
    const result = suggestFocus(
      [candidate('a', 50), candidate('b', 30), candidate('c', 15), candidate('d', 5)],
      80,
      new Set(),
    );
    expect([...result.keys()]).toEqual(['a', 'b']);
  });

  it('ohne Spend entsteht kein Vorschlag nach Spend, und Fokus wird nicht erneut vorgeschlagen', () => {
    const result = suggestFocus([candidate('a', 0, 3), candidate('b', 10, 3)], 80, new Set(['b']));
    expect([...result.entries()]).toEqual([['a', ['target_type']]]);
  });

  it('rechnet Währungen getrennt', () => {
    const result = suggestFocus(
      [candidate('a', 100), { ...candidate('b', 10), currency: 'USD' }],
      80,
      new Set(),
    );
    expect([...result.keys()].sort()).toEqual(['a', 'b']);
  });
});
