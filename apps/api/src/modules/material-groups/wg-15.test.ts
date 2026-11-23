import { randomUUID } from 'node:crypto';
import { type Database, schema, sql } from '@reziproq/db';
import {
  defaultSegmentCriteria,
  defaultSegmentTypes,
  lastFullYear,
  strategyContextResponseSchema,
  supplierMapSchema,
} from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';

// Tests zu docs/specs/WG-15.md (Supplier Map), je Kriterium aus „Fertig, wenn“.
describe('WG-15 Supplier Map', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const run = randomUUID().slice(0, 8);
  const orgs = { a: randomUUID(), s1: randomUUID(), s2: randomUUID(), s3: randomUUID() };
  const group = randomUUID();
  const rel = { big: randomUUID(), mid: randomUUID(), small: randomUUID() };
  const users = {
    lead: `wg15-lead-${run}`,
    buyer: `wg15-buyer-${run}`,
    reader: `wg15-reader-${run}`,
    sro: `wg15-sro-${run}`,
    supplier: `wg15-sup-${run}`,
  };
  let strategyId = '';
  let modelId = '';
  const year = lastFullYear();

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
  const base = () => `/warengruppen/strategien/${strategyId}/supplier-map`;
  const map = async (user = users.lead) =>
    supplierMapSchema.parse((await call(user, 'GET', base())).body);
  const put = (relationshipId: string, body: unknown, user = users.lead) =>
    call(user, 'PUT', `${base()}/${relationshipId}`, body);
  const stepState = async () =>
    strategyContextResponseSchema.parse(
      (await call(users.lead, 'GET', `/warengruppen/${group}/strategie?jahr=2031`)).body,
    ).context?.strategy.steps[8];
  const decisions = (relationshipId: string) =>
    db.execute<{ version: number; ist: string; soll: string; origin: string }>(sql`
      select version, ist_impact_level || '-' || ist_quality_level as ist,
        soll_impact_level || '-' || soll_quality_level as soll, origin
      from segment_decision where relationship_id = ${relationshipId} and scope = 'category'
      order by version`);

  beforeAll(async () => {
    testApp = await startTestApp();
    db = testApp.adminDb;
    await db.insert(schema.organization).values([
      { id: orgs.a, name: `WG15-A ${run}` },
      { id: orgs.s1, name: `WG15-Rheintal ${run}` },
      { id: orgs.s2, name: `WG15-Nordlicht ${run}` },
      { id: orgs.s3, name: `WG15-Klein ${run}` },
    ]);
    await db
      .insert(schema.organizationFeature)
      .values({ organizationId: orgs.a, feature: 'buyer' });
    const person = (id: string, organizationId: string, orgRole: 'admin' | 'member') => ({
      id,
      name: id,
      email: `${id}@example.com`,
      organizationId,
      orgRole,
      rolesImportedAt: new Date(),
    });
    await db
      .insert(schema.appUser)
      .values([
        person(users.lead, orgs.a, 'member'),
        person(users.buyer, orgs.a, 'member'),
        person(users.reader, orgs.a, 'member'),
        person(users.sro, orgs.a, 'member'),
        person(users.supplier, orgs.s1, 'admin'),
      ]);
    await insertRelationships(db, [
      { id: rel.big, buyer: orgs.a, supplier: orgs.s1 },
      { id: rel.mid, buyer: orgs.a, supplier: orgs.s2 },
      { id: rel.small, buyer: orgs.a, supplier: orgs.s3 },
    ]);
    await db
      .insert(schema.relationshipMember)
      .values({ relationshipId: rel.small, orgId: orgs.a, userId: users.sro, teamRole: 'sro' });
    await db.insert(schema.materialGroup).values({
      id: group,
      orgId: orgs.a,
      name: 'Leiterplatten',
      code: `LP-${run}`,
      leadUserId: users.lead,
    });
    await db.insert(schema.materialGroupMember).values([
      { orgId: orgs.a, materialGroupId: group, userId: users.lead, role: 'lead' },
      { orgId: orgs.a, materialGroupId: group, userId: users.buyer, role: 'buyer' },
    ]);
    await db.insert(schema.relationshipMaterialGroup).values([
      { relationshipId: rel.big, materialGroupId: group, isPrimary: true },
      { relationshipId: rel.mid, materialGroupId: group, isPrimary: true },
      { relationshipId: rel.small, materialGroupId: group, isPrimary: true },
    ]);
    // 60 %, 30 %, 10 %: einzeln gezeigt werden die ersten beiden (bis 80 % erreicht sind)
    await db.insert(schema.relationshipSpend).values([
      { relationshipId: rel.big, year, amountCents: 6_000_000, materialGroupId: group },
      { relationshipId: rel.mid, year, amountCents: 3_000_000, materialGroupId: group },
      { relationshipId: rel.small, year, amountCents: 1_000_000, materialGroupId: group },
      // Anderes Jahr zählt nicht
      { relationshipId: rel.small, year: year - 1, amountCents: 9_000_000, materialGroupId: group },
    ]);
    const [model] = await db
      .insert(schema.segmentModel)
      .values({
        orgId: orgs.a,
        version: 1,
        status: 'active',
        lowMax: 33,
        midMax: 66,
        activatedAt: new Date(),
      })
      .returning({ id: schema.segmentModel.id });
    if (!model) throw new Error('Modell fehlt');
    modelId = model.id;
    await db
      .insert(schema.segmentCriterion)
      .values(defaultSegmentCriteria.map((criterion) => ({ ...criterion, modelId })));
    await db
      .insert(schema.segmentType)
      .values(defaultSegmentTypes.map((type) => ({ ...type, modelId })));
    // Segment Ist und Soll aus der Segmentierung der Warengruppe (WG-18)
    const decision = (relationshipId: string, ist: [number, number], soll: [number, number]) => ({
      relationshipId,
      scope: 'category' as const,
      materialGroupId: group,
      istImpactLevel: ist[0],
      istQualityLevel: ist[1],
      sollImpactLevel: soll[0],
      sollQualityLevel: soll[1],
      reason: 'Runde',
      modelVersion: 1,
      decidedBy: users.lead,
      version: 1,
    });
    await db
      .insert(schema.segmentDecision)
      .values([decision(rel.big, [3, 2], [3, 3]), decision(rel.mid, [2, 2], [2, 2])]);
    strategyId = strategyContextResponseSchema.parse(
      (await call(users.lead, 'POST', `/warengruppen/${group}/strategie`, { year: 2031 })).body,
    ).context?.strategy.id as string;
  });

  afterAll(async () => {
    const orgIds = Object.values(orgs);
    await db.execute(sql`delete from material_group_strategy where org_id in ${orgIds}`);
    await db.execute(sql`delete from material_group_kpi where org_id in ${orgIds}`);
    await db.execute(sql`delete from material_group_question where org_id in ${orgIds}`);
    await deleteRelationships(db, orgIds);
    if (modelId) {
      await db.execute(sql`delete from segment_type where model_id = ${modelId}`);
      await db.execute(sql`delete from segment_criterion where model_id = ${modelId}`);
    }
    await db.execute(sql`delete from segment_model where org_id in ${orgIds}`);
    await db.execute(sql`delete from objective_category where org_id in ${orgIds}`);
    await db.execute(sql`delete from app_user where organization_id in ${orgIds}`);
    await db.execute(sql`delete from organization_feature where organization_id in ${orgIds}`);
    await db.execute(sql`delete from organization where id in ${orgIds}`);
    await testApp.close();
  });

  it('Umsatzanteil Ist stimmt mit dem Spend der Warengruppe überein und ist nicht änderbar', async () => {
    const before = await map();
    expect(before.totalCents).toBe(10_000_000);
    expect(before.rows.map((row) => [row.relationshipId, row.share])).toEqual([
      [rel.big, 0.6],
      [rel.mid, 0.3],
    ]);
    expect(before.rest.map((row) => [row.relationshipId, row.share])).toEqual([[rel.small, 0.1]]);
    expect(before.restShare).toBeCloseTo(0.1);
    // Ein mitgeschickter Ist-Anteil wird nicht übernommen
    const saved = await put(rel.big, {
      site: 'Werk Ulm',
      shareTarget: 50,
      targetYear: 2033,
      share: 0.9,
      amountCents: 1,
    });
    expect(saved.status).toBe(200);
    const row = supplierMapSchema.parse(saved.body).rows[0];
    expect(row).toMatchObject({
      share: 0.6,
      amountCents: 6_000_000,
      shareTarget: 50,
      site: 'Werk Ulm',
    });
  });

  it('Segment Ist ist auf dieser Seite nicht änderbar', async () => {
    const saved = await put(rel.big, {
      site: 'Werk Ulm',
      shareTarget: 50,
      targetYear: 2033,
      segmentTarget: { kind: 'segment', impactLevel: 2, qualityLevel: 3 },
      segmentIst: { impactLevel: 1, qualityLevel: 1 },
    });
    expect(saved.status).toBe(200);
    const row = supplierMapSchema.parse(saved.body).rows[0];
    expect(row?.segmentIst).toMatchObject({ impactLevel: 3, qualityLevel: 2 });
    expect(row?.segmentTarget).toMatchObject({ kind: 'segment', impactLevel: 2, qualityLevel: 3 });
    // Der Soll-Typ ist eine neue Version der Segmententscheidung; das Ist bleibt aus der Runde
    expect((await decisions(rel.big)).rows).toEqual([
      { version: 1, ist: '3-2', soll: '3-3', origin: 'round' },
      { version: 2, ist: '3-2', soll: '2-3', origin: 'manual' },
    ]);
    // Ohne Segment Ist aus der Segmentierung kein Soll-Typ
    const missing = await put(rel.small, {
      site: null,
      shareTarget: null,
      targetYear: 2032,
      segmentTarget: { kind: 'segment', impactLevel: 1, qualityLevel: 1 },
    });
    expect(missing).toMatchObject({ status: 409, body: { code: 'segment_ist_missing' } });
  });

  it('ein Soll-Wert ohne Zieljahr wird abgelehnt', async () => {
    const share = await put(rel.mid, { site: null, shareTarget: 30, targetYear: null });
    expect(share).toMatchObject({ status: 400, body: { code: 'target_year_required' } });
    const ended = await put(rel.mid, {
      site: null,
      shareTarget: null,
      targetYear: null,
      segmentTarget: { kind: 'ended' },
    });
    expect(ended).toMatchObject({ status: 400, body: { code: 'target_year_required' } });
    const past = await put(rel.mid, { site: null, shareTarget: 30, targetYear: 2030 });
    expect(past).toMatchObject({ status: 400, body: { code: 'target_year_past' } });
    expect((await map()).rows[1]?.shareTarget).toBeNull();
    // Nur Einkauf und Leitung im Team pflegen
    const reader = await put(
      rel.mid,
      { site: null, shareTarget: 30, targetYear: 2032 },
      users.reader,
    );
    expect(reader.status).toBe(404);
  });

  it('Schritt 9 ist fertig, wenn jeder einzeln gezeigte Lieferant Anteil Soll und Soll-Typ hat', async () => {
    expect(await stepState()).toBe('in_progress');
    expect((await map()).handoverRelationshipId).toBeNull();
    // Der zusammengefasste Rest zählt nicht
    const saved = await put(
      rel.mid,
      { site: null, shareTarget: 40, targetYear: 2033, segmentTarget: { kind: 'ended' } },
      users.buyer,
    );
    expect(saved.status).toBe(200);
    const done = supplierMapSchema.parse(saved.body);
    expect(done.rows[1]?.segmentTarget).toEqual({ kind: 'ended' });
    expect(done.rest[0]?.complete).toBe(false);
    expect(done.complete).toBe(true);
    expect(done.handoverRelationshipId).toBe(rel.big);
    expect(await stepState()).toBe('done');
    // „beenden“ schreibt keine Segmententscheidung
    expect((await decisions(rel.mid)).rows).toHaveLength(1);
  });

  it('kein Segmentname erscheint, der nicht in SEG eingestellt ist', async () => {
    await db.execute(
      sql`delete from segment_type where model_id = ${modelId} and impact_level = 3 and quality_level = 2`,
    );
    try {
      const seen = await map();
      const allowed = new Set(seen.segmentTypes.map((type) => type.name));
      expect(allowed.size).toBe(defaultSegmentTypes.length - 1);
      const names = [...seen.rows, ...seen.rest].flatMap((row) => [
        row.segmentIst?.name,
        row.segmentTarget?.kind === 'segment' ? row.segmentTarget.name : undefined,
      ]);
      for (const name of names.filter(Boolean)) expect(allowed.has(name as string)).toBe(true);
      // Das Ist 3-2 ist nicht mehr eingestellt und erscheint ohne Namen
      expect(seen.rows[0]?.segmentIst).toBeNull();
      const unknown = await put(rel.big, {
        site: null,
        shareTarget: 50,
        targetYear: 2033,
        segmentTarget: { kind: 'segment', impactLevel: 3, qualityLevel: 2 },
      });
      expect(unknown).toMatchObject({ status: 400, body: { code: 'segment_unknown' } });
    } finally {
      const type = defaultSegmentTypes.find((t) => t.impactLevel === 3 && t.qualityLevel === 2);
      if (type) await db.insert(schema.segmentType).values({ ...type, modelId });
    }
  });

  it('der Test-Lieferant sieht keine Supplier Map; der SRO sieht seine Zeile auch im Entwurf', async () => {
    const supplier = await call(users.supplier, 'GET', base());
    expect([403, 404]).toContain(supplier.status);
    expect(JSON.stringify(supplier.body)).not.toContain('Werk Ulm');
    // Käufer ohne Rolle sehen den Entwurf nicht, der SRO nur seine Zeile
    expect((await call(users.reader, 'GET', base())).status).toBe(404);
    const sro = await map(users.sro);
    expect(sro).toMatchObject({ restricted: true, canEdit: false, rest: [] });
    expect(sro.rows.map((row) => row.relationshipId)).toEqual([rel.small]);
    // Nach der Freigabe sehen alle Käufer mit Zugriff die ganze Map, ändern nichts
    await db
      .update(schema.materialGroupStrategy)
      .set({ status: 'approved', approvedAt: new Date() })
      .where(sql`id = ${strategyId}`);
    const approved = await map(users.reader);
    expect(approved).toMatchObject({ restricted: false, canEdit: false });
    expect(approved.rows).toHaveLength(2);
    const blocked = await put(rel.big, { site: null, shareTarget: 10, targetYear: 2033 });
    expect(blocked.status).toBe(403);
  });
});
