import { randomUUID } from 'node:crypto';
import { type Database, schema, sql } from '@reziproq/db';
import { importPreviewSchema, importResultSchema } from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';
import { createSupplierDemoWorkbook } from './generate-demo.js';
import { createImportTemplate, parseImportFile } from './import-file.js';

describe('PLT-07a: Lieferanten- und Spendimport über die API', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const run = randomUUID().slice(0, 8);
  const organizations = { buyer: randomUUID(), other: randomUUID() };
  const users = {
    admin: `p7a-admin-${run}`,
    member: `p7a-member-${run}`,
    viewer: `p7a-viewer-${run}`,
    other: `p7a-other-${run}`,
  };
  const createdVat = `DE${String(Number.parseInt(run, 16) % 1_000_000_000).padStart(9, '0')}`;
  const supplierVat = `${createdVat.slice(0, 2)}${String(
    (Number.parseInt(createdVat.slice(2), 10) + 1) % 1_000_000_000,
  ).padStart(9, '0')}`;
  const token = (user: string) => testApp.signToken({ subject: user });
  const bearerScheme = 'Bearer';

  const postFile = async (user: string, path: string, name: string, content: string) => {
    const form = new FormData();
    form.append('file', new Blob([content], { type: 'text/csv' }), name);
    const response = await fetch(`${testApp.baseUrl}/api${path}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${await token(user)}` },
      body: form,
    });
    return { status: response.status, body: (await response.json().catch(() => null)) as unknown };
  };
  const postBufferFile = async (user: string, path: string, name: string, content: Buffer) => {
    const form = new FormData();
    form.append('file', new Blob([Uint8Array.from(content)]), name);
    const response = await fetch(`${testApp.baseUrl}/api${path}`, {
      method: 'POST',
      headers: { authorization: `${bearerScheme} ${await token(user)}` },
      body: form,
    });
    return { status: response.status, body: (await response.json().catch(() => null)) as unknown };
  };

  beforeAll(async () => {
    testApp = await startTestApp();
    db = testApp.adminDb;
    await db.insert(schema.organization).values([
      { id: organizations.buyer, name: `P7a-OEM ${run}` },
      { id: organizations.other, name: `P7a-Zweit ${run}` },
    ]);
    await db.insert(schema.organizationFeature).values([
      { organizationId: organizations.buyer, feature: 'buyer' },
      { organizationId: organizations.other, feature: 'buyer' },
    ]);
    await db.insert(schema.appUser).values([
      {
        id: users.admin,
        name: 'Import Admin',
        email: `${users.admin}@example.com`,
        organizationId: organizations.buyer,
        orgRole: 'admin',
      },
      {
        id: users.member,
        name: 'Import Nutzer',
        email: `${users.member}@example.com`,
        organizationId: organizations.buyer,
        orgRole: 'member',
      },
      {
        id: users.viewer,
        name: 'Import Leser',
        email: `${users.viewer}@example.com`,
        organizationId: organizations.buyer,
        orgRole: 'viewer',
      },
      {
        id: users.other,
        name: 'Zweit OEM',
        email: `${users.other}@example.com`,
        organizationId: organizations.other,
        orgRole: 'admin',
      },
    ]);
    await db.insert(schema.businessUnit).values({
      orgId: organizations.buyer,
      name: 'Pkw',
      code: `P7A-${run}`,
    });
    await db.insert(schema.materialGroup).values({
      orgId: organizations.buyer,
      name: 'Elektronik',
      code: `P7A-${run}`,
    });
  });

  afterAll(async () => {
    const supplierOrgIds = (
      await db.execute<{ id: string }>(sql`
        select distinct supplier_org_id::text as id from relationship
        where buyer_org_id in ${[organizations.buyer, organizations.other]}
      `)
    ).rows.map((row) => row.id);
    await deleteRelationships(db, [organizations.buyer, organizations.other]);
    await db.delete(schema.appUser).where(sql`${schema.appUser.id} in ${Object.values(users)}`);
    if (supplierOrgIds.length > 0) {
      await db
        .delete(schema.organization)
        .where(sql`${schema.organization.id} in ${supplierOrgIds}`);
    }
    await db
      .delete(schema.organization)
      .where(sql`${schema.organization.id} in ${Object.values(organizations)}`);
    await testApp.close();
  });

  it('Reader lädt Vorlagen, kann aber keine Datei prüfen oder importieren', async () => {
    const template = await testApp.get(
      '/api/suppliers/import/template?type=suppliers&format=csv&locale=en',
      await token(users.viewer),
    );
    expect(template.status).toBe(200);
    expect(await template.text()).toContain('"Country"');

    const denied = await postFile(
      users.viewer,
      '/suppliers/import/preview?type=suppliers',
      'supplier.csv',
      'Name,Country\nExample,DE',
    );
    expect(denied.status).toBe(403);
  });

  it('Business Units dürfen nur Admins importieren und sind anhand des Codes idempotent', async () => {
    const csv = ['Name;Code', `Einheit ${run};BU-${run}`].join('\n');
    const memberPreview = await postFile(
      users.member,
      '/suppliers/import/preview?type=business-units',
      'units.csv',
      csv,
    );
    expect(memberPreview.status).toBe(403);

    const preview = await postFile(
      users.admin,
      '/suppliers/import/preview?type=business-units',
      'units.csv',
      csv,
    );
    expect(importPreviewSchema.parse(preview.body).summary).toEqual({
      new: 1,
      changed: 0,
      unchanged: 0,
      invalid: 0,
    });
    const imported = await postFile(
      users.admin,
      '/suppliers/import?type=business-units',
      'units.csv',
      csv,
    );
    expect(importResultSchema.parse(imported.body).summary.new).toBe(1);

    const repeat = await postFile(
      users.admin,
      '/suppliers/import/preview?type=business-units',
      'units.csv',
      csv,
    );
    expect(importPreviewSchema.parse(repeat.body).summary.unchanged).toBe(1);

    const update = await postFile(
      users.admin,
      '/suppliers/import/preview?type=business-units',
      'units.csv',
      ['Name;Code', `Umbenannt ${run};BU-${run}`].join('\n'),
    );
    expect(importPreviewSchema.parse(update.body).summary.changed).toBe(1);
    await postFile(
      users.admin,
      '/suppliers/import?type=business-units',
      'units.csv',
      ['Name;Code', `Umbenannt ${run};BU-${run}`].join('\n'),
    );
    const saved = await db
      .select()
      .from(schema.businessUnit)
      .where(
        sql`${schema.businessUnit.orgId} = ${organizations.buyer} and ${schema.businessUnit.code} = ${`BU-${run}`}`,
      );
    expect(saved).toHaveLength(1);
    expect(saved[0]?.name).toBe(`Umbenannt ${run}`);
  });

  it('importiert die 50 gültigen Demo-Lieferanten und lässt genau drei fehlerhafte Zeilen aus', async () => {
    const workbook = await createSupplierDemoWorkbook();
    const previewResponse = await postBufferFile(
      users.member,
      '/suppliers/import/preview?type=suppliers',
      'lieferanten-50.xlsx',
      workbook,
    );
    expect(previewResponse.status, JSON.stringify(previewResponse.body)).toBe(201);
    const preview = importPreviewSchema.parse(previewResponse.body);
    expect(preview.summary).toEqual({ new: 50, changed: 0, unchanged: 0, invalid: 3 });
    expect(
      preview.rows.filter((row) => row.status === 'invalid').map((row) => row.issues[0]?.code),
    ).toEqual(['invalid_country', 'invalid_vat_id', 'unknown_material_group']);

    const imported = await postBufferFile(
      users.member,
      '/suppliers/import?type=suppliers',
      'lieferanten-50.xlsx',
      workbook,
    );
    expect(importResultSchema.parse(imported.body).summary).toEqual(preview.summary);
    const count = await db.execute<{ total: number }>(sql`
      select count(*)::int as total
      from relationship r
      join relationship_side s on s.relationship_id = r.id and s.org_id = r.buyer_org_id
      where r.buyer_org_id = ${organizations.buyer}
        and s.external_ref like 'DEMO-%'
    `);
    expect(count.rows[0]?.total).toBe(50);
    // 50 Lieferanten über die echte Datenbank; auf dem CI-Rechner länger als die üblichen 5 s.
  }, 30_000);

  it('erzeugt beim Import dieselben Verlaufseinträge wie das manuelle Anlegen', async () => {
    const vatId = `DE${String(Number.parseInt(randomUUID().slice(0, 8), 16) % 1_000_000_000).padStart(9, '0')}`;
    const name = `Verlauf ${run} (Demo)`;
    const externalRef = `P7A-AUDIT-${run}`;
    const manual = await fetch(`${testApp.baseUrl}/api/suppliers`, {
      method: 'POST',
      headers: {
        authorization: `${bearerScheme} ${await token(users.member)}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        name,
        country: 'DE',
        vatId,
        externalRef,
        spend: { year: 2025, amountCents: 12345 },
      }),
    });
    expect(manual.status).toBe(201);
    const manualBody = (await manual.json()) as { relationshipId: string };

    const supplier = await postFile(
      users.other,
      '/suppliers/import/preview?type=suppliers',
      'supplier.csv',
      `Name;Land;USt-IdNr.;Eigene Lieferantennummer\n${name};DE;${vatId};${externalRef}`,
    );
    expect(supplier.status).toBe(201);
    const imported = await postFile(
      users.other,
      '/suppliers/import?type=suppliers',
      'supplier.csv',
      `Name;Land;USt-IdNr.;Eigene Lieferantennummer\n${name};DE;${vatId};${externalRef}`,
    );
    expect(imported.status).toBe(201);
    await postFile(
      users.other,
      '/suppliers/import?type=spend',
      'spend.csv',
      `Eigene Lieferantennummer;Jahr;Betrag;Währung\n${externalRef};2025;123,45;EUR`,
    );

    const relationships = await db.execute<{ id: string; buyer_org_id: string }>(sql`
      select r.id::text as id, r.buyer_org_id::text as buyer_org_id
      from relationship r
      join relationship_side s on s.relationship_id = r.id and s.org_id = r.buyer_org_id
      where s.external_ref = ${externalRef}
        and r.buyer_org_id in ${[organizations.buyer, organizations.other]}
    `);
    expect(relationships.rows).toHaveLength(2);
    const historyOf = async (relationshipId: string) =>
      db.execute<{ object_type: string; action: string; changes: unknown }>(sql`
        select object_type, action, changes
        from audit_event
        where relationship_id = ${relationshipId}
          and object_type in ('relationship', 'relationship_side', 'relationship_spend')
        order by object_type
      `);
    const manualHistory = await historyOf(manualBody.relationshipId);
    const importedId = relationships.rows.find(
      (row) => row.buyer_org_id === organizations.other,
    )?.id;
    expect(importedId).toBeDefined();
    if (!importedId) throw new Error('Importierte Beziehung fehlt');
    const importedHistory = await historyOf(importedId);
    expect(importedHistory.rows).toEqual(manualHistory.rows);
  });

  it('lehnt falsche Dateitypen und Uploads über 10 MB ab', async () => {
    const unsupported = await postFile(
      users.member,
      '/suppliers/import/preview?type=suppliers',
      'lieferanten.txt',
      'Name;Land\nBeispiel GmbH (Demo);DE',
    );
    expect(unsupported.status).toBe(400);
    expect(unsupported.body).toMatchObject({ code: 'invalid_file_type' });

    const tooLarge = await postFile(
      users.member,
      '/suppliers/import/preview?type=suppliers',
      'lieferanten.csv',
      `Name;Land\n${'x'.repeat(10 * 1024 * 1024)}`,
    );
    expect(tooLarge.status).toBe(413);
  });

  it('validiert Zeilen, übernimmt nur gültige Daten und meldet denselben Import danach unverändert', async () => {
    const csv = [
      'Name;Land;USt-IdNr.;Eigene Lieferantennummer;Business Units;Warengruppen',
      `"Lieferant ${run} (Demo)";DE;${createdVat};P7A-${run};Pkw;Elektronik`,
      `"Fehler ${run} (Demo)";DE;${supplierVat};P7A-INVALID;Unbekannt;Elektronik`,
    ].join('\n');
    const previewResponse = await postFile(
      users.member,
      '/suppliers/import/preview?type=suppliers',
      'lieferanten.csv',
      csv,
    );
    expect(previewResponse.status, JSON.stringify(previewResponse.body)).toBe(201);
    const preview = importPreviewSchema.parse(previewResponse.body);
    expect(preview.summary).toEqual({ new: 1, changed: 0, unchanged: 0, invalid: 1 });
    expect(preview.rows[1]?.issues).toContainEqual(
      expect.objectContaining({ code: 'unknown_business_unit', field: 'Business Units' }),
    );

    const imported = await postFile(
      users.member,
      '/suppliers/import?type=suppliers',
      'lieferanten.csv',
      csv,
    );
    expect(imported.status, JSON.stringify(imported.body)).toBe(201);
    expect(importResultSchema.parse(imported.body).summary).toEqual(preview.summary);

    const repeated = await postFile(
      users.member,
      '/suppliers/import/preview?type=suppliers',
      'lieferanten.csv',
      csv,
    );
    expect(importPreviewSchema.parse(repeated.body).summary).toEqual({
      new: 0,
      changed: 0,
      unchanged: 1,
      invalid: 1,
    });

    const updateWithoutExternalRef = [
      'Name;Land;USt-IdNr.',
      `"Geänderter Lieferant ${run} (Demo)";DE;${createdVat}`,
    ].join('\n');
    const updatePreview = await postFile(
      users.member,
      '/suppliers/import/preview?type=suppliers',
      'lieferanten.csv',
      updateWithoutExternalRef,
    );
    expect(importPreviewSchema.parse(updatePreview.body).summary).toEqual({
      new: 0,
      changed: 1,
      unchanged: 0,
      invalid: 0,
    });
    const updated = await postFile(
      users.member,
      '/suppliers/import?type=suppliers',
      'lieferanten.csv',
      updateWithoutExternalRef,
    );
    expect(importResultSchema.parse(updated.body).summary.changed).toBe(1);

    const saved = await db.execute<{ amount: number }>(sql`
      select count(*)::int as amount from relationship r
      join organization o on o.id = r.supplier_org_id
      where r.buyer_org_id = ${organizations.buyer} and o.vat_id = ${createdVat}
    `);
    expect(saved.rows[0]?.amount).toBe(1);
    const savedExternalRef = await db.execute<{ external_ref: string }>(sql`
      select s.external_ref from relationship_side s
      join relationship r on r.id = s.relationship_id and r.buyer_org_id = s.org_id
      join organization o on o.id = r.supplier_org_id
      where r.buyer_org_id = ${organizations.buyer} and o.vat_id = ${createdVat}
    `);
    expect(savedExternalRef.rows[0]?.external_ref).toBe(`P7A-${run}`);
    const excluded = await db.execute<{ amount: number }>(sql`
      select count(*)::int as amount from organization where vat_id = ${supplierVat}
    `);
    expect(excluded.rows[0]?.amount).toBe(0);

    const contactFile = [
      'Eigene Lieferantennummer;Name;E-Mail;Funktion;Position',
      `P7A-${run};Ada Example;Ada.Example@Example.com;Einkauf;Leitung`,
    ].join('\n');
    const contactPreview = await postFile(
      users.member,
      '/suppliers/import/preview?type=contacts',
      'kontakte.csv',
      contactFile,
    );
    const contactPreviewBody = importPreviewSchema.parse(contactPreview.body);
    expect(contactPreviewBody.summary, JSON.stringify(contactPreviewBody.rows)).toEqual({
      new: 1,
      changed: 0,
      unchanged: 0,
      invalid: 0,
    });
    const contactImport = await postFile(
      users.member,
      '/suppliers/import?type=contacts',
      'kontakte.csv',
      contactFile,
    );
    expect(importResultSchema.parse(contactImport.body).summary.new).toBe(1);
    const sameContact = await postFile(
      users.member,
      '/suppliers/import/preview?type=contacts',
      'kontakte.csv',
      contactFile,
    );
    expect(importPreviewSchema.parse(sameContact.body).summary.unchanged).toBe(1);

    const invalidEmail = await postFile(
      users.member,
      '/suppliers/import/preview?type=contacts',
      'kontakte.csv',
      ['Eigene Lieferantennummer;Name;E-Mail', `P7A-${run};Ungültig;kein-email`].join('\n'),
    );
    expect(importPreviewSchema.parse(invalidEmail.body).rows[0]?.issues).toContainEqual(
      expect.objectContaining({ code: 'invalid_email' }),
    );

    const supplier = await db.execute<{ id: string }>(sql`
      select r.id
      from relationship r
      join relationship_side s
        on s.relationship_id = r.id
        and s.org_id = r.buyer_org_id
      where r.buyer_org_id = ${organizations.buyer}
        and s.external_ref = ${`P7A-${run}`}
    `);
    const relationshipId = supplier.rows[0]?.id;
    if (!relationshipId) throw new Error('Lieferantenbeziehung fehlt');
    const contacts = await testApp.get(
      `/api/suppliers/${relationshipId}/contacts`,
      await token(users.member),
    );
    const contactsBody = (await contacts.json()) as { id: string; email: string }[];
    expect(contactsBody).toMatchObject([{ email: 'ada.example@example.com' }]);

    const hiddenFromOtherBuyer = await testApp.get(
      `/api/suppliers/${relationshipId}/contacts`,
      await token(users.other),
    );
    expect(hiddenFromOtherBuyer.status).toBe(404);

    const deleteHeaders = new Headers();
    deleteHeaders.set('authorization', `Bearer ${await token(users.member)}`);
    const deleted = await fetch(
      `${testApp.baseUrl}/api/suppliers/${relationshipId}/contacts/${contactsBody[0]?.id}`,
      { method: 'DELETE', headers: deleteHeaders },
    );
    expect(deleted.status).toBe(200);
    const afterDelete = await testApp.get(
      `/api/suppliers/${relationshipId}/contacts`,
      await token(users.member),
    );
    expect(await afterDelete.json()).toEqual([]);
  });

  it('importiert deutsche und englische Spendbeträge in Cent und weist mehrdeutige Beträge ab', async () => {
    const supplier = await db.execute<{ id: string }>(sql`
      select r.id::text as id from relationship r
      join relationship_side s on s.relationship_id = r.id and s.org_id = r.buyer_org_id
      where r.buyer_org_id = ${organizations.buyer} and s.external_ref = ${`P7A-${run}`}
    `);
    expect(supplier.rows).toHaveLength(1);

    const csv = [
      'Eigene Lieferantennummer;Jahr;Betrag;Währung',
      `P7A-${run};2025;1.234.567,89;USD`,
      `P7A-${run};2024;1,234;EUR`,
    ].join('\n');
    const preview = await postFile(
      users.member,
      '/suppliers/import/preview?type=spend',
      'spend.csv',
      csv,
    );
    expect(preview.status, JSON.stringify(preview.body)).toBe(201);
    expect(importPreviewSchema.parse(preview.body).summary).toEqual({
      new: 1,
      changed: 0,
      unchanged: 0,
      invalid: 1,
    });

    const result = await postFile(users.member, '/suppliers/import?type=spend', 'spend.csv', csv);
    expect(importResultSchema.parse(result.body).summary).toEqual({
      new: 1,
      changed: 0,
      unchanged: 0,
      invalid: 1,
    });
    const stored = await db.execute<{ amount_cents: string; currency: string; source: string }>(sql`
      select amount_cents::text, currency, source from relationship_spend
      where relationship_id = ${supplier.rows[0]?.id} and year = 2025
    `);
    expect(stored.rows[0]).toEqual({
      amount_cents: '123456789',
      currency: 'USD',
      source: 'import',
    });

    const otherBuyerPreview = await postFile(
      users.other,
      '/suppliers/import/preview?type=spend',
      'spend.csv',
      ['Eigene Lieferantennummer;Jahr;Betrag', `P7A-${run};2025;1.234,56`].join('\n'),
    );
    const otherBuyer = importPreviewSchema.parse(otherBuyerPreview.body);
    expect(otherBuyer.summary.invalid).toBe(1);
    expect(otherBuyer.rows[0]?.issues).toContainEqual(
      expect.objectContaining({ code: 'unknown_supplier' }),
    );
  });

  it('erzeugt vier CSV- und Excel-Vorlagen, die Parser wieder lesen kann', async () => {
    for (const type of ['suppliers', 'spend', 'business-units', 'contacts'] as const) {
      for (const format of ['csv', 'xlsx'] as const) {
        const template = await createImportTemplate(type, format);
        const parsed = await parseImportFile(`template.${format}`, template);
        expect(parsed.headers.length).toBeGreaterThan(1);
        expect(parsed.rows).toHaveLength(1);
      }
    }
  });

  it('lädt alle acht Vorlagen über die API herunter und importiert sie unverändert', async () => {
    await db.insert(schema.businessUnit).values({
      orgId: organizations.buyer,
      name: 'Ersatzteile',
      code: `P7A-E-${run}`,
    });
    await db.insert(schema.materialGroup).values({
      orgId: organizations.buyer,
      name: 'Sensorik',
      code: `P7A-S-${run}`,
    });

    for (const type of ['suppliers', 'spend', 'business-units', 'contacts'] as const) {
      const user = type === 'business-units' ? users.admin : users.member;
      for (const [index, format] of (['csv', 'xlsx'] as const).entries()) {
        const downloaded = await testApp.get(
          `/api/suppliers/import/template?type=${type}&format=${format}&locale=de`,
          await token(user),
        );
        expect(downloaded.status).toBe(200);
        const buffer = Buffer.from(await downloaded.arrayBuffer());
        expect(buffer.byteLength).toBeGreaterThan(0);

        const previewResponse = await postBufferFile(
          user,
          `/suppliers/import/preview?type=${type}`,
          `vorlage.${format}`,
          buffer,
        );
        expect(previewResponse.status, JSON.stringify(previewResponse.body)).toBe(201);
        const preview = importPreviewSchema.parse(previewResponse.body);
        expect(preview.summary.invalid).toBe(0);

        const imported = await postBufferFile(
          user,
          `/suppliers/import?type=${type}`,
          `vorlage.${format}`,
          buffer,
        );
        expect(imported.status, JSON.stringify(imported.body)).toBe(201);
        expect(importResultSchema.parse(imported.body).summary.invalid).toBe(0);

        if (index === 1) {
          expect(preview.summary).toMatchObject({
            new: 0,
            changed: 0,
            unchanged: 1,
            invalid: 0,
          });
        }
      }
    }
  });
});
