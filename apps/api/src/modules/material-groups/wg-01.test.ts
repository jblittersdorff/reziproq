import { randomUUID } from 'node:crypto';
import { type Database, schema, sql } from '@reziproq/db';
import {
  materialGroupDetailSchema,
  materialGroupImportPreviewSchema,
  materialGroupOverviewSchema,
} from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';

// Tests zu docs/specs/WG-01.md: Warengruppen anlegen und importieren, eigene Bezeichnung,
// unbekannte Warengruppe im Spend-Import, Zuordnung aus Spend, Deaktivieren, Team und
// Produktgruppen, Zusammenlegen und Teilen, und der Test-Lieferant erhält nichts.
describe('WG-01 Warengruppen anlegen', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const run = randomUUID().slice(0, 8);
  const orgs = { a: randomUUID(), b: randomUUID(), supplier: randomUUID() };
  const rel = randomUUID();
  const users = {
    adminA: `wg01-admin-a-${run}`,
    leadA: `wg01-lead-a-${run}`,
    memberA: `wg01-member-a-${run}`,
    adminB: `wg01-admin-b-${run}`,
    supplier: `wg01-sup-${run}`,
  };
  const email = (id: string) => `${id}@example.com`;
  const refA = `WG01-${run}`;

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
  const upload = async (user: string, url: string, content: string, name = 'gruppen.csv') => {
    const form = new FormData();
    form.append('file', new Blob([content], { type: 'text/csv' }), name);
    const response = await fetch(`${testApp.baseUrl}/api${url}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${await testApp.signToken({ subject: user })}` },
      body: form,
    });
    return { status: response.status, body: (await response.json().catch(() => null)) as unknown };
  };
  const overview = async (user = users.adminA) =>
    materialGroupOverviewSchema.parse((await call(user, 'GET', '/warengruppen')).body);
  const groupId = async (code: string) =>
    (await overview()).groups.find((group) => group.code === code)?.id as string;

  beforeAll(async () => {
    testApp = await startTestApp();
    db = testApp.adminDb;
    await db.insert(schema.organization).values([
      { id: orgs.a, name: `WG01-A ${run}` },
      { id: orgs.b, name: `WG01-B ${run}` },
      { id: orgs.supplier, name: `WG01-Lieferant ${run}` },
    ]);
    await db.insert(schema.organizationFeature).values([
      { organizationId: orgs.a, feature: 'buyer' },
      { organizationId: orgs.b, feature: 'buyer' },
    ]);
    const person = (id: string, organizationId: string, orgRole: 'admin' | 'member') => ({
      id,
      name: id,
      email: email(id),
      organizationId,
      orgRole,
      rolesImportedAt: new Date(),
    });
    await db
      .insert(schema.appUser)
      .values([
        person(users.adminA, orgs.a, 'admin'),
        person(users.leadA, orgs.a, 'member'),
        person(users.memberA, orgs.a, 'member'),
        person(users.adminB, orgs.b, 'admin'),
        person(users.supplier, orgs.supplier, 'admin'),
      ]);
    await insertRelationships(db, [
      { id: rel, buyer: orgs.a, supplier: orgs.supplier, externalRef: refA },
    ]);
  });

  afterAll(async () => {
    const orgIds = Object.values(orgs);
    await db.execute(sql`delete from relationship_spend where relationship_id = ${rel}`);
    await db.execute(sql`delete from relationship_material_group where relationship_id = ${rel}`);
    await deleteRelationships(db, orgIds);
    await db.execute(sql`delete from material_group_member where org_id in ${orgIds}`);
    await db.execute(sql`delete from material_group_product_group where org_id in ${orgIds}`);
    await db.execute(
      sql`delete from material_group where org_id in ${orgIds} and parent_id is not null`,
    );
    await db.execute(sql`delete from material_group where org_id in ${orgIds}`);
    await db.execute(sql`delete from org_setting where org_id in ${orgIds}`);
    await db.execute(sql`delete from app_user where organization_id in ${orgIds}`);
    await db.execute(sql`delete from organization_feature where organization_id in ${orgIds}`);
    await db.execute(sql`delete from organization where id in ${orgIds}`);
    await testApp.close();
  });

  it('Ein neuer Kunde hat keine Warengruppen und kann eine anlegen und zehn importieren', async () => {
    expect((await overview()).groups).toEqual([]);
    const created = await call(users.adminA, 'POST', '/material-groups', {
      name: 'Elektronik',
      code: 'EL',
      parentId: null,
      leadUserId: users.leadA,
      description: 'Elektronische Bauteile',
    });
    expect(created.status).toBe(201);
    const rows = [
      'Kennung;Name;Übergeordnete Kennung;Lead (E-Mail)',
      `GU;Guss;;${email(users.leadA)}`,
      'GU-AL;Aluminiumguss;GU;',
      'GU-EI;Eisenguss;GU;',
      'KU;Kunststoff;;',
      'KU-SP;Spritzguss;KU;',
      'EL-SE;Sensorik;EL;',
      'EL-LP;Leiterplatten;EL;',
      'LO;Logistik;;',
      'VP;Verpackung;;',
      'ME;Mechanik;;',
    ].join('\n');
    const preview = materialGroupImportPreviewSchema.parse(
      (await upload(users.adminA, '/warengruppen/import/vorschau', rows)).body,
    );
    expect(preview.valid).toBe(true);
    expect(preview.rows).toHaveLength(10);
    const imported = await upload(users.adminA, '/warengruppen/import', rows);
    expect(imported.status).toBe(201);
    expect(imported.body).toEqual({ created: 10 });
    const groups = (await overview()).groups;
    expect(groups).toHaveLength(11);
    expect(groups.find((group) => group.code === 'GU-AL')?.parentId).toBe(await groupId('GU'));
    expect(groups.find((group) => group.code === 'GU')?.lead?.userId).toBe(users.leadA);
    // Nur Admins legen an und importieren.
    expect((await upload(users.memberA, '/warengruppen/import/vorschau', rows)).status).toBe(403);
  });

  it('Ein Import mit unbekannter übergeordneter Kennung übernimmt nichts', async () => {
    const rows = ['Kennung;Name;Übergeordnete Kennung', 'NEU1;Neu eins;', 'NEU2;Neu zwei;XX'].join(
      '\n',
    );
    const preview = materialGroupImportPreviewSchema.parse(
      (await upload(users.adminA, '/warengruppen/import/vorschau', rows)).body,
    );
    expect(preview.valid).toBe(false);
    expect(preview.rows[1]?.errors).toEqual(['parent_unknown']);
    expect((await upload(users.adminA, '/warengruppen/import', rows)).status).toBe(400);
    expect((await overview()).groups.some((group) => group.code === 'NEU1')).toBe(false);
  });

  it('Kunde A stellt „Werkstoffgruppe“ ein; Kunde B sieht weiter „Warengruppe“', async () => {
    expect(
      (
        await call(users.memberA, 'PUT', '/warengruppen/bezeichnung', {
          singular: 'Werkstoffgruppe',
          plural: 'Werkstoffgruppen',
        })
      ).status,
    ).toBe(403);
    const saved = await call(users.adminA, 'PUT', '/warengruppen/bezeichnung', {
      singular: 'Werkstoffgruppe',
      plural: 'Werkstoffgruppen',
    });
    expect(saved.status).toBe(200);
    // /me liefert die Bezeichnung aus derselben Quelle (readCategoryLabel); hier über die API der
    // Warengruppen, weil /me im Test mit Zitadel abgleicht.
    expect((await call(users.memberA, 'GET', '/warengruppen/bezeichnung')).body).toEqual({
      singular: 'Werkstoffgruppe',
      plural: 'Werkstoffgruppen',
    });
    expect((await overview(users.memberA)).label.plural).toBe('Werkstoffgruppen');
    expect((await call(users.adminB, 'GET', '/warengruppen/bezeichnung')).body).toEqual({
      singular: 'Warengruppe',
      plural: 'Warengruppen',
    });
  });

  it('Ein Spend-Import mit unbekannter Warengruppe zeigt den Fehler; nach dem Anlegen geht er durch', async () => {
    const content = [
      'Eigene Lieferantennummer;Jahr;Betrag;Währung;Warengruppe',
      `${refA};2025;100,00;EUR;Kabel`,
    ].join('\n');
    const preview = await upload(
      users.adminA,
      '/suppliers/import/preview?type=spend',
      content,
      'spend.csv',
    );
    expect(JSON.stringify(preview.body)).toContain('unknown_material_group');
    // „Als neue Warengruppe anlegen“
    expect(
      (
        await call(users.adminA, 'POST', '/material-groups', {
          name: 'Kabel',
          code: 'KA',
          parentId: null,
        })
      ).status,
    ).toBe(201);
    const again = await upload(
      users.adminA,
      '/suppliers/import/preview?type=spend',
      content,
      'spend.csv',
    );
    expect(JSON.stringify(again.body)).not.toContain('unknown_material_group');
  });

  it('Ein Lieferant mit Spend in drei Warengruppen hat drei Zuordnungen', async () => {
    const ids = await Promise.all(['GU', 'KU', 'LO'].map((code) => groupId(code)));
    await db.insert(schema.relationshipSpend).values(
      ids.map((materialGroupId, index) => ({
        relationshipId: rel,
        year: 2025,
        amountCents: (index + 1) * 100_000,
        materialGroupId,
      })),
    );
    const assigned = await db
      .select()
      .from(schema.relationshipMaterialGroup)
      .where(sql`${schema.relationshipMaterialGroup.relationshipId} = ${rel}`);
    expect(assigned.map((row) => row.materialGroupId).sort()).toEqual([...ids].sort());
    expect(assigned.every((row) => row.source === 'spend')).toBe(true);
    expect(assigned.filter((row) => row.isPrimary)).toHaveLength(1);
    const detail = materialGroupDetailSchema.parse(
      (await call(users.memberA, 'GET', `/warengruppen/${ids[0]}`)).body,
    );
    expect(detail.suppliers).toEqual([
      expect.objectContaining({ relationshipId: rel, source: 'spend' }),
    ]);
  });

  it('Eine deaktivierte Warengruppe ist für neue Zuordnungen nicht wählbar und bleibt lesbar', async () => {
    const id = await groupId('VP');
    expect(
      (
        await call(users.adminA, 'PATCH', `/material-groups/${id}`, {
          name: 'Verpackung',
          code: 'VP',
          parentId: null,
          active: false,
        })
      ).status,
    ).toBe(200);
    const assignment = await call(users.adminA, 'PUT', `/suppliers/${rel}/zuordnung`, {
      businessUnitIds: [],
      materialGroupIds: [id],
      primaryMaterialGroupId: id,
    });
    expect(assignment.status).toBe(409);
    expect(assignment.body).toMatchObject({ code: 'inactive' });
    expect((await overview()).groups.find((group) => group.code === 'VP')?.active).toBe(false);
    expect((await call(users.memberA, 'GET', `/warengruppen/${id}`)).status).toBe(200);
  });

  it('Lead und Admin pflegen Team und Produktgruppen, andere nicht', async () => {
    const id = await groupId('GU');
    const team = {
      members: [{ userId: users.memberA, role: 'buyer', region: 'Europa', task: 'Aluminium' }],
    };
    expect((await call(users.memberA, 'PUT', `/warengruppen/${id}/team`, team)).status).toBe(403);
    const saved = materialGroupDetailSchema.parse(
      (await call(users.leadA, 'PUT', `/warengruppen/${id}/team`, team)).body,
    );
    expect(saved.members.map((member) => [member.userId, member.role])).toEqual([
      [users.leadA, 'lead'],
      [users.memberA, 'buyer'],
    ]);
    const withGroup = materialGroupDetailSchema.parse(
      (await call(users.leadA, 'POST', `/warengruppen/${id}/produktgruppen`, { name: 'Druckguss' }))
        .body,
    );
    expect(withGroup.productGroups.map((group) => group.name)).toEqual(['Druckguss']);
    // Personen anderer Organisationen gehören nicht ins Team.
    const foreign = await call(users.adminA, 'PUT', `/warengruppen/${id}/team`, {
      members: [{ userId: users.adminB, role: 'buyer' }],
    });
    expect(foreign.status).toBe(409);
  });

  it('Zusammenlegen fragt nach dem Spend; die Antwort steht im Verlauf', async () => {
    const source = await groupId('ME');
    const target = await groupId('KU');
    await db.insert(schema.relationshipSpend).values({
      relationshipId: rel,
      year: 2025,
      amountCents: 50_000,
      materialGroupId: source,
    });
    const merged = await call(users.adminA, 'POST', `/warengruppen/${source}/zusammenlegen`, {
      targetId: target,
      spend: 'move',
    });
    expect(merged.status).toBe(200);
    const spend = await db
      .select()
      .from(schema.relationshipSpend)
      .where(
        sql`${schema.relationshipSpend.relationshipId} = ${rel} and ${schema.relationshipSpend.materialGroupId} = ${target}`,
      );
    // 2.000,00 € aus KU und 500,00 € aus ME addiert
    expect(spend.map((row) => row.amountCents)).toEqual([250_000]);
    expect((await overview()).groups.find((group) => group.code === 'ME')?.active).toBe(false);
    const [audit] = (
      await db.execute<{ changes: Record<string, { from: unknown; to: unknown }> }>(
        sql`select changes from audit_event where object_id = ${source} order by id desc limit 1`,
      )
    ).rows;
    expect(audit?.changes).toMatchObject({
      merged_into: { from: null, to: 'KU' },
      spend: { from: null, to: 'move' },
    });
  });

  it('Teilen legt neue Warengruppen an; Produktgruppen und ihr Spend ziehen mit', async () => {
    const source = await groupId('EL');
    const created = materialGroupDetailSchema.parse(
      (
        await call(users.adminA, 'POST', `/warengruppen/${source}/produktgruppen`, {
          name: 'Leistungselektronik',
        })
      ).body,
    );
    const pg = created.productGroups[0]?.id as string;
    const split = await call(users.adminA, 'POST', `/warengruppen/${source}/teilen`, {
      groups: [{ name: 'Leistungselektronik', code: 'EL-LE', productGroupIds: [pg] }],
      spend: 'by_product_group',
    });
    // EL hat Untergruppen; geteilt wird auf derselben Ebene.
    expect(split.status).toBe(200);
    const fresh = materialGroupDetailSchema.parse(
      (await call(users.adminA, 'GET', `/warengruppen/${await groupId('EL-LE')}`)).body,
    );
    expect(fresh.productGroups.map((group) => group.name)).toEqual(['Leistungselektronik']);
  });

  it('Der Test-Lieferant und Kunde B erhalten keine Daten', async () => {
    expect((await call(users.supplier, 'GET', '/warengruppen')).status).toBe(403);
    const id = await groupId('GU');
    expect((await call(users.supplier, 'GET', `/warengruppen/${id}`)).status).toBe(403);
    expect((await overview(users.adminB)).groups).toEqual([]);
    expect((await call(users.adminB, 'GET', `/warengruppen/${id}`)).status).toBe(404);
  });
});
