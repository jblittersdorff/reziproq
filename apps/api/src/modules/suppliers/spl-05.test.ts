import { randomUUID } from 'node:crypto';
import { type Database, schema, sql } from '@reziproq/db';
import { financialImportResultSchema, supplierProfileSchema } from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';

// Tests zu docs/specs/SPL-05.md: Kennzahl nur mit Jahr, Einheit und Quelle; unser Anteil und kein
// Anteil bei anderer Währung; CSV-Import mit zwölf Zeilen in einem Schritt, Fehler markiert;
// Cent und Basispunkte; der Lieferant sieht nichts.
describe('SPL-05 Profil und Finanzen', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const run = randomUUID().slice(0, 8);
  const orgs = { oem: randomUUID(), supplier: randomUUID() };
  const rel = randomUUID();
  const users = { buyer: `spl05-b-${run}`, supplier: `spl05-s-${run}` };
  const base = `/suppliers/${rel}/profil`;

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
  const upload = async (content: string) => {
    const form = new FormData();
    form.append('file', new Blob([content], { type: 'text/csv' }), 'kennzahlen.csv');
    const response = await fetch(`${testApp.baseUrl}/api${base}/kennzahlen/import`, {
      method: 'POST',
      headers: { authorization: `Bearer ${await testApp.signToken({ subject: users.buyer })}` },
      body: form,
    });
    return {
      status: response.status,
      body: financialImportResultSchema.parse(await response.json()),
    };
  };
  const profile = async () =>
    supplierProfileSchema.parse((await call(users.buyer, 'GET', base)).body);

  beforeAll(async () => {
    testApp = await startTestApp();
    db = testApp.adminDb;
    await db.insert(schema.organization).values([
      { id: orgs.oem, name: `SPL5-OEM ${run}` },
      { id: orgs.supplier, name: `SPL5-L ${run}` },
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
        organizationId: orgs.supplier,
        orgRole: 'admin',
        rolesImportedAt: new Date(),
      },
    ]);
    await insertRelationships(db, [
      {
        id: rel,
        buyer: orgs.oem,
        supplier: orgs.supplier,
        spend: [{ year: 2025, amountCents: 1_000_000_00 }],
      },
    ]);
  });

  afterAll(async () => {
    for (const table of ['supplier_financial', 'supplier_executive', 'supplier_profile']) {
      await db.execute(sql`delete from ${sql.identifier(table)} where relationship_id = ${rel}`);
    }
    await deleteRelationships(db, Object.values(orgs));
    await db.execute(sql`delete from app_user where organization_id in ${Object.values(orgs)}`);
    await db.execute(sql`delete from organization_feature where organization_id = ${orgs.oem}`);
    await db.execute(sql`delete from organization where id in ${Object.values(orgs)}`);
    await testApp.close();
  });

  it('eine Kennzahl hat Jahr, Einheit und Quelle; ohne Quelle lässt sie sich nicht speichern', async () => {
    const revenue = { year: 2025, metric: 'revenue', value: 20_000_000_00, currency: 'EUR' };
    expect(
      (await call(users.buyer, 'POST', `${base}/kennzahlen`, { ...revenue, source: ' ' })).status,
    ).toBe(400);
    // Quote mit Währung passt nicht zur Einheit.
    expect(
      (
        await call(users.buyer, 'POST', `${base}/kennzahlen`, {
          year: 2025,
          metric: 'ebit_margin',
          value: 850,
          currency: 'EUR',
          source: 'Bericht',
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await call(users.buyer, 'POST', `${base}/kennzahlen`, {
          ...revenue,
          source: 'Geschäftsbericht 2025',
        })
      ).status,
    ).toBe(201);
    await expect(
      db.execute(sql`
        insert into supplier_financial (relationship_id, year, metric, value, unit, source, updated_by)
        values (${rel}, 2024, 'revenue', 1, 'cents', ' ', 'x')
      `),
    ).rejects.toThrow();
  });

  it('unser Anteil stimmt und erscheint nicht bei unterschiedlichen Währungen', async () => {
    // 1 Mio. € Spend zu 20 Mio. € Umsatz = 5 %.
    expect((await profile()).share).toEqual({ status: 'ok', year: 2025, basisPoints: 500 });
    const usd = (await profile()).financials.find((entry) => entry.metric === 'revenue');
    await call(users.buyer, 'PUT', `${base}/kennzahlen/${usd?.id}`, {
      year: 2025,
      metric: 'revenue',
      value: 20_000_000_00,
      currency: 'USD',
      source: 'Geschäftsbericht 2025',
    });
    expect((await profile()).share).toEqual({ status: 'currency_mismatch', year: 2025 });
  });

  it('ein CSV mit zwölf Zeilen gelingt in einem Schritt; Beträge in Cent, Quoten in Basispunkten', async () => {
    const lines = ['Jahr;Kennzahl;Wert;Einheit;Quelle'];
    for (const year of [2022, 2023, 2024]) {
      lines.push(`${year};Umsatz;12.500.000;EUR;Bundesanzeiger`);
      lines.push(`${year};EBIT-Marge;8,5;%;Bundesanzeiger`);
      lines.push(`${year};Nettoverschuldung;-1.200.000;EUR;Bundesanzeiger`);
      lines.push(`${year};Eigenkapitalquote;35;%;Bundesanzeiger`);
    }
    const result = await upload(lines.join('\n'));
    expect(result.body).toEqual({ imported: 12, rows: [] });
    const values = (await profile()).financials.filter((entry) => entry.year === 2023);
    expect(values.map((entry) => [entry.metric, entry.value, entry.unit, entry.currency])).toEqual([
      ['revenue', 12_500_000_00, 'cents', 'EUR'],
      ['ebit_margin', 850, 'basis_points', null],
      ['net_debt', -1_200_000_00, 'cents', 'EUR'],
      ['equity_ratio', 3500, 'basis_points', null],
    ]);
  });

  it('fehlerhafte Zeilen sind markiert, dann wird nichts übernommen', async () => {
    const before = (await profile()).financials.length;
    const result = await upload(
      [
        'Jahr;Kennzahl;Wert;Einheit;Quelle',
        '2021;Umsatz;10.000.000;EUR;Bericht',
        '21;Umsatz;1;EUR;Bericht',
        '2021;Gewinn;1;EUR;Bericht',
        '2021;EBIT-Marge;8;EUR;Bericht',
        '2021;Liquidität;1000;EUR;',
      ].join('\n'),
    );
    expect(result.body.imported).toBe(0);
    expect(result.body.rows).toEqual([
      { row: 3, issues: ['invalid_year'] },
      { row: 4, issues: ['unknown_metric'] },
      { row: 5, issues: ['invalid_unit'] },
      { row: 6, issues: ['source_required'] },
    ]);
    expect((await profile()).financials).toHaveLength(before);
  });

  it('Profil, Geschäftsleitung und Einschätzung; der Lieferant sieht nichts davon', async () => {
    await call(users.buyer, 'PUT', `${base}/unternehmen`, {
      headquarters: 'Freiburg',
      foundedYear: 1987,
      employees: 1200,
      businessSegments: 'Elektronik, Sensorik',
    });
    await call(users.buyer, 'PUT', `${base}/geschaeftsleitung`, {
      executives: [{ name: 'Petra Wolf', role: 'CEO', since: 2019 }],
    });
    await call(users.buyer, 'PUT', `${base}/einschaetzung`, { implications: 'Wir sind wichtig.' });
    const data = await profile();
    expect(data.company).toEqual({
      headquarters: 'Freiburg',
      foundedYear: 1987,
      employees: 1200,
      businessSegments: 'Elektronik, Sensorik',
    });
    expect(data.executives.map((entry) => entry.name)).toEqual(['Petra Wolf']);
    expect(data.implications).toBe('Wir sind wichtig.');
    expect((await call(users.supplier, 'GET', base)).status).toBe(403);
  });
});
