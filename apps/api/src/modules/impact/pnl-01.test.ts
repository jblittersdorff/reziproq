import { randomUUID } from 'node:crypto';
import { type Database, schema, sql } from '@reziproq/db';
import {
  impactDetailSchema,
  initiativeDetailSchema,
  levers,
  leverVersions,
  pnlLinesSchema,
} from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';

// Tests zu docs/specs/PNL-01.md: Rechenregeln mit Beispielwerten und Rundung auf ganze Cent,
// Versionen der Regeln, erlaubte Wirkungsarten, Wirkung mit Quelle, Hebel, GuV-Zeile und Art,
// Betrag nur als Kennzahl am Initiative-Objekt, GuV-Zeilen der Organisation.
describe('PNL-01 Wirkung einrichten und Hebel-Vorlagen', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const run = randomUUID().slice(0, 8);
  const orgs = { oem: randomUUID(), supplier: randomUUID() };
  const rel = randomUUID();
  const users = {
    sro: `pnl01-sro-${run}`,
    admin: `pnl01-admin-${run}`,
    viewer: `pnl01-viewer-${run}`,
    kam: `pnl01-kam-${run}`,
  };
  const impact = `/suppliers/${rel}/wirkung`;
  let buyerInitiative = '';
  let supplierIdea = '';

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
  const amount = async (lever: string, version: number, baseline: object, month: object) => {
    const result = await db.execute<{ amount: string }>(
      sql`select app_lever_amount(${lever}, ${version}, ${JSON.stringify(baseline)}::jsonb, ${JSON.stringify(month)}::jsonb)::text as amount`,
    );
    return Number(result.rows[0]?.amount);
  };
  const initiative = (title: string) => ({
    title,
    goal: 'Sichern',
    benefitBuyer: 'A',
    benefitSupplier: 'B',
    ownerBuyerName: 'Sara Ost',
    ownerSupplierName: 'Kim Kaiser',
    startsOn: '2099-01-01',
    endsOn: '2099-12-31',
  });

  beforeAll(async () => {
    testApp = await startTestApp();
    db = testApp.adminDb;
    await db.insert(schema.organization).values([
      { id: orgs.oem, name: `PNL1-OEM ${run}` },
      { id: orgs.supplier, name: `PNL1-Lieferant ${run}` },
    ]);
    await db
      .insert(schema.organizationFeature)
      .values({ organizationId: orgs.oem, feature: 'buyer' });
    const person = (
      id: string,
      name: string,
      organizationId: string,
      orgRole: 'admin' | 'member' | 'viewer',
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
        person(users.sro, 'Sara Ost', orgs.oem, 'member'),
        person(users.admin, 'Ada Admin', orgs.oem, 'admin'),
        person(users.viewer, 'Vera Leser', orgs.oem, 'viewer'),
        person(users.kam, 'Kim Kaiser', orgs.supplier, 'admin'),
      ]);
    await insertRelationships(db, [{ id: rel, buyer: orgs.oem, supplier: orgs.supplier }]);
    await db
      .insert(schema.relationshipMember)
      .values({ relationshipId: rel, orgId: orgs.oem, userId: users.sro, teamRole: 'sro' });
    await call(users.sro, 'POST', `/suppliers/${rel}/jbp`, {
      startsAt: '2099-01-15T09:00:00Z',
      location: null,
      locale: 'de',
    });
    buyerInitiative = (
      (await call(users.sro, 'POST', `/suppliers/${rel}/jbp/initiativen`, initiative('Preis')))
        .body as {
        initiative: { id: string };
      }
    ).initiative.id;
    supplierIdea = (
      (await call(users.kam, 'POST', `/kunden/${rel}/jbp/initiativen`, initiative('Idee')))
        .body as {
        initiative: { id: string };
      }
    ).initiative.id;
  });

  afterAll(async () => {
    await db.execute(sql`delete from jbp where relationship_id = ${rel}`);
    await db.execute(sql`delete from meeting where relationship_id = ${rel}`);
    await db.execute(sql`delete from pnl_line where org_id = ${orgs.oem}`);
    await deleteRelationships(db, Object.values(orgs));
    await db.execute(sql`delete from app_user where organization_id in ${Object.values(orgs)}`);
    await db.execute(sql`delete from organization_feature where organization_id = ${orgs.oem}`);
    await db.execute(sql`delete from organization where id in ${Object.values(orgs)}`);
    await testApp.close();
  });

  it('jede Rechenregel rechnet mit Beispielwerten auf ganze Cent', async () => {
    // Preis: (12,34 € − 12,00 €) × 2,5 Stück = 0,85 €; × 3,333 = 1,13322 € → 113 Cent.
    expect(
      await amount('price', 1, { price_old: '1234' }, { price_new: '1200', quantity: '2.5' }),
    ).toBe(85);
    expect(
      await amount('price', 1, { price_old: '1234' }, { price_new: '1200', quantity: '3.333' }),
    ).toBe(113);
    // Halbe Cent runden von null weg: 0,5 → 1 und −0,5 → −1.
    expect(
      await amount('price', 1, { price_old: '101' }, { price_new: '100', quantity: '0.5' }),
    ).toBe(1);
    expect(
      await amount('price', 1, { price_old: '100' }, { price_new: '101', quantity: '0.5' }),
    ).toBe(-1);
    expect(
      await amount(
        'cost_avoidance',
        1,
        { price_requested: '5000' },
        { price_agreed: '4800', quantity: '1000' },
      ),
    ).toBe(200_000);
    expect(
      await amount(
        'quality',
        1,
        { defects_before: '40', cost_per_defect: '12550' },
        { defects_after: '12.5' },
      ),
    ).toBe(345_125);
    expect(
      await amount(
        'logistics',
        1,
        { unit_cost_before: '310' },
        { unit_cost_after: '285', quantity: '1200' },
      ),
    ).toBe(30_000);
    expect(
      await amount(
        'working_capital',
        1,
        { inventory_before: '50000000' },
        { inventory_after: '42000000' },
      ),
    ).toBe(8_000_000);
    expect(
      await amount('innovation', 1, { margin_rate: '0.235' }, { additional_revenue: '1000001' }),
    ).toBe(235_000);
    expect(await amount('risk', 1, { probability: '0.15' }, { avoided_damage: '3333333' })).toBe(
      500_000,
    );
  });

  it('jede Version jedes Hebels rechnet weiter; unbekannte Versionen lehnt SQL ab', async () => {
    for (const lever of levers) {
      for (const version of leverVersions[lever]) {
        await expect(
          db.execute(sql`select app_lever_amount(${lever}, ${version}, '{}'::jsonb, '{}'::jsonb)`),
        ).resolves.toBeDefined();
      }
    }
    await expect(
      db.execute(sql`select app_lever_amount('price', 99, '{}'::jsonb, '{}'::jsonb)`),
    ).rejects.toThrow();
  });

  it('nicht erlaubte Kombinationen von Hebel und Wirkungsart lehnt die API ab', async () => {
    const wrong = await call(
      users.sro,
      'PUT',
      `${impact}/initiativen/${buyerInitiative}/einrichten`,
      {
        lever: 'price',
        pnlLineKey: 'material',
        effectType: 'cash',
        effectiveFrom: null,
      },
    );
    expect(wrong).toMatchObject({ status: 400, body: { code: 'wirkungsart_nicht_erlaubt' } });
    const unknownLine = await call(
      users.sro,
      'PUT',
      `${impact}/initiativen/${buyerInitiative}/einrichten`,
      { lever: 'price', pnlLineKey: 'gibt_es_nicht', effectType: 'ebit', effectiveFrom: null },
    );
    expect(unknownLine.status).toBe(400);
    // Leser im Team und der Lieferant richten nichts ein.
    expect(
      (
        await call(users.viewer, 'PUT', `${impact}/initiativen/${buyerInitiative}/einrichten`, {
          lever: 'price',
          pnlLineKey: 'material',
          effectType: 'ebit',
          effectiveFrom: null,
        })
      ).status,
    ).toBe(403);
    expect((await call(users.kam, 'GET', impact)).status).toBe(403);
  });

  it('jede Initiative mit Wirkung hat Quelle, Hebel, GuV-Zeile und Wirkungsart', async () => {
    const detail = impactDetailSchema.parse(
      (
        await call(users.sro, 'PUT', `${impact}/initiativen/${buyerInitiative}/einrichten`, {
          lever: 'price',
          pnlLineKey: 'material',
          effectType: 'ebit',
          effectiveFrom: '2099-02-01',
        })
      ).body,
    );
    expect(detail.impact).toMatchObject({
      lever: 'price',
      leverTemplateVersion: 1,
      pnlLine: { key: 'material', name: 'Materialaufwand' },
      effectType: 'ebit',
    });
    expect(detail.initiative.source).toBe('jbp');
    const list = (await call(users.sro, 'GET', impact)).body as {
      initiatives: { id: string; source: string; maturity: number; impact: unknown }[];
    };
    expect(list.initiatives.find((entry) => entry.id === supplierIdea)).toMatchObject({
      source: 'supplier_idea',
      maturity: 1,
      impact: null,
    });
  });

  it('die Initiative zeigt die Wirkung nur als Kennzahl mit Verweis, beim Lieferanten gar nicht', async () => {
    const buyerView = initiativeDetailSchema.parse(
      (await call(users.sro, 'GET', `/suppliers/${rel}/jbp/initiativen/${buyerInitiative}`)).body,
    );
    expect(buyerView.impact).toEqual({ effectType: 'ebit', lever: 'price' });
    expect(buyerView.maturity.level).toBe(1);
    const supplierView = initiativeDetailSchema.parse(
      (await call(users.kam, 'GET', `/kunden/${rel}/jbp/initiativen/${buyerInitiative}`)).body,
    );
    expect(supplierView.impact).toBeNull();
    expect(JSON.stringify(supplierView)).not.toContain('material');
  });

  it('GuV-Zeilen: Standardzeilen, pflegen nur der Admin', async () => {
    const lines = pnlLinesSchema.parse((await call(users.sro, 'GET', '/pnl-lines')).body);
    expect(lines.lines.map((line) => line.key)).toEqual([
      'revenue',
      'material',
      'quality',
      'logistics',
      'other_opex',
      'inventory',
    ]);
    expect(lines.canManage).toBe(false);
    const line = { key: 'tooling', name: 'Werkzeugkosten', position: 7, active: true };
    expect((await call(users.sro, 'POST', '/pnl-lines', line)).status).toBe(403);
    const created = pnlLinesSchema.parse(
      (await call(users.admin, 'POST', '/pnl-lines', line)).body,
    );
    expect(created.lines.at(-1)).toMatchObject({ key: 'tooling', name: 'Werkzeugkosten' });
    const renamed = pnlLinesSchema.parse(
      (
        await call(users.admin, 'PUT', '/pnl-lines/tooling', {
          name: 'Werkzeug',
          position: 7,
          active: false,
        })
      ).body,
    );
    expect(renamed.lines.find((entry) => entry.key === 'tooling')).toMatchObject({
      name: 'Werkzeug',
      active: false,
    });
  });
});
