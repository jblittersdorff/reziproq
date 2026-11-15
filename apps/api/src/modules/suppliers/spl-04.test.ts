import { randomUUID } from 'node:crypto';
import { type Database, schema, sql } from '@reziproq/db';
import { spendOverviewSchema, supplierDetailSchema } from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';

// Tests zu docs/specs/SPL-04.md: Summen je Jahr, BU und Warengruppe wie in der Datenbank; Anteil
// am gesamten Spend; Import mit den neuen Spalten und alte Dateien ohne sie; der Lieferant nie.
describe('SPL-04 Spend-Entwicklung', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const run = randomUUID().slice(0, 8);
  const orgs = { oem: randomUUID(), a: randomUUID(), b: randomUUID() };
  const rel = { a: randomUUID(), b: randomUUID() };
  const units = { pkw: randomUUID(), lkw: randomUUID() };
  const group = randomUUID();
  const users = { buyer: `spl04-b-${run}`, supplier: `spl04-s-${run}` };
  const refA = `SPL4-${run}`;

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
  const importFile = async (content: string) => {
    const form = new FormData();
    form.append('file', new Blob([content], { type: 'text/csv' }), 'spend.csv');
    const response = await fetch(`${testApp.baseUrl}/api/suppliers/import?type=spend`, {
      method: 'POST',
      headers: { authorization: `Bearer ${await testApp.signToken({ subject: users.buyer })}` },
      body: form,
    });
    return { status: response.status, body: (await response.json().catch(() => null)) as unknown };
  };
  const entry = (year: number, amountCents: number, extra: Record<string, unknown> = {}) => ({
    year,
    kind: 'actual',
    businessUnitId: null,
    materialGroupId: null,
    amountCents,
    currency: 'EUR',
    ...extra,
  });
  const overview = async () =>
    spendOverviewSchema.parse((await call(users.buyer, 'GET', `/suppliers/${rel.a}/spend`)).body);

  beforeAll(async () => {
    testApp = await startTestApp();
    db = testApp.adminDb;
    await db.insert(schema.organization).values([
      { id: orgs.oem, name: `SPL4-OEM ${run}` },
      { id: orgs.a, name: `SPL4-A ${run}` },
      { id: orgs.b, name: `SPL4-B ${run}` },
    ]);
    await db
      .insert(schema.organizationFeature)
      .values({ organizationId: orgs.oem, feature: 'buyer' });
    await db.insert(schema.appUser).values([
      {
        id: users.buyer,
        name: 'Sara Ost',
        email: `${users.buyer}@example.com`,
        organizationId: orgs.oem,
        orgRole: 'member',
        rolesImportedAt: new Date(),
      },
      {
        id: users.supplier,
        name: 'Kim Kaiser',
        email: `${users.supplier}@example.com`,
        organizationId: orgs.a,
        orgRole: 'admin',
        rolesImportedAt: new Date(),
      },
    ]);
    await insertRelationships(db, [
      { id: rel.a, buyer: orgs.oem, supplier: orgs.a, externalRef: refA },
      { id: rel.b, buyer: orgs.oem, supplier: orgs.b },
    ]);
    await db.insert(schema.businessUnit).values([
      { id: units.pkw, orgId: orgs.oem, name: `Pkw ${run}`, code: `P-${run}` },
      { id: units.lkw, orgId: orgs.oem, name: `Lkw ${run}`, code: `L-${run}` },
    ]);
    await db
      .insert(schema.materialGroup)
      .values({ id: group, orgId: orgs.oem, name: `Elektronik ${run}`, code: `E-${run}` });
    // Der andere Lieferant: 300 € Ist im Jahr 2025, für den Anteil am gesamten Spend.
    await db.insert(schema.relationshipSpend).values({
      relationshipId: rel.b,
      year: 2025,
      amountCents: 300_00,
    });
  });

  afterAll(async () => {
    await db.execute(
      sql`delete from relationship_spend where relationship_id in ${Object.values(rel)}`,
    );
    await db.execute(sql`delete from business_unit where org_id = ${orgs.oem}`);
    await db.execute(sql`delete from material_group where org_id = ${orgs.oem}`);
    await deleteRelationships(db, Object.values(orgs));
    await db.execute(sql`delete from app_user where organization_id in ${Object.values(orgs)}`);
    await db.execute(sql`delete from organization_feature where organization_id = ${orgs.oem}`);
    await db.execute(sql`delete from organization where id in ${Object.values(orgs)}`);
    await testApp.close();
  });

  it('Summen je Jahr, BU und Warengruppe stimmen mit der Datenbank; der Anteil mit Testdaten', async () => {
    for (const body of [
      entry(2024, 80_00),
      entry(2025, 60_00, { businessUnitId: units.pkw, materialGroupId: group }),
      entry(2025, 40_00, { businessUnitId: units.lkw }),
      entry(2026, 120_00, { kind: 'plan', businessUnitId: units.pkw }),
    ]) {
      expect(
        (await call(users.buyer, 'POST', `/suppliers/${rel.a}/spend/eintraege`, body)).status,
      ).toBe(201);
    }
    // Dieselbe Kombination ein zweites Mal ist ein Konflikt.
    expect(
      (await call(users.buyer, 'POST', `/suppliers/${rel.a}/spend/eintraege`, entry(2024, 1)))
        .status,
    ).toBe(409);
    const data = await overview();
    const db2025 = await db.execute<{ total: string }>(sql`
      select sum(amount_cents)::text as total from relationship_spend
      where relationship_id = ${rel.a} and year = 2025 and kind = 'actual'
    `);
    const y2025 = data.years.find((year) => year.year === 2025 && year.kind === 'actual');
    expect(y2025?.amountCents).toBe(Number(db2025.rows[0]?.total));
    expect(y2025?.byBusinessUnit.map((part) => [part.name, part.amountCents])).toEqual([
      [`Lkw ${run}`, 40_00],
      [`Pkw ${run}`, 60_00],
    ]);
    expect(y2025?.byMaterialGroup.map((part) => [part.name, part.amountCents])).toEqual([
      [`Elektronik ${run}`, 60_00],
      [null, 40_00],
    ]);
    expect(data.years.map((year) => `${year.year}:${year.kind}`)).toEqual([
      '2024:actual',
      '2025:actual',
      '2026:plan',
    ]);
    // Letztes Ist-Jahr 2025: 100 € gegenüber 80 € (+25 %), Anteil 100 von 400 € = 25 %.
    expect(data.kpis).toEqual({
      year: 2025,
      amount: { amountCents: 100_00, currency: 'EUR' },
      previous: { amountCents: 80_00, currency: 'EUR' },
      changeBasisPoints: 2500,
      shareBasisPoints: 2500,
    });
    // Liste, Detail und Kachel lesen die Summe des Jahres.
    const detail = supplierDetailSchema.parse(
      (await call(users.buyer, 'GET', `/suppliers/${rel.a}`)).body,
    );
    expect(detail.spend.map((year) => [year.year, year.amount.amountCents])).toEqual([
      [2025, 100_00],
      [2024, 80_00],
    ]);
  });

  it('Plan bis zehn Jahre voraus, Ist höchstens bis zum nächsten Jahr', async () => {
    const future = new Date().getFullYear() + 5;
    expect(
      (await call(users.buyer, 'POST', `/suppliers/${rel.a}/spend/eintraege`, entry(future, 1)))
        .status,
    ).toBe(400);
    expect(
      (
        await call(
          users.buyer,
          'POST',
          `/suppliers/${rel.a}/spend/eintraege`,
          entry(future, 1, { kind: 'plan' }),
        )
      ).status,
    ).toBe(201);
  });

  it('der Import kennt Art, Business Unit und Warengruppe; alte Dateien gehen weiter', async () => {
    const old = await importFile(
      `Eigene Lieferantennummer;Jahr;Betrag;Währung\n${refA};2023;50,00;EUR`,
    );
    expect(old.status).toBe(201);
    const extended = await importFile(
      [
        'Eigene Lieferantennummer;Jahr;Betrag;Währung;Art;Business Unit;Warengruppe',
        `${refA};2023;10,00;EUR;Ist;Pkw ${run};`,
        `${refA};2027;200,00;EUR;Plan;;Elektronik ${run}`,
      ].join('\n'),
    );
    expect(extended.status).toBe(201);
    const data = await overview();
    const y2023 = data.years.find((year) => year.year === 2023);
    expect(y2023?.amountCents).toBe(60_00);
    expect(data.years.find((year) => year.year === 2027)?.kind).toBe('plan');
    // Unbekannte Werte sind markiert.
    const form = new FormData();
    form.append(
      'file',
      new Blob([
        `Eigene Lieferantennummer;Jahr;Betrag;Art;Business Unit\n${refA};2023;1;Prognose;Bus`,
      ]),
      'x.csv',
    );
    const preview = await fetch(`${testApp.baseUrl}/api/suppliers/import/preview?type=spend`, {
      method: 'POST',
      headers: { authorization: `Bearer ${await testApp.signToken({ subject: users.buyer })}` },
      body: form,
    });
    const codes = JSON.stringify(await preview.json());
    expect(codes).toContain('invalid_kind');
    expect(codes).toContain('unknown_business_unit');
  });

  it('der Lieferant sieht den Spend nie', async () => {
    expect((await call(users.supplier, 'GET', `/suppliers/${rel.a}/spend`)).status).toBe(403);
  });
});
