import { randomUUID } from 'node:crypto';
import { type Database, schema, sql } from '@reziproq/db';
import { dataExportListSchema } from '@reziproq/shared';
import { strFromU8, unzipSync } from 'fflate';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';
import { DataExportService, exportTables } from './data-export.service.js';
import { insertWorkItems } from '../../testing/work-items.js';

// Tests zu docs/specs/QS-03.md, Gesamtexport: nur Admins, eine ZIP-Datei mit jeder Tabelle der
// Organisation und keiner Zeile anderer Organisationen, Link 24 Stunden gültig, Mail mit Link.

/** Einfacher CSV-Leser für die Prüfung: Kommas, Anführungszeichen, Zeilenumbrüche in Feldern. */
function parseCsv(text: string): Record<string, string>[] {
  const records: string[][] = [];
  let field = '';
  let record: string[] = [];
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') {
      record.push(field);
      field = '';
    } else if (char === '\r') {
      // Zeilenende folgt mit \n
    } else if (char === '\n') {
      record.push(field);
      records.push(record);
      record = [];
      field = '';
    } else field += char;
  }
  const [header = [], ...rows] = records;
  return rows.map((row) =>
    Object.fromEntries(header.map((name, index) => [name, row[index] ?? ''])),
  );
}

describe('QS-03 Gesamtexport', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const run = randomUUID().slice(0, 8);
  const orgs = { oem: randomUUID(), other: randomUUID(), supplier: randomUUID() };
  const rels = { own: randomUUID(), other: randomUUID() };
  const users = {
    admin: `qs3-admin-${run}`,
    member: `qs3-member-${run}`,
    otherAdmin: `qs3-fremd-${run}`,
    kam: `qs3-kam-${run}`,
  };
  let exportId = '';
  let files: Record<string, string> = {};

  const call = async (user: string, method: string, url: string) => {
    const response = await fetch(`${testApp.baseUrl}/api${url}`, {
      method,
      headers: { authorization: `Bearer ${await testApp.signToken({ subject: user })}` },
    });
    return response;
  };

  beforeAll(async () => {
    testApp = await startTestApp();
    db = testApp.adminDb;
    await db.insert(schema.organization).values([
      { id: orgs.oem, name: `QS3-OEM ${run}` },
      { id: orgs.other, name: `QS3-Fremd ${run}` },
      { id: orgs.supplier, name: `QS3-Lieferant ${run}` },
    ]);
    await db.insert(schema.organizationFeature).values([
      { organizationId: orgs.oem, feature: 'buyer' },
      { organizationId: orgs.other, feature: 'buyer' },
    ]);
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
        person(users.admin, 'Ada Admin', orgs.oem, 'admin'),
        person(users.member, 'Max Mitglied', orgs.oem, 'member'),
        person(users.otherAdmin, 'Fritz Fremd', orgs.other, 'admin'),
        person(users.kam, 'Kim Kaiser', orgs.supplier, 'admin'),
      ]);
    await insertRelationships(db, [
      { id: rels.own, buyer: orgs.oem, supplier: orgs.supplier },
      { id: rels.other, buyer: orgs.other, supplier: orgs.supplier },
    ]);
    await db.insert(schema.relationshipMember).values([
      { relationshipId: rels.own, orgId: orgs.oem, userId: users.admin, teamRole: 'sro' },
      { relationshipId: rels.own, orgId: orgs.supplier, userId: users.kam, teamRole: 'sro' },
    ]);
    const action = (relationshipId: string, ownerOrgId: string, title: string) => ({
      relationshipId,
      ownerOrgId,
      visibility: 'shared' as const,
      title,
      ownerSide: 'buyer' as const,
      ownerName: 'Probe',
      dueDate: '2099-01-31',
      sourceType: 'manual' as const,
      createdBy: 'probe',
      createdByName: 'Probe',
    });
    await insertWorkItems(db, [
      action(rels.own, orgs.oem, `Eigene Maßnahme ${run}`),
      // Geteilt, aber vom Lieferanten: sichtbar für den Käufer, gehört aber nicht ihm.
      {
        ...action(rels.own, orgs.supplier, `Maßnahme des Lieferanten ${run}`),
        ownerSide: 'supplier' as const,
      },
      action(rels.other, orgs.other, `Fremde Maßnahme ${run}`),
    ]);
  });

  afterAll(async () => {
    await db.execute(sql`delete from data_export where org_id in ${Object.values(orgs)}`);
    await db.execute(sql`delete from commitment where relationship_id in ${Object.values(rels)}`);
    await db.execute(sql`delete from task where relationship_id in ${Object.values(rels)}`);
    await deleteRelationships(db, Object.values(orgs));
    await db.execute(sql`delete from app_user where organization_id in ${Object.values(orgs)}`);
    await db.execute(
      sql`delete from organization_feature where organization_id in ${Object.values(orgs)}`,
    );
    await db.execute(sql`delete from organization where id in ${Object.values(orgs)}`);
    await testApp.close();
  });

  it('Nur Admins fordern den Gesamtexport an', async () => {
    expect((await call(users.member, 'POST', '/einstellungen/export')).status).toBe(403);
    expect((await call(users.member, 'GET', '/einstellungen/export')).status).toBe(403);
    const requested = await call(users.admin, 'POST', '/einstellungen/export');
    expect(requested.status).toBe(201);
    const list = dataExportListSchema.parse(await requested.json());
    expect(list.exports.map((entry) => entry.status)).toEqual(['pending']);
    exportId = list.exports[0]?.id ?? '';
    // Andere Organisationen sehen den Auftrag nicht.
    const foreign = dataExportListSchema.parse(
      await (await call(users.otherAdmin, 'GET', '/einstellungen/export')).json(),
    );
    expect(foreign.exports).toEqual([]);
  });

  it('Der Gesamtexport geht in einem Schritt und enthält jede Tabelle der Organisation, keine Zeile anderer Organisationen', async () => {
    const service = testApp.app.get(DataExportService);
    await service.process({ exportId, orgId: orgs.oem, userId: users.admin });
    const list = dataExportListSchema.parse(
      await (await call(users.admin, 'GET', '/einstellungen/export')).json(),
    );
    expect(list.exports[0]).toMatchObject({ status: 'done', downloadable: true });
    const response = await call(users.admin, 'GET', `/einstellungen/export/${exportId}/datei`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/zip');
    const zip = unzipSync(new Uint8Array(await response.arrayBuffer()));
    files = Object.fromEntries(Object.entries(zip).map(([name, data]) => [name, strFromU8(data)]));

    expect(Object.keys(files).sort()).toEqual(
      [...exportTables().map((table) => `${table}.csv`), 'spalten.json'].sort(),
    );
    const description = JSON.parse(files['spalten.json'] ?? '{}') as {
      tables: Record<string, { columns: { name: string }[] }>;
    };
    expect(description.tables.commitment?.columns.map((column) => column.name)).toContain('title');
    expect(description.tables.task?.columns.map((column) => column.name)).toContain('title');

    // ZQ-01 (K2-a.3): Die geteilten Maßnahmen sind Zusagen (commitment.csv)
    const actions = parseCsv(files['commitment.csv'] ?? '');
    expect(actions.map((row) => row.title)).toContain(`Eigene Maßnahme ${run}`);
    expect(actions.map((row) => row.title)).not.toContain(`Maßnahme des Lieferanten ${run}`);
    expect(actions.map((row) => row.title)).not.toContain(`Fremde Maßnahme ${run}`);
    // In keiner Tabelle eine Zeile, die einer anderen Organisation gehört.
    for (const [name, text] of Object.entries(files)) {
      if (!name.endsWith('.csv')) continue;
      for (const row of parseCsv(text)) {
        for (const column of ['owner_org_id', 'org_id', 'organization_id']) {
          if (column in row) expect(row[column], `${name} ${column}`).toBe(orgs.oem);
        }
      }
      expect(text, name).not.toContain(orgs.other);
    }
    // Mail mit Link zur Einstellungsseite, ohne Inhalt.
    const [mail] = await db
      .select()
      .from(schema.outboxEvent)
      .where(
        sql`${schema.outboxEvent.emailTemplate} = 'export_ready' and ${schema.outboxEvent.emailRecipient} = ${`${users.admin}@example.com`}`,
      );
    expect(mail).toMatchObject({ emailLink: '/einstellungen/export' });
  }, 60_000);

  it('Der Link des Gesamtexports ist nach 24 Stunden ungültig', async () => {
    const [row] = await db
      .select({ expiresAt: schema.dataExport.expiresAt, createdAt: schema.dataExport.createdAt })
      .from(schema.dataExport)
      .where(sql`id = ${exportId}`);
    const hours = ((row?.expiresAt?.getTime() ?? 0) - Date.now()) / 3_600_000;
    expect(hours).toBeGreaterThan(23.9);
    expect(hours).toBeLessThanOrEqual(24);
    await db.execute(
      sql`update data_export set expires_at = now() - interval '1 minute' where id = ${exportId}`,
    );
    const expired = await call(users.admin, 'GET', `/einstellungen/export/${exportId}/datei`);
    expect(expired.status).toBe(410);
    const list = dataExportListSchema.parse(
      await (await call(users.admin, 'GET', '/einstellungen/export')).json(),
    );
    expect(list.exports[0]?.downloadable).toBe(false);
  });

  it('Beim Lieferanten liest der Export jeden Kunden-Kontext und nimmt nur eigene Zeilen', async () => {
    const requested = dataExportListSchema.parse(
      await (await call(users.kam, 'POST', '/einstellungen/export')).json(),
    );
    const id = requested.exports[0]?.id ?? '';
    await testApp.app
      .get(DataExportService)
      .process({ exportId: id, orgId: orgs.supplier, userId: users.kam });
    const response = await call(users.kam, 'GET', `/einstellungen/export/${id}/datei`);
    expect(response.status).toBe(200);
    const zip = unzipSync(new Uint8Array(await response.arrayBuffer()));
    const actions = parseCsv(strFromU8(zip['commitment.csv'] ?? new Uint8Array()));
    expect(actions.map((row) => row.title)).toEqual([`Maßnahme des Lieferanten ${run}`]);
    const relationships = parseCsv(strFromU8(zip['relationship.csv'] ?? new Uint8Array()));
    // Beide Beziehungen des Lieferanten, je im Kontext ihres Kunden gelesen.
    expect(relationships.map((row) => row.id).sort()).toEqual(Object.values(rels).sort());
  }, 60_000);
});
