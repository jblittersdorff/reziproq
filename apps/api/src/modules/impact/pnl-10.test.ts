import { randomUUID } from 'node:crypto';
import { type Database, schema, sql } from '@reziproq/db';
import { bridgeSchema, portfolioImpactSchema } from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';

// Tests zu docs/specs/PNL-10.md: Wirkung aller Fokuslieferanten auf einer Seite, Brücke und Summen
// wie initiative_value ohne Savings-Verweis, keine Summe über Wirkungsarten, Jahreswirkung und
// Geschäftsjahr ab April, der Lieferant sieht in seiner Brücke nur geteilte Werte.
describe('PNL-10 P&L-Brücke und Wirkung im Portfolio', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const run = randomUUID().slice(0, 8);
  const orgs = { oem: randomUUID(), a: randomUUID(), b: randomUUID(), c: randomUUID() };
  const rel = { a: randomUUID(), b: randomUUID(), c: randomUUID() };
  const unit = randomUUID();
  const users = { admin: `pnl10-adm-${run}`, kam: `pnl10-kam-${run}` };
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
  /** Initiative mit Preis-Hebel: (12,34 € − 12,00 €) × Menge je Monat. */
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
  const price = { lever: 'price', effectType: 'ebit', baseline: { price_old: '1234' } };
  const month = (m: string, kind: 'plan' | 'actual', quantity: string) => ({
    month: m,
    kind,
    inputs: { price_new: '1200', quantity },
  });

  beforeAll(async () => {
    testApp = await startTestApp();
    db = testApp.adminDb;
    await db.insert(schema.organization).values([
      { id: orgs.oem, name: `PNL10-OEM ${run}` },
      { id: orgs.a, name: `PNL10-A ${run}` },
      { id: orgs.b, name: `PNL10-B ${run}` },
      { id: orgs.c, name: `PNL10-C ${run}` },
    ]);
    await db
      .insert(schema.organizationFeature)
      .values({ organizationId: orgs.oem, feature: 'buyer' });
    await db.insert(schema.appUser).values([
      {
        id: users.admin,
        name: 'Ada Admin',
        email: `${users.admin}@example.com`,
        organizationId: orgs.oem,
        orgRole: 'admin',
        rolesImportedAt: new Date(),
      },
      {
        id: users.kam,
        name: 'Kim Kaiser',
        email: `${users.kam}@example.com`,
        organizationId: orgs.a,
        orgRole: 'admin',
        rolesImportedAt: new Date(),
      },
    ]);
    await insertRelationships(db, [
      { id: rel.a, buyer: orgs.oem, supplier: orgs.a },
      { id: rel.b, buyer: orgs.oem, supplier: orgs.b },
      { id: rel.c, buyer: orgs.oem, supplier: orgs.c },
    ]);
    await db.insert(schema.relationshipSide).values([
      { relationshipId: rel.a, orgId: orgs.oem, isFocus: true, focusReason: 'Test' },
      { relationshipId: rel.b, orgId: orgs.oem, isFocus: true, focusReason: 'Test' },
    ]);
    await db
      .insert(schema.businessUnit)
      .values({ id: unit, orgId: orgs.oem, name: `Pkw ${run}`, code: `P-${run}` });
    await db
      .insert(schema.relationshipBusinessUnit)
      .values({ relationshipId: rel.a, businessUnitId: unit });
    for (const id of Object.values(rel)) {
      await call(users.admin, 'POST', `/suppliers/${id}/jbp`, {
        startsAt: '2099-01-15T09:00:00Z',
        location: null,
        locale: 'de',
      });
    }
    // A: Preis 34 € im März (Ist), April und März 2100 (Plan); Vermeidung 20 € im April;
    // eine Initiative mit Savings-Verweis (10 € im April) zählt nicht.
    ids.price = await initiative(rel.a, 'Preis', price, [
      month('2099-03', 'actual', '100'),
      month('2099-04', 'plan', '100'),
      month('2100-03', 'plan', '100'),
    ]);
    ids.avoid = await initiative(
      rel.a,
      'Vermeidung',
      {
        lever: 'cost_avoidance',
        effectType: 'cost_avoidance',
        baseline: { price_requested: '5000' },
      },
      [{ month: '2099-04', kind: 'plan', inputs: { price_agreed: '4800', quantity: '10' } }],
    );
    ids.reference = await initiative(rel.a, 'Im Savings-Tracking', price, [
      month('2099-04', 'plan', '1000'),
    ]);
    await call(
      users.admin,
      'PUT',
      `/suppliers/${rel.a}/wirkung/initiativen/${ids.reference}/savings`,
      {
        system: 'Coupa',
        reference: 'S-1',
      },
    );
    // B: 10 € Ist im April, von Controlling freigegeben; C ist kein Fokuslieferant.
    ids.b = await initiative(
      rel.b,
      'B-Preis',
      { lever: 'price', effectType: 'ebit', baseline: { price_old: '1300' } },
      [month('2099-04', 'actual', '10')],
    );
    await db.insert(schema.initiativeValidation).values({
      relationshipId: rel.b,
      initiativeId: ids.b,
      periodFrom: '2099-04-01',
      periodTo: '2099-04-30',
      status: 'approved',
      requestedBy: users.admin,
      requestedByName: 'Ada Admin',
      decidedBy: users.admin,
      decidedByName: 'Ada Admin',
      decidedAt: new Date(),
    });
    ids.c = await initiative(rel.c, 'C-Preis', price, [month('2099-04', 'plan', '100')]);
    expect(
      (await call(users.admin, 'PUT', '/wirkung/geschaeftsjahr', { startMonth: 4 })).status,
    ).toBe(200);
  });

  afterAll(async () => {
    for (const id of Object.values(rel)) {
      await db.execute(sql`delete from jbp where relationship_id = ${id}`);
      await db.execute(sql`delete from meeting where relationship_id = ${id}`);
    }
    await db.execute(sql`delete from org_setting where org_id = ${orgs.oem}`);
    await db.execute(sql`delete from pnl_line where org_id = ${orgs.oem}`);
    await deleteRelationships(db, Object.values(orgs));
    await db.execute(sql`delete from business_unit where org_id = ${orgs.oem}`);
    await db.execute(sql`delete from app_user where organization_id in ${Object.values(orgs)}`);
    await db.execute(sql`delete from organization_feature where organization_id = ${orgs.oem}`);
    await db.execute(sql`delete from organization where id in ${Object.values(orgs)}`);
    await testApp.close();
  });

  const bridge = async (query: string) =>
    bridgeSchema.parse(
      (await call(users.admin, 'GET', `/suppliers/${rel.a}/wirkung/bruecke${query}`)).body,
    );

  it('die Brücke stimmt mit initiative_value überein, ohne Savings-Verweis; andere Arten daneben', async () => {
    const annual = await bridge('');
    // Jahreswirkung März 2099 bis Februar 2100: März (Ist) und April (Plan).
    expect(annual.steps).toEqual([
      expect.objectContaining({ initiativeId: ids.price, title: 'Preis', amountCents: 68_00 }),
    ]);
    expect(annual.ebitTotal).toBe(68_00);
    expect(annual.others).toEqual([{ effectType: 'cost_avoidance', amountCents: 20_00 }]);
    expect(annual.excluded).toEqual([
      { initiativeId: ids.reference, title: 'Im Savings-Tracking' },
    ]);
    const stored = await db.execute<{ total: string }>(sql`
      select sum(value_cents)::text as total from initiative_value
      where initiative_id = ${ids.price} and month < '2100-03-01'
    `);
    expect(annual.ebitTotal).toBe(Number(stored.rows[0]?.total));
  });

  it('Jahreswirkung und Wirkung im Geschäftsjahr ab April stimmen mit den Testdaten', async () => {
    const fiscal2099 = await bridge('?sicht=geschaeftsjahr&gj=2099');
    expect(fiscal2099.fiscalYearStartMonth).toBe(4);
    // April 2099 bis März 2100: April und März 2100 (Plan).
    expect(fiscal2099.ebitTotal).toBe(68_00);
    const fiscal2098 = await bridge('?sicht=geschaeftsjahr&gj=2098');
    // April 2098 bis März 2099: nur der März (Ist).
    expect(fiscal2098.ebitTotal).toBe(34_00);
    expect(fiscal2099.fiscalYears).toEqual(expect.arrayContaining([2098, 2099]));
  });

  it('der CPO sieht alle Fokuslieferanten auf einer Seite, nie eine Summe über Wirkungsarten', async () => {
    const data = portfolioImpactSchema.parse(
      (await call(users.admin, 'GET', '/wirkung/portfolio?sicht=geschaeftsjahr&gj=2099')).body,
    );
    expect(data.focusSuppliers).toBe(2);
    const total = (effectType: string) =>
      data.pipeline
        .find((entry) => entry.effectType === effectType)
        ?.levels.reduce((sum, level) => sum + level.amountCents, 0);
    // A: 68 € (Preis), B: 10 €; C fehlt, die Savings-Initiative auch.
    expect(total('ebit')).toBe(78_00);
    expect(total('cost_avoidance')).toBe(20_00);
    expect(Object.keys(data)).not.toContain('total');
    expect(data.businessUnits.years).toEqual([2098, 2099, 2100]);
    expect(data.businessUnits.rows).toEqual([
      { id: unit, name: `Pkw ${run}`, amounts: [34_00, 68_00, 0] },
      { id: null, name: null, amounts: [0, 10_00, 0] },
    ]);
    // Realisiert ist nur Ist in freigegebenen Zeiträumen: B, nicht A.
    expect(data.top).toEqual([
      { relationshipId: rel.b, name: `PNL10-B ${run}`, realizedCents: 10_00 },
    ]);
  });

  it('der Lieferant sieht in seiner Brücke nur geteilte Werte', async () => {
    const supplierBridge = async () =>
      bridgeSchema.parse((await call(users.kam, 'GET', `/kunden/${rel.a}/wirkung/bruecke`)).body);
    expect((await supplierBridge()).steps).toEqual([]);
    await call(users.admin, 'PUT', `/suppliers/${rel.a}/wirkung/initiativen/${ids.price}/teilung`, {
      buyerSharePct: 50,
      supplierSharePct: 50,
      ruleText: null,
    });
    await call(
      users.kam,
      'POST',
      `/kunden/${rel.a}/wirkung/initiativen/${ids.price}/teilung/bestaetigen`,
    );
    const shared = await supplierBridge();
    expect(shared.steps.map((step) => step.title)).toEqual(['Preis']);
    expect(shared.others).toEqual([]);
    expect(shared.excluded).toEqual([]);
  });
});
