import { randomUUID } from 'node:crypto';
import { type Database, schema, sql } from '@reziproq/db';
import {
  defaultSegmentCriteria,
  defaultSegmentTypes,
  playbookCatalogSchema,
  ruleSetProposalSchema,
  ruleSetResponseSchema,
} from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';

// Tests zu docs/specs/PLB-03.md über die API: Vorschlag, Begründung, Versionen, Soll-Typ.
describe('PLB-03 Spielregeln je Beziehung über die API', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const run = randomUUID().slice(0, 8);
  const orgs = { oem: randomUUID(), supplier: randomUUID() };
  const rel = randomUUID();
  const users = {
    admin: `plb3-admin-${run}`,
    sro: `plb3-sro-${run}`,
    member: `plb3-member-${run}`,
    supplier: `plb3-sup-${run}`,
  };
  const path = `/suppliers/${rel}/spielregeln`;

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
  const state = async (user = users.sro) =>
    ruleSetResponseSchema.parse((await call(user, 'GET', path)).body);

  let decisionVersion = 0;
  const decide = async (impact: number, quality: number) => {
    decisionVersion += 1;
    await db.insert(schema.segmentDecision).values({
      relationshipId: rel,
      scope: 'total',
      istImpactLevel: impact,
      istQualityLevel: quality,
      sollImpactLevel: impact,
      sollQualityLevel: quality,
      reason: 'Test',
      modelVersion: 1,
      decidedBy: users.admin,
      version: decisionVersion,
    });
  };

  beforeAll(async () => {
    testApp = await startTestApp();
    db = testApp.adminDb;
    await db.insert(schema.organization).values([
      { id: orgs.oem, name: `PLB3-OEM ${run}` },
      { id: orgs.supplier, name: `PLB3-Lieferant ${run}` },
    ]);
    await db
      .insert(schema.organizationFeature)
      .values({ organizationId: orgs.oem, feature: 'buyer' });
    const person = (id: string, orgRole: 'admin' | 'member', organizationId: string) => ({
      id,
      name: id === users.sro ? 'Sara Ost' : id,
      email: `${id}@example.com`,
      organizationId,
      orgRole,
      rolesImportedAt: new Date(),
    });
    await db
      .insert(schema.appUser)
      .values([
        person(users.admin, 'admin', orgs.oem),
        person(users.sro, 'member', orgs.oem),
        person(users.member, 'member', orgs.oem),
        person(users.supplier, 'admin', orgs.supplier),
      ]);
    await insertRelationships(db, [{ id: rel, buyer: orgs.oem, supplier: orgs.supplier }]);
    await db.insert(schema.relationshipMember).values({
      relationshipId: rel,
      orgId: orgs.oem,
      userId: users.sro,
      teamRole: 'sro',
    });
    const modelId = randomUUID();
    await db.insert(schema.segmentModel).values({
      id: modelId,
      orgId: orgs.oem,
      version: 1,
      status: 'active',
      lowMax: 33,
      midMax: 66,
      activatedAt: new Date(),
    });
    await db
      .insert(schema.segmentCriterion)
      .values(defaultSegmentCriteria.map((criterion) => ({ ...criterion, modelId })));
    await db
      .insert(schema.segmentType)
      .values(defaultSegmentTypes.map((type) => ({ ...type, modelId })));
  });

  afterAll(async () => {
    await deleteRelationships(db, Object.values(orgs));
    for (const table of ['rule_catalog_item', 'format_catalog_item', 'catalog_setup']) {
      await db.execute(sql`delete from ${sql.identifier(table)} where org_id = ${orgs.oem}`);
    }
    await db.execute(sql`delete from segment_model where org_id = ${orgs.oem}`);
    await db.execute(sql`delete from app_user where organization_id in ${Object.values(orgs)}`);
    await db.execute(sql`delete from organization_feature where organization_id = ${orgs.oem}`);
    await db.execute(sql`delete from organization where id in ${Object.values(orgs)}`);
    await testApp.close();
  });

  it('ohne konsolidierten Soll-Typ gibt es keinen Vorschlag', async () => {
    const data = await state();
    expect(data).toMatchObject({
      current: null,
      target: null,
      targetChanged: false,
      canManage: true,
    });
    expect((await call(users.sro, 'POST', path)).status).toBe(409);
  });

  it('der Vorschlag enthält genau die Katalogeinträge für den Soll-Typ', async () => {
    await decide(2, 2);
    const proposal = ruleSetProposalSchema.parse(
      (await call(users.sro, 'GET', `${path}/vorschlag`)).body,
    );
    const catalog = playbookCatalogSchema.parse((await call(users.admin, 'GET', '/playbook')).body);
    const expected = [
      ...catalog.rules.filter((rule) => rule.minImpactLevel <= 2).map((rule) => rule.id),
      ...catalog.formats
        .filter(
          (format) =>
            format.minImpactLevel <= 2 &&
            (format.forQualityLevels.length === 0 || format.forQualityLevels.includes(2)),
        )
        .map((format) => format.id),
    ];
    expect(proposal.items.map((item) => item.catalogItemId).sort()).toEqual(expected.sort());
    expect(proposal.target.typeName).toBe(
      defaultSegmentTypes.find((type) => type.impactLevel === 2 && type.qualityLevel === 2)?.name,
    );
  });

  it('Vorschlag übernehmen legt einen internen Entwurf an; ein zweites Mal geht nicht', async () => {
    const { status, body } = await call(users.sro, 'POST', path);
    expect(status).toBe(201);
    const data = ruleSetResponseSchema.parse(body);
    expect(data.current).toMatchObject({
      version: 1,
      status: 'draft',
      visibility: 'internal',
      removed: [],
    });
    expect(data.current?.items.every((item) => item.origin === 'catalog')).toBe(true);
    expect((await call(users.sro, 'POST', path)).status).toBe(409);
  });

  it('ohne Begründung lässt sich eine Abweichung nicht speichern', async () => {
    const current = (await state()).current;
    const [dropped, ...kept] = current?.items ?? [];
    const withoutReason = await call(users.sro, 'PUT', path, {
      selected: kept.map((item) => item.catalogItemId),
      removedReasons: {},
      custom: [],
    });
    expect(withoutReason.status).toBe(400);
    expect(withoutReason.body).toMatchObject({
      code: 'reason_required',
      items: [dropped?.catalogItemId],
    });
    const customWithoutReason = await call(users.sro, 'PUT', path, {
      selected: current?.items.map((item) => item.catalogItemId),
      removedReasons: {},
      custom: [
        {
          kind: 'right',
          group: 'growth',
          title: 'Messe',
          description: '',
          cadence: null,
          reason: '',
        },
      ],
    });
    expect(customWithoutReason.status).toBe(400);
  });

  it('mit Begründung wird gespeichert; die Begründung sieht nur der Käufer', async () => {
    const current = (await state()).current;
    const [dropped, ...kept] = current?.items ?? [];
    const { status, body } = await call(users.sro, 'PUT', path, {
      selected: kept.map((item) => item.catalogItemId),
      removedReasons: { [dropped?.catalogItemId as string]: 'Passt nicht zu diesem Lieferanten.' },
      custom: [
        {
          kind: 'format',
          group: null,
          title: 'Werksbesuch',
          description: 'Einmal im Jahr vor Ort.',
          cadence: 'annual',
          reason: 'Wichtig für die Qualität.',
        },
      ],
    });
    expect(status).toBe(200);
    const data = ruleSetResponseSchema.parse(body);
    expect(data.current?.version).toBe(1);
    expect(data.current?.removed).toEqual([
      {
        item: expect.objectContaining({ catalogItemId: dropped?.catalogItemId }),
        reason: 'Passt nicht zu diesem Lieferanten.',
      },
    ]);
    expect(data.current?.items.find((item) => item.origin === 'custom')).toMatchObject({
      kind: 'format',
      cadence: 'annual',
      title: { de: 'Werksbesuch', en: 'Werksbesuch' },
      reason: 'Wichtig für die Qualität.',
    });
    // Die Begründungen liegen buyer_private; der Lieferant sieht in keinem Kontext eine.
    const notes = await testApp.adminDb.execute(
      sql`select count(*)::int as n from rule_set_note where relationship_id = ${rel}`,
    );
    expect((notes.rows[0] as { n: number }).n).toBe(2);
  });

  it('nur Admin und SRO legen fest; andere Mitglieder sehen nur', async () => {
    const asMember = await state(users.member);
    expect(asMember.canManage).toBe(false);
    expect(asMember.current?.version).toBe(1);
    expect((await call(users.member, 'POST', `${path}/freigabe`)).status).toBe(403);
    expect((await call(users.supplier, 'GET', path)).status).toBe(403);
  });

  it('eine freigegebene Version ist gesperrt; Änderungen erzeugen eine neue Version', async () => {
    const approved = ruleSetResponseSchema.parse(
      (await call(users.sro, 'POST', `${path}/freigabe`)).body,
    );
    expect(approved.current).toMatchObject({
      version: 1,
      status: 'approved',
      approvedBy: 'Sara Ost',
    });
    expect((await call(users.sro, 'POST', `${path}/freigabe`)).status).toBe(409);
    const current = approved.current;
    const { body } = await call(users.sro, 'PUT', path, {
      selected: current?.items
        .filter((item) => item.origin === 'catalog')
        .map((item) => item.catalogItemId),
      removedReasons: Object.fromEntries(
        (current?.removed ?? []).map((entry) => [entry.item.catalogItemId, entry.reason]),
      ),
      custom: [],
    });
    const next = ruleSetResponseSchema.parse(body);
    expect(next.current).toMatchObject({ version: 2, status: 'draft' });
    const versions = await db.execute(sql`
      select version, status, (select count(*)::int from rule_set_item i where i.rule_set_id = s.id) as items
      from rule_set s where relationship_id = ${rel} order by version
    `);
    // Version 1 bleibt mit eigenem Werksbesuch unverändert, Version 2 hat ihn nicht mehr.
    const [v1, v2] = versions.rows as { version: number; status: string; items: number }[];
    expect(v1?.status).toBe('approved');
    expect(v2?.status).toBe('draft');
    expect((v1?.items ?? 0) - (v2?.items ?? 0)).toBe(1);
  });

  it('ein geänderter Soll-Typ zeigt den Hinweis und ändert nichts automatisch', async () => {
    const before = await state();
    await decide(3, 1);
    const after = await state();
    expect(after.targetChanged).toBe(true);
    expect(after.target).toMatchObject({ impactLevel: 3, qualityLevel: 1 });
    expect(after.current).toEqual(before.current);
    // Zum Bearbeiten gilt weiter der Typ der aktuellen Version.
    const basis = ruleSetProposalSchema.parse(
      (await call(users.sro, 'GET', `${path}/vorschlag?basis=aktuell`)).body,
    );
    expect(basis.target).toMatchObject({ impactLevel: 2, qualityLevel: 2 });
    // Erst auf Klick wird der neue Vorschlag zum Entwurf; der offene Entwurf wird ersetzt.
    const adopted = ruleSetResponseSchema.parse((await call(users.sro, 'POST', path)).body);
    expect(adopted.targetChanged).toBe(false);
    expect(adopted.current).toMatchObject({
      version: 2,
      status: 'draft',
      target: { impactLevel: 3, qualityLevel: 1 },
    });
  });

  it('vor SEG-10 sieht der Lieferant keine Spielregeln, auch nicht im Kontext des Kunden', async () => {
    const rows = await testApp.adminDb.transaction(async (tx) => {
      await tx.execute(sql`set local role reziproq_app`);
      await tx.execute(sql`select set_config('app.user_id', ${users.supplier}, true)`);
      await tx.execute(sql`select set_config('app.org_id', ${orgs.supplier}, true)`);
      await tx.execute(sql`select set_config('app.customer_org_id', ${orgs.oem}, true)`);
      const sets = await tx.execute(sql`select id from rule_set`);
      const items = await tx.execute(sql`select id from rule_set_item`);
      const notes = await tx.execute(sql`select id from rule_set_note`);
      return [sets.rows.length, items.rows.length, notes.rows.length];
    });
    expect(rows).toEqual([0, 0, 0]);
  });
});
