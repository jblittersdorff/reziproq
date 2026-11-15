import { randomUUID } from 'node:crypto';
import { type Database, schema, sql } from '@reziproq/db';
import { portfolioImpactSchema } from '@reziproq/shared';
import ExcelJS from 'exceljs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';

// Tests zu docs/specs/PNL-11.md: Rechenweg, Baseline und Freigabe je Initiative; Übersicht wie die
// Seite Wirkung; keine Summe über Wirkungsarten; ein SRO bekommt nur seine Beziehungen; die Datei
// wird geöffnet und geprüft.
describe('PNL-11 Excel-Export für das Controlling', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const run = randomUUID().slice(0, 8);
  const orgs = { oem: randomUUID(), a: randomUUID(), b: randomUUID() };
  const rel = { a: randomUUID(), b: randomUUID() };
  const users = {
    admin: `pnl11-adm-${run}`,
    controller: `pnl11-ctl-${run}`,
    sro: `pnl11-sro-${run}`,
    member: `pnl11-m-${run}`,
  };
  const ids: Record<string, string> = {};

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
  const download = async (user: string, url: string) => {
    const response = await fetch(`${testApp.baseUrl}/api${url}`, {
      headers: { authorization: `Bearer ${await testApp.signToken({ subject: user })}` },
    });
    if (!response.ok) return { status: response.status, workbook: null, disposition: null };
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await response.arrayBuffer());
    return {
      status: response.status,
      workbook,
      disposition: response.headers.get('content-disposition'),
    };
  };
  const rows = (workbook: ExcelJS.Workbook, sheet: string) => {
    const result: unknown[][] = [];
    workbook.getWorksheet(sheet)?.eachRow((row) => {
      result.push((row.values as unknown[]).slice(1));
    });
    return result;
  };
  const initiative = async (
    relationshipId: string,
    title: string,
    effect: { lever: string; effectType: string; baseline: object },
    months: { month: string; kind: 'plan' | 'actual'; inputs: object }[],
  ) => {
    const impact = `/suppliers/${relationshipId}/wirkung`;
    const id = (
      (
        await call(users.admin, 'POST', `/suppliers/${relationshipId}/jbp/initiativen`, {
          title,
          goal: 'Ziel',
          benefitBuyer: 'A',
          benefitSupplier: 'B',
          ownerBuyerName: 'Ada Admin',
          ownerSupplierName: 'Kim Kaiser',
          startsOn: '2099-01-01',
          endsOn: '2100-12-31',
        })
      ).body as { initiative: { id: string } }
    ).initiative.id;
    await call(users.admin, 'PUT', `${impact}/initiativen/${id}/einrichten`, {
      lever: effect.lever,
      pnlLineKey: 'material',
      effectType: effect.effectType,
      effectiveFrom: '2099-03-01',
    });
    await call(users.admin, 'POST', `${impact}/initiativen/${id}/baseline`, {
      inputs: effect.baseline,
      changeReason: null,
    });
    for (const month of months) {
      await call(users.admin, 'POST', `${impact}/initiativen/${id}/monate`, month);
    }
    return id;
  };

  beforeAll(async () => {
    testApp = await startTestApp();
    db = testApp.adminDb;
    await db.insert(schema.organization).values([
      { id: orgs.oem, name: `PNL11-OEM ${run}` },
      { id: orgs.a, name: `PNL11-A ${run}` },
      { id: orgs.b, name: `PNL11-B ${run}` },
    ]);
    await db
      .insert(schema.organizationFeature)
      .values({ organizationId: orgs.oem, feature: 'buyer' });
    const person = (
      id: string,
      name: string,
      orgRole: 'admin' | 'member' | 'viewer',
      isControlling = false,
    ) => ({
      id,
      name,
      email: `${id}@example.com`,
      organizationId: orgs.oem,
      orgRole,
      isControlling,
      rolesImportedAt: new Date(),
    });
    await db
      .insert(schema.appUser)
      .values([
        person(users.admin, 'Ada Admin', 'admin'),
        person(users.controller, 'Carla Controlling', 'viewer', true),
        person(users.sro, 'Sara Ost', 'member'),
        person(users.member, 'Tom Berg', 'member'),
      ]);
    await insertRelationships(db, [
      { id: rel.a, buyer: orgs.oem, supplier: orgs.a },
      { id: rel.b, buyer: orgs.oem, supplier: orgs.b },
    ]);
    await db.insert(schema.relationshipSide).values([
      { relationshipId: rel.a, orgId: orgs.oem, isFocus: true, focusReason: 'Test' },
      { relationshipId: rel.b, orgId: orgs.oem, isFocus: true, focusReason: 'Test' },
    ]);
    await db.insert(schema.relationshipMember).values([
      { relationshipId: rel.a, orgId: orgs.oem, userId: users.sro, teamRole: 'sro' },
      { relationshipId: rel.b, orgId: orgs.oem, userId: users.member, teamRole: 'member' },
    ]);
    for (const id of Object.values(rel)) {
      await call(users.admin, 'POST', `/suppliers/${id}/jbp`, {
        startsAt: '2099-01-15T09:00:00Z',
        location: null,
        locale: 'de',
      });
    }
    const price = { lever: 'price', effectType: 'ebit', baseline: { price_old: '1234' } };
    ids.a = await initiative(rel.a, 'Preis A', price, [
      { month: '2099-03', kind: 'actual', inputs: { price_new: '1200', quantity: '100' } },
    ]);
    ids.avoid = await initiative(
      rel.a,
      'Vermeidung A',
      {
        lever: 'cost_avoidance',
        effectType: 'cost_avoidance',
        baseline: { price_requested: '5000' },
      },
      [{ month: '2099-04', kind: 'plan', inputs: { price_agreed: '4800', quantity: '10' } }],
    );
    ids.b = await initiative(rel.b, 'Preis B', price, [
      { month: '2099-04', kind: 'actual', inputs: { price_new: '1200', quantity: '50' } },
    ]);
    await db.insert(schema.initiativeValidation).values({
      relationshipId: rel.b,
      initiativeId: ids.b,
      periodFrom: '2099-04-01',
      periodTo: '2099-04-30',
      status: 'approved',
      requestedBy: users.admin,
      requestedByName: 'Ada Admin',
      decidedBy: users.controller,
      decidedByName: 'Carla Controlling',
      decidedAt: new Date(),
      comment: 'Belege geprüft',
    });
  });

  afterAll(async () => {
    for (const id of Object.values(rel)) {
      await db.execute(sql`delete from jbp where relationship_id = ${id}`);
      await db.execute(sql`delete from meeting where relationship_id = ${id}`);
    }
    await db.execute(sql`delete from pnl_line where org_id = ${orgs.oem}`);
    await deleteRelationships(db, Object.values(orgs));
    await db.execute(sql`delete from app_user where organization_id in ${Object.values(orgs)}`);
    await db.execute(sql`delete from organization_feature where organization_id = ${orgs.oem}`);
    await db.execute(sql`delete from organization where id in ${Object.values(orgs)}`);
    await testApp.close();
  });

  it('die Datei hat alle Blätter, Rechenweg, Baseline und Freigabe je Initiative und Euro mit zwei Stellen', async () => {
    const { workbook, disposition } = await download(users.controller, '/wirkung/export');
    expect(workbook?.worksheets.map((sheet) => sheet.name)).toEqual([
      'Übersicht',
      'Initiativen',
      'Monatswerte',
      'Rechenweg',
      'Baseline',
      'Freigaben',
    ]);
    expect(disposition).toContain(`PNL11-OEM_${run}_Jahreswirkung_`);
    const book = workbook as ExcelJS.Workbook;
    expect(rows(book, 'Rechenweg')).toContainEqual([
      'Preis A',
      'Preis',
      1,
      '2099-03',
      'Ist',
      'price_new=1200; quantity=100',
      'Ada Admin',
      34,
    ]);
    expect(rows(book, 'Baseline').map((row) => [row[0], row[1], row[3], row[5]])).toContainEqual([
      'Preis B',
      1,
      'price_old=1234',
      'Ada Admin',
    ]);
    expect(rows(book, 'Freigaben')[1]).toEqual(
      expect.arrayContaining([
        'Preis B',
        '2099-04-01',
        'freigegeben',
        'Carla Controlling',
        'Belege geprüft',
      ]),
    );
    expect(book.getWorksheet('Monatswerte')?.getRow(2).getCell(6).numFmt).toBe('#,##0.00 "€"');
  });

  it('die Summen in der Übersicht stimmen mit der Seite Wirkung; keine Summe über Arten', async () => {
    const page = portfolioImpactSchema.parse(
      (await call(users.controller, 'GET', '/wirkung/portfolio')).body,
    );
    const { workbook } = await download(users.controller, '/wirkung/export');
    const overview = rows(workbook as ExcelJS.Workbook, 'Übersicht');
    const names: Record<string, string> = { ebit: 'EBIT', cost_avoidance: 'Kostenvermeidung' };
    for (const entry of page.pipeline) {
      const row = overview.find((cells) => cells[0] === names[entry.effectType]);
      expect(row?.slice(1, 6)).toEqual(entry.levels.map((level) => level.amountCents / 100));
    }
    // Jede Datenzeile nennt genau eine Wirkungsart; eine Gesamtzeile gibt es nicht.
    const labels = overview.map((cells) => cells[0]).filter((label) => typeof label === 'string');
    expect(labels.some((label) => /gesamt|summe|total/i.test(String(label)))).toBe(false);
  });

  it('ein SRO bekommt nur seine Beziehungen; ohne SRO-Rolle gibt es keinen Export', async () => {
    const { workbook } = await download(users.sro, '/wirkung/export');
    const relationships = new Set(
      rows(workbook as ExcelJS.Workbook, 'Initiativen')
        .slice(1)
        .map((row) => row[0]),
    );
    expect([...relationships]).toEqual([`PNL11-A ${run}`]);
    expect((await download(users.member, '/wirkung/export')).status).toBe(403);
    expect(
      (await download(users.sro, `/suppliers/${rel.b}/wirkung/export`)).workbook?.getWorksheet(
        'Initiativen',
      )?.rowCount,
    ).toBe(1);
  });
});
