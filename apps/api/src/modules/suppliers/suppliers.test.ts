import { randomUUID } from 'node:crypto';
import { type Database, schema, sql } from '@reziproq/db';
import { suppliersResponseSchema } from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DATABASE } from '../../common/database.module.js';
import { startTestApp } from '../../testing/test-app.js';

// Tests zu PLT-02 über die API. Sie legen eigene Organisationen mit zufälligen IDs an,
// damit sie neben den Beispieldaten und parallel zu anderen Tests laufen.
describe('GET /api/suppliers', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;

  const ids = {
    oemA: randomUUID(),
    oemB: randomUUID(),
    shared: randomUUID(),
    onlyA: randomUUID(),
    supplierOrg: randomUUID(),
    relAShared: randomUUID(),
    relAOnly: randomUUID(),
    relBShared: randomUUID(),
  };
  const run = randomUUID().slice(0, 8);
  const users = {
    a: `test-a-${run}`,
    b: `test-b-${run}`,
    none: `test-ohne-${run}`,
    supplier: `test-lieferant-${run}`,
  };
  const roleClaim = (role: string) => ({
    'urn:zitadel:iam:org:project:test-project:roles': { [role]: { '1': 'test' } },
  });

  const get = async (user: string, role: string | null = 'nutzer') =>
    testApp.get(
      '/api/suppliers',
      await testApp.signToken({ subject: user, claims: role ? roleClaim(role) : {} }),
    );

  // Liest die Antwort über das gemeinsame Schema; so ist auch der Vertrag mit der Oberfläche geprüft.
  const listFor = async (user: string, role?: string) =>
    suppliersResponseSchema.parse(await (await get(user, role)).json());

  beforeAll(async () => {
    testApp = await startTestApp();
    db = testApp.app.get(DATABASE);
    const { organization, beziehung, beziehungKaeufer, appUser } = schema;

    await db.insert(organization).values([
      { id: ids.oemA, name: `OEM A ${run}`, typ: 'kaeufer', land: 'DE' },
      { id: ids.oemB, name: `OEM B ${run}`, typ: 'kaeufer', land: 'DE' },
      { id: ids.shared, name: `Gemeinsam ${run}`, typ: 'lieferant', land: 'PL' },
      { id: ids.onlyA, name: `Nur A ${run}`, typ: 'lieferant', land: null },
      { id: ids.supplierOrg, name: `Lieferant-Nutzer ${run}`, typ: 'lieferant', land: 'CZ' },
    ]);
    await db.insert(beziehung).values([
      { id: ids.relAShared, kaeuferOrgId: ids.oemA, lieferantOrgId: ids.shared },
      { id: ids.relAOnly, kaeuferOrgId: ids.oemA, lieferantOrgId: ids.onlyA },
      { id: ids.relBShared, kaeuferOrgId: ids.oemB, lieferantOrgId: ids.shared },
    ]);
    await db.insert(beziehungKaeufer).values([
      {
        beziehungId: ids.relAShared,
        warengruppe: 'Guss',
        jahresspendCent: 123_456_78,
        spendJahr: 2025,
      },
      {
        beziehungId: ids.relAOnly,
        warengruppe: 'Logistik',
        jahresspendCent: 500_000_00,
        spendJahr: 2025,
      },
      {
        beziehungId: ids.relBShared,
        warengruppe: 'Schmiedeteile',
        jahresspendCent: 9_999_00,
        spendJahr: 2025,
      },
    ]);
    await db.insert(appUser).values([
      { id: users.a, name: 'Anna A', email: 'a@example.com', organizationId: ids.oemA },
      { id: users.b, name: 'Bea B', email: 'b@example.com', organizationId: ids.oemB },
      { id: users.none, name: 'Nils Ohne', email: 'ohne@example.com', organizationId: null },
      {
        id: users.supplier,
        name: 'Lars L',
        email: 'l@example.com',
        organizationId: ids.supplierOrg,
      },
    ]);
  });

  afterAll(async () => {
    const { organization, beziehung, appUser } = schema;
    const userIds = Object.values(users);
    const orgIds = [ids.oemA, ids.oemB, ids.shared, ids.onlyA, ids.supplierOrg];
    await db.delete(appUser).where(sql`${appUser.id} in ${userIds}`);
    await db.delete(beziehung).where(sql`${beziehung.kaeuferOrgId} in ${orgIds}`);
    await db.delete(organization).where(sql`${organization.id} in ${orgIds}`);
    await testApp.close();
  });

  it('antwortet ohne Login mit 401', async () => {
    expect((await testApp.get('/api/suppliers')).status).toBe(401);
  });

  it('liefert nur Lieferanten der eigenen Organisation, nach Spend absteigend', async () => {
    expect((await get(users.a)).status).toBe(200);
    const body = await listFor(users.a);
    expect(body.suppliers).toEqual([
      {
        relationshipId: ids.relAOnly,
        name: `Nur A ${run}`,
        country: null,
        category: 'Logistik',
        annualSpend: { amountCents: 500_000_00, currency: 'EUR' },
        spendYear: 2025,
      },
      {
        relationshipId: ids.relAShared,
        name: `Gemeinsam ${run}`,
        country: 'PL',
        category: 'Guss',
        annualSpend: { amountCents: 123_456_78, currency: 'EUR' },
        spendYear: 2025,
      },
    ]);
  });

  it('stimmt bei Anzahl und Gesamtspend mit der Datenbank überein', async () => {
    const body = await listFor(users.a);
    const expected = await db.execute<{ n: number; cent: string }>(sql`
      select count(*)::int as n, sum(bk.jahresspend_cent)::text as cent
      from beziehung b join beziehung_kaeufer bk on bk.beziehung_id = b.id
      where b.kaeufer_org_id = ${ids.oemA}
    `);
    expect(body.count).toBe(expected.rows[0]?.n);
    expect(body.totalSpend).toEqual([
      { amountCents: Number(expected.rows[0]?.cent), currency: 'EUR' },
    ]);
  });

  it('trennt die Daten: Jeder Käufer sieht beim selben Lieferanten nur seine Werte', async () => {
    const a = await listFor(users.a);
    const b = await listFor(users.b, 'leser');
    const sharedFor = (body: { suppliers: { name: string }[] }) =>
      body.suppliers.filter((supplier) => supplier.name === `Gemeinsam ${run}`);

    expect(sharedFor(a)).toMatchObject([
      { category: 'Guss', annualSpend: { amountCents: 123_456_78 } },
    ]);
    expect(sharedFor(b)).toMatchObject([
      { category: 'Schmiedeteile', annualSpend: { amountCents: 9_999_00 } },
    ]);
    expect(b.suppliers.map((supplier) => supplier.name)).toEqual([`Gemeinsam ${run}`]);
    expect(JSON.stringify(b)).not.toContain('Guss');
    expect(JSON.stringify(b)).not.toContain(`Nur A ${run}`);
  });

  it.each(['admin', 'nutzer', 'leser', 'controlling'])('erlaubt die Rolle %s', async (role) => {
    expect((await get(users.a, role)).status).toBe(200);
  });

  it('antwortet ohne Rolle mit 403 keine_berechtigung', async () => {
    const res = await get(users.a, null);
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: 'keine_berechtigung' });
  });

  it('antwortet ohne Organisation mit 403 keine_organisation', async () => {
    const res = await get(users.none);
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: 'keine_organisation' });
  });

  it('gibt Nutzern einer Lieferanten-Organisation keine Liste', async () => {
    const res = await get(users.supplier);
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: 'keine_berechtigung' });
  });
});

describe('GET /api/suppliers mit Spend aus verschiedenen Jahren', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const ids = {
    oem: randomUUID(),
    alt: randomUUID(),
    neu: randomUUID(),
    relAlt: randomUUID(),
    relNeu: randomUUID(),
  };
  const user = `test-jahre-${randomUUID().slice(0, 8)}`;

  beforeAll(async () => {
    testApp = await startTestApp();
    db = testApp.app.get(DATABASE);
    const { organization, beziehung, beziehungKaeufer, appUser } = schema;
    await db.insert(organization).values([
      { id: ids.oem, name: `Jahre-OEM ${user}`, typ: 'kaeufer' },
      { id: ids.alt, name: `Alt ${user}`, typ: 'lieferant' },
      { id: ids.neu, name: `Neu ${user}`, typ: 'lieferant' },
    ]);
    await db.insert(beziehung).values([
      { id: ids.relAlt, kaeuferOrgId: ids.oem, lieferantOrgId: ids.alt },
      { id: ids.relNeu, kaeuferOrgId: ids.oem, lieferantOrgId: ids.neu },
    ]);
    await db.insert(beziehungKaeufer).values([
      { beziehungId: ids.relAlt, warengruppe: 'Guss', jahresspendCent: 700_00, spendJahr: 2024 },
      { beziehungId: ids.relNeu, warengruppe: 'Guss', jahresspendCent: 300_00, spendJahr: 2025 },
    ]);
    await db
      .insert(appUser)
      .values({ id: user, name: 'J', email: 'j@example.com', organizationId: ids.oem });
  });

  afterAll(async () => {
    const { organization, beziehung, appUser } = schema;
    await db.delete(appUser).where(sql`${appUser.id} = ${user}`);
    await db.delete(beziehung).where(sql`${beziehung.kaeuferOrgId} = ${ids.oem}`);
    await db.delete(organization).where(sql`${organization.id} in ${[ids.oem, ids.alt, ids.neu]}`);
    await testApp.close();
  });

  it('zählt beim Gesamtspend nur das letzte Spend-Jahr und nennt es', async () => {
    const token = await testApp.signToken({
      subject: user,
      claims: { 'urn:zitadel:iam:org:project:test-project:roles': { nutzer: { '1': 'test' } } },
    });
    const body = suppliersResponseSchema.parse(
      await (await testApp.get('/api/suppliers', token)).json(),
    );
    expect(body.count).toBe(2);
    expect(body.spendYear).toBe(2025);
    expect(body.totalSpend).toEqual([{ amountCents: 300_00, currency: 'EUR' }]);
  });
});
