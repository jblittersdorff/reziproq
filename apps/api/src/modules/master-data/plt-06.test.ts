import { randomUUID } from 'node:crypto';
import { type Database, schema, sql } from '@reziproq/db';
import {
  assignmentResponseSchema,
  auditResponseSchema,
  businessUnitSchema,
  businessUnitsResponseSchema,
  materialGroupSchema,
  type OrgRole,
  suppliersResponseSchema,
} from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';

// Tests zu docs/specs/PLT-06.md über die API: Business Units, Warengruppen, Zuordnung.

describe('PLT-06: Business Units und Warengruppen über die API', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const run = randomUUID().slice(0, 8);
  const orgs = { oem: randomUUID(), zweit: randomUUID(), supplier: randomUUID() };
  const relationships = { oem: randomUUID(), zweit: randomUUID() };
  const users = {
    admin: `p06-admin-${run}`,
    member: `p06-member-${run}`,
    viewer: `p06-viewer-${run}`,
    zweit: `p06-zweit-${run}`,
  };

  const call = async (user: string, method: string, path: string, body?: unknown) => {
    const res = await fetch(`${testApp.baseUrl}/api${path}`, {
      method,
      headers: {
        authorization: `Bearer ${await testApp.signToken({ subject: user })}`,
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: res.status, body: (await res.json().catch(() => null)) as unknown };
  };

  const createUnit = async (code: string, name = code) =>
    businessUnitSchema.parse(
      (await call(users.admin, 'POST', '/business-units', { name, code })).body,
    );
  const createGroup = async (code: string, parentId: string | null = null) =>
    materialGroupSchema.parse(
      (await call(users.admin, 'POST', '/material-groups', { name: code, code, parentId })).body,
    );
  const assign = (user: string, body: unknown, relationship = relationships.oem) =>
    call(user, 'PUT', `/suppliers/${relationship}/zuordnung`, body);

  beforeAll(async () => {
    testApp = await startTestApp();
    db = testApp.adminDb;
    await db.insert(schema.organization).values([
      { id: orgs.oem, name: `P06-OEM ${run}` },
      { id: orgs.zweit, name: `P06-Zweit ${run}` },
      { id: orgs.supplier, name: `P06-Lieferant ${run}` },
    ]);
    await db.insert(schema.organizationFeature).values([
      { organizationId: orgs.oem, feature: 'buyer' as const },
      { organizationId: orgs.zweit, feature: 'buyer' as const },
    ]);
    const person = (id: string, orgRole: OrgRole, organizationId: string) => ({
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
        person(users.admin, 'admin', orgs.oem),
        person(users.member, 'member', orgs.oem),
        person(users.viewer, 'viewer', orgs.oem),
        person(users.zweit, 'admin', orgs.zweit),
      ]);
    await insertRelationships(db, [
      { id: relationships.oem, buyer: orgs.oem, supplier: orgs.supplier },
      { id: relationships.zweit, buyer: orgs.zweit, supplier: orgs.supplier },
    ]);
  });

  afterAll(async () => {
    await deleteRelationships(db, [orgs.oem, orgs.zweit]);
    await db.delete(schema.appUser).where(sql`${schema.appUser.id} in ${Object.values(users)}`);
    await db
      .delete(schema.organization)
      .where(sql`${schema.organization.id} in ${Object.values(orgs)}`);
    await testApp.close();
  });

  it('Ein Admin legt an, benennt um und deaktiviert. Nutzer und Leser bekommen dabei 403.', async () => {
    for (const path of ['/business-units', '/material-groups']) {
      const created = await call(users.admin, 'POST', path, { name: 'Elektronik', code: 'EL' });
      expect(created.status, path).toBe(201);
      const { id } = created.body as { id: string };
      const renamed = await call(users.admin, 'PATCH', `${path}/${id}`, {
        name: 'Elektrik',
        code: 'EL',
      });
      expect(renamed.body).toMatchObject({ name: 'Elektrik', active: true });
      const deactivated = await call(users.admin, 'PATCH', `${path}/${id}`, {
        name: 'Elektrik',
        code: 'EL',
        active: false,
      });
      expect(deactivated.body).toMatchObject({ active: false });

      for (const user of [users.member, users.viewer]) {
        expect((await call(user, 'POST', path, { name: 'X', code: 'X' })).status, user).toBe(403);
        expect(
          (await call(user, 'PATCH', `${path}/${id}`, { name: 'X', code: 'EL' })).status,
          user,
        ).toBe(403);
        expect((await call(user, 'DELETE', `${path}/${id}`)).status, user).toBe(403);
        // Sehen dürfen alle Rollen.
        expect((await call(user, 'GET', path)).status, user).toBe(200);
      }
      // Unbenutzt lässt er sich löschen.
      expect((await call(users.admin, 'DELETE', `${path}/${id}`)).status).toBe(204);
    }
  });

  it('Mehrere BUs und Warengruppen je Lieferant, genau eine Haupt-Warengruppe; der Verlauf hält es fest', async () => {
    const [pkw, nfz] = [await createUnit('PKW'), await createUnit('NFZ')];
    const elektronik = await createGroup('ELEK');
    const kabel = await createGroup('KABEL', elektronik.id);

    // Ohne Haupt-Warengruppe oder mit einer, die nicht zugeordnet ist: abgelehnt.
    for (const primaryMaterialGroupId of [null, randomUUID()]) {
      const missing = await assign(users.member, {
        businessUnitIds: [pkw.id],
        materialGroupIds: [kabel.id],
        primaryMaterialGroupId,
      });
      expect(missing.status).toBe(400);
      expect(missing.body).toMatchObject({
        errors: { primaryMaterialGroupId: ['primary_required'] },
      });
    }

    const saved = await assign(users.member, {
      businessUnitIds: [pkw.id, nfz.id],
      materialGroupIds: [elektronik.id, kabel.id],
      primaryMaterialGroupId: kabel.id,
    });
    expect(saved.status).toBe(200);
    const assignment = assignmentResponseSchema.parse(
      (await call(users.viewer, 'GET', `/suppliers/${relationships.oem}/zuordnung`)).body,
    );
    expect(assignment.businessUnits.map((unit) => unit.code)).toEqual(['NFZ', 'PKW']);
    expect(assignment.materialGroups.map((group) => [group.code, group.isPrimary])).toEqual([
      ['KABEL', true],
      ['ELEK', false],
    ]);
    expect(assignment.canEdit).toBe(false);

    // Haupt-Warengruppe wechseln.
    await assign(users.member, {
      businessUnitIds: [pkw.id],
      materialGroupIds: [elektronik.id, kabel.id],
      primaryMaterialGroupId: elektronik.id,
    });
    const list = suppliersResponseSchema.parse(
      (await call(users.member, 'GET', '/suppliers')).body,
    );
    expect(list.suppliers.find((s) => s.relationshipId === relationships.oem)).toMatchObject({
      primaryMaterialGroup: 'ELEK',
      materialGroups: ['ELEK', 'KABEL'],
    });

    const history = auditResponseSchema.parse(
      (
        await call(
          users.member,
          'GET',
          `/audit?object_type=relationship_assignment&object_id=${relationships.oem}`,
        )
      ).body,
    );
    expect(history.entries[0]?.changes).toMatchObject({
      business_units: { from: [{ name: 'NFZ' }, { name: 'PKW' }], to: [{ name: 'PKW' }] },
      primary_material_group: { from: 'KABEL', to: 'ELEK' },
    });
    // Leser ordnen nicht zu.
    expect(
      (
        await assign(users.viewer, {
          businessUnitIds: [],
          materialGroupIds: [],
          primaryMaterialGroupId: null,
        })
      ).status,
    ).toBe(403);
  });

  it('Deaktivierte Einträge sind für neue Zuordnungen nicht wählbar. Bestehende bleiben sichtbar und markiert.', async () => {
    const kept = await createUnit('ALT');
    const fresh = await createUnit('NEU-INAKTIV');
    await assign(users.admin, {
      businessUnitIds: [kept.id],
      materialGroupIds: [],
      primaryMaterialGroupId: null,
    });
    for (const unit of [kept, fresh]) {
      await call(users.admin, 'PATCH', `/business-units/${unit.id}`, {
        name: unit.name,
        code: unit.code,
        active: false,
      });
    }
    const added = await assign(users.admin, {
      businessUnitIds: [kept.id, fresh.id],
      materialGroupIds: [],
      primaryMaterialGroupId: null,
    });
    expect(added).toMatchObject({ status: 409, body: { code: 'inactive' } });
    // Die bestehende deaktivierte Zuordnung bleibt beim Speichern erhalten.
    const unchanged = await assign(users.admin, {
      businessUnitIds: [kept.id],
      materialGroupIds: [],
      primaryMaterialGroupId: null,
    });
    expect(unchanged.status).toBe(200);
    expect(assignmentResponseSchema.parse(unchanged.body).businessUnits).toEqual([
      { id: kept.id, name: 'ALT', code: 'ALT', active: false },
    ]);
  });

  it('Ein benutzter Eintrag lässt sich nicht löschen', async () => {
    const used = await createUnit('BENUTZT');
    const parent = await createGroup('OBEN');
    await createGroup('UNTEN', parent.id);
    await assign(users.admin, {
      businessUnitIds: [used.id],
      materialGroupIds: [],
      primaryMaterialGroupId: null,
    });
    expect(await call(users.admin, 'DELETE', `/business-units/${used.id}`)).toMatchObject({
      status: 409,
      body: { code: 'in_use' },
    });
    expect(await call(users.admin, 'DELETE', `/material-groups/${parent.id}`)).toMatchObject({
      status: 409,
      body: { code: 'in_use' },
    });
    const units = businessUnitsResponseSchema.parse(
      (await call(users.admin, 'GET', '/business-units')).body,
    );
    expect(units.businessUnits.find((unit) => unit.id === used.id)?.supplierCount).toBe(1);
  });

  it('Codes sind je Organisation eindeutig. Mehr als zwei Ebenen werden abgelehnt.', async () => {
    await createUnit('DOPPELT');
    expect(
      await call(users.admin, 'POST', '/business-units', { name: 'X', code: 'doppelt' }),
    ).toMatchObject({ status: 409, body: { code: 'code_taken' } });
    // Beim Zweit-OEM ist derselbe Code frei.
    expect(
      (await call(users.zweit, 'POST', '/business-units', { name: 'X', code: 'DOPPELT' })).status,
    ).toBe(201);

    const top = await createGroup('EBENE1');
    const second = await createGroup('EBENE2', top.id);
    expect(
      await call(users.admin, 'POST', '/material-groups', {
        name: 'Drei',
        code: 'EBENE3',
        parentId: second.id,
      }),
    ).toMatchObject({ status: 409, body: { code: 'too_deep' } });
    expect(
      (await call(users.admin, 'POST', '/business-units', { name: 'X', code: 'mit leerzeichen' }))
        .body,
    ).toMatchObject({ errors: { code: ['invalid_code'] } });
  });

  it('Der Zweit-OEM sieht keine BU und keine Warengruppe des Test-OEM und kann sie nicht zuordnen', async () => {
    const unit = await createUnit('GEHEIM');
    const units = businessUnitsResponseSchema.parse(
      (await call(users.zweit, 'GET', '/business-units')).body,
    );
    expect(units.businessUnits.map((entry) => entry.code)).not.toContain('GEHEIM');
    expect((await call(users.zweit, 'GET', `/business-units/${unit.id}`)).status).toBe(404);
    expect(
      (await call(users.zweit, 'PATCH', `/business-units/${unit.id}`, { name: 'X', code: 'X' }))
        .status,
    ).toBe(404);
    expect(
      (await call(users.zweit, 'GET', `/suppliers/${relationships.oem}/zuordnung`)).status,
    ).toBe(404);
    // Eine fremde BU an der eigenen Beziehung: abgelehnt.
    expect(
      await assign(
        users.zweit,
        { businessUnitIds: [unit.id], materialGroupIds: [], primaryMaterialGroupId: null },
        relationships.zweit,
      ),
    ).toMatchObject({ status: 409, body: { code: 'foreign_entry' } });
  });
});
