import { randomUUID } from 'node:crypto';
import { type Database, schema, sql } from '@reziproq/db';
import {
  customerRuleSetSchema,
  customerWorkspaceSchema,
  defaultSegmentCriteria,
  defaultSegmentTypes,
  ruleSetResponseSchema,
  ruleSetSharePreviewSchema,
} from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';

// Tests zu docs/specs/SEG-10.md über die API: Beziehungstyp und Spielregeln teilen.
describe('SEG-10 Beziehungstyp und Spielregeln an den Lieferanten freigeben', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const run = randomUUID().slice(0, 8);
  const orgs = { oem: randomUUID(), supplier: randomUUID() };
  const rel = randomUUID();
  const modelId = randomUUID();
  const users = { sro: `seg10-sro-${run}`, member: `seg10-member-${run}`, kam: `seg10-kam-${run}` };
  const buyerPath = `/suppliers/${rel}/spielregeln`;
  const secretReason = 'Interne Begründung: Lieferant ist zu klein.';
  const customReason = 'Interne Begründung: Qualität beobachten.';

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
  const supplierView = async () =>
    customerRuleSetSchema.parse((await call(users.kam, 'GET', `/kunden/${rel}/spielregeln`)).body);

  beforeAll(async () => {
    testApp = await startTestApp();
    db = testApp.adminDb;
    await db.insert(schema.organization).values([
      { id: orgs.oem, name: `SEG10-OEM ${run}` },
      { id: orgs.supplier, name: `SEG10-Lieferant ${run}` },
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
        person(users.sro, 'member', orgs.oem),
        person(users.member, 'member', orgs.oem),
        person(users.kam, 'admin', orgs.supplier),
      ]);
    await insertRelationships(db, [{ id: rel, buyer: orgs.oem, supplier: orgs.supplier }]);
    await db.insert(schema.relationshipMember).values({
      relationshipId: rel,
      orgId: orgs.oem,
      userId: users.sro,
      teamRole: 'sro',
    });
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
    // Ist 1/1, Soll 3/3: Der Ist-Typ darf beim Lieferanten nie ankommen.
    await db.insert(schema.segmentDecision).values({
      relationshipId: rel,
      scope: 'total',
      istImpactLevel: 1,
      istQualityLevel: 1,
      sollImpactLevel: 3,
      sollQualityLevel: 3,
      reason: 'Interne Begründung der Konsolidierung',
      modelVersion: 1,
      decidedBy: users.sro,
      version: 1,
    });
    // Spielregeln: Vorschlag übernehmen, einen Eintrag mit Begründung abwählen, einen eigenen ergänzen.
    const adopted = ruleSetResponseSchema.parse((await call(users.sro, 'POST', buyerPath)).body);
    const [dropped, ...kept] = adopted.current?.items ?? [];
    await call(users.sro, 'PUT', buyerPath, {
      selected: kept.map((item) => item.catalogItemId),
      removedReasons: { [dropped?.catalogItemId as string]: secretReason },
      custom: [
        {
          kind: 'format',
          group: null,
          title: 'Werksbesuch',
          description: 'Vor Ort.',
          cadence: 'annual',
          reason: customReason,
        },
      ],
    });
  });

  afterAll(async () => {
    await deleteRelationships(db, Object.values(orgs));
    await db.execute(sql`delete from relationship_target where owner_org_id = ${orgs.oem}`);
    for (const table of ['rule_catalog_item', 'format_catalog_item', 'catalog_setup']) {
      await db.execute(sql`delete from ${sql.identifier(table)} where org_id = ${orgs.oem}`);
    }
    await db.execute(sql`delete from segment_model where org_id = ${orgs.oem}`);
    await db.execute(sql`delete from app_user where organization_id in ${Object.values(orgs)}`);
    await db.execute(sql`delete from organization_feature where organization_id = ${orgs.oem}`);
    await db.execute(sql`delete from organization where id in ${Object.values(orgs)}`);
    await testApp.close();
  });

  it('ein Entwurf lässt sich nicht teilen; vorher sieht der Lieferant nichts', async () => {
    expect((await call(users.sro, 'GET', `${buyerPath}/teilen`)).status).toBe(409);
    expect((await call(users.sro, 'POST', `${buyerPath}/teilen`)).status).toBe(409);
    expect(await supplierView()).toEqual({ target: null, items: [] });
    const head = customerWorkspaceSchema.parse(
      (await call(users.kam, 'GET', `/kunden/${rel}`)).body,
    );
    expect(head.relationshipType).toBeNull();
  });

  it('die Vorschau zeigt genau, was der Lieferant sehen wird', async () => {
    await call(users.sro, 'POST', `${buyerPath}/freigabe`);
    const preview = ruleSetSharePreviewSchema.parse(
      (await call(users.sro, 'GET', `${buyerPath}/teilen`)).body,
    );
    const soll = defaultSegmentTypes.find(
      (type) => type.impactLevel === 3 && type.qualityLevel === 3,
    );
    expect(preview).toMatchObject({
      version: 1,
      typeName: soll?.name,
      typeDescription: soll?.description,
    });
    expect(preview.items.map((item) => item.title.de)).toContain('Werksbesuch');
    expect(JSON.stringify(preview)).not.toContain('Interne Begründung');
    expect((await call(users.member, 'POST', `${buyerPath}/teilen`)).status).toBe(403);
  });

  it('nach dem Teilen sieht der Lieferant genau Typ, Beschreibung und die Spielregeln dieser Version', async () => {
    const preview = ruleSetSharePreviewSchema.parse(
      (await call(users.sro, 'GET', `${buyerPath}/teilen`)).body,
    );
    const shared = ruleSetResponseSchema.parse(
      (await call(users.sro, 'POST', `${buyerPath}/teilen`)).body,
    );
    expect(shared.current).toMatchObject({ version: 1, status: 'shared', visibility: 'shared' });
    expect(shared.shared).toMatchObject({ version: 1, typeName: preview.typeName });

    const view = await supplierView();
    expect(view.target).toMatchObject({
      version: 1,
      typeName: preview.typeName,
      typeDescription: preview.typeDescription,
    });
    expect(view.items).toEqual(preview.items);
    const head = customerWorkspaceSchema.parse(
      (await call(users.kam, 'GET', `/kunden/${rel}`)).body,
    );
    expect(head.relationshipType).toBe(preview.typeName);
    expect((await call(users.sro, 'POST', `${buyerPath}/teilen`)).status).toBe(409);
  });

  it('Bewertungen, Ist-Typ und Begründungen sind für den Lieferanten in keiner Schnittstelle sichtbar', async () => {
    const ist = defaultSegmentTypes.find(
      (type) => type.impactLevel === 1 && type.qualityLevel === 1,
    );
    const answers = [
      (await call(users.kam, 'GET', `/kunden/${rel}/spielregeln`)).body,
      (await call(users.kam, 'GET', `/kunden/${rel}`)).body,
      (await call(users.kam, 'GET', '/kunden')).body,
      (await call(users.kam, 'GET', '/start')).body,
    ];
    const text = JSON.stringify(answers);
    for (const secret of [
      secretReason,
      customReason,
      'Interne Begründung der Konsolidierung',
      ist?.name ?? '-',
      'origin',
      'reason',
      'catalogItemId',
    ]) {
      expect(text).not.toContain(secret);
    }
    // Die Adressen des Käufers zu Spielregeln und Segmentierung bleiben gesperrt.
    for (const url of [
      buyerPath,
      `${buyerPath}/vorschlag`,
      `${buyerPath}/teilen`,
      `/ratings/relationship/${rel}`,
    ]) {
      expect((await call(users.kam, 'GET', url)).status).toBe(403);
    }
    // Und auch direkt in der Datenbank sieht die Lieferantenseite keine Begründung und keine Bewertung.
    const rows = await db.transaction(async (tx) => {
      await tx.execute(sql`set local role reziproq_app`);
      await tx.execute(sql`select set_config('app.user_id', ${users.kam}, true)`);
      await tx.execute(sql`select set_config('app.org_id', ${orgs.supplier}, true)`);
      await tx.execute(sql`select set_config('app.customer_org_id', ${orgs.oem}, true)`);
      const notes = await tx.execute(sql`select id from rule_set_note`);
      const decisions = await tx.execute(sql`select id from segment_decision`);
      return [notes.rows.length, decisions.rows.length];
    });
    expect(rows).toEqual([0, 0]);
  });

  it('eine spätere Umbenennung des Typs ändert die geteilte Beschreibung nicht', async () => {
    const before = await supplierView();
    await db.execute(sql`
      update segment_type set name = 'Umbenannt', description = 'Neue Beschreibung'
      where model_id = ${modelId} and impact_level = 3 and quality_level = 3
    `);
    const after = await supplierView();
    expect(after.target).toEqual(before.target);
    const head = customerWorkspaceSchema.parse(
      (await call(users.kam, 'GET', `/kunden/${rel}`)).body,
    );
    expect(head.relationshipType).toBe(before.target?.typeName);
  });

  it('eine neue Version bleibt intern, bis sie geteilt wird', async () => {
    const before = await supplierView();
    const current = ruleSetResponseSchema.parse(
      (await call(users.sro, 'GET', buyerPath)).body,
    ).current;
    // Bearbeiten nach dem Teilen: neue Version ohne den eigenen Eintrag.
    const next = ruleSetResponseSchema.parse(
      (
        await call(users.sro, 'PUT', buyerPath, {
          selected: current?.items
            .filter((item) => item.origin === 'catalog')
            .map((item) => item.catalogItemId),
          removedReasons: Object.fromEntries(
            (current?.removed ?? []).map((entry) => [entry.item.catalogItemId, entry.reason]),
          ),
          custom: [],
        })
      ).body,
    );
    expect(next.current).toMatchObject({ version: 2, status: 'draft', visibility: 'internal' });
    expect(next.shared?.version).toBe(1);
    expect(await supplierView()).toEqual(before);
    await call(users.sro, 'POST', `${buyerPath}/freigabe`);
    expect(await supplierView()).toEqual(before);
    await call(users.sro, 'POST', `${buyerPath}/teilen`);
    const after = await supplierView();
    expect(after.target?.version).toBe(2);
    expect(after.items.map((item) => item.title.de)).not.toContain('Werksbesuch');
    // Das neue Teilen übernimmt Name und Beschreibung aus dem Modell von jetzt als neuen Stand.
    expect(after.target).toMatchObject({
      typeName: 'Umbenannt',
      typeDescription: 'Neue Beschreibung',
    });
  });
});
