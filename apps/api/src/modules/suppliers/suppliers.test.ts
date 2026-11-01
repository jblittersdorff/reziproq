import { randomUUID } from 'node:crypto';
import { type Database, schema, sql } from '@reziproq/db';
import { lastFullYear, suppliersResponseSchema } from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';

const appUserTable = schema.appUser;

// Tests zu PLT-02 und PLT-03a über die API. Sie legen eigene Organisationen mit zufälligen IDs an,
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
    ended: randomUUID(),
    relEnded: randomUUID(),
    draft: randomUUID(),
    relDraft: randomUUID(),
  };
  const year = lastFullYear();
  const run = randomUUID().slice(0, 8);
  const users = {
    a: `test-a-${run}`,
    b: `test-b-${run}`,
    none: `test-ohne-${run}`,
    supplier: `test-lieferant-${run}`,
    // Damit OEM A immer einen Admin behält, wenn der Test die Rolle von Anna ändert (PLT-05).
    adminA: `test-admin-a-${run}`,
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
    db = testApp.adminDb;
    const { organization, appUser } = schema;

    await db.insert(organization).values([
      { id: ids.ended, name: `Beendet ${run}`, country: 'IT' },
      { id: ids.draft, name: `Entwurf ${run}`, country: 'AT' },
      { id: ids.oemA, name: `OEM A ${run}`, country: 'DE' },
      { id: ids.oemB, name: `OEM B ${run}`, country: 'DE' },
      { id: ids.shared, name: `Gemeinsam ${run}`, country: 'PL' },
      { id: ids.onlyA, name: `Nur A ${run}`, country: null },
      { id: ids.supplierOrg, name: `Lieferant-Nutzer ${run}`, country: 'CZ' },
    ]);
    // Käuferfunktionen über das Feature buyer (PLT-02).
    await db.insert(schema.organizationFeature).values([
      { organizationId: ids.oemA, feature: 'buyer' as const },
      { organizationId: ids.oemB, feature: 'buyer' as const },
    ]);
    await insertRelationships(db, [
      {
        id: ids.relAShared,
        buyer: ids.oemA,
        supplier: ids.shared,
        externalRef: 'A-1',
        notes: 'Nur für OEM A',
        spend: [
          { year: year - 1, amountCents: 99_00 },
          { year, amountCents: 123_456_78 },
        ],
      },
      {
        id: ids.relAOnly,
        buyer: ids.oemA,
        supplier: ids.onlyA,
        spend: [{ year, amountCents: 500_000_00 }],
      },
      { id: ids.relDraft, buyer: ids.oemA, supplier: ids.draft, status: 'draft' },
      {
        id: ids.relEnded,
        buyer: ids.oemA,
        supplier: ids.ended,
        status: 'ended',
        spend: [{ year, amountCents: 1_000_00 }],
      },
      {
        id: ids.relBShared,
        buyer: ids.oemB,
        supplier: ids.shared,
        externalRef: 'B-77',
        spend: [{ year, amountCents: 9_999_00 }],
      },
    ]);
    await db.insert(appUser).values([
      { id: users.a, name: 'Anna A', email: 'a@example.com', organizationId: ids.oemA },
      {
        id: users.adminA,
        name: 'Ada Admin',
        email: 'ada@example.com',
        organizationId: ids.oemA,
        orgRole: 'admin',
      },
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
    const { organization, appUser } = schema;
    const userIds = Object.values(users);
    const orgIds = [
      ids.oemA,
      ids.oemB,
      ids.shared,
      ids.onlyA,
      ids.supplierOrg,
      ids.ended,
      ids.draft,
    ];
    await db.delete(appUser).where(sql`${appUser.id} in ${userIds}`);
    await deleteRelationships(db, orgIds);
    await db.delete(organization).where(sql`${organization.id} in ${orgIds}`);
    await testApp.close();
  });

  it('antwortet ohne Login mit 401', async () => {
    expect((await testApp.get('/api/suppliers')).status).toBe(401);
  });

  it('liefert nur Lieferanten der eigenen Organisation, nach Spend absteigend, mit Status', async () => {
    expect((await get(users.a)).status).toBe(200);
    const body = await listFor(users.a);
    expect(body.spendYear).toBe(year);
    expect(body.suppliers).toEqual([
      {
        relationshipId: ids.relAOnly,
        name: `Nur A ${run}`,
        country: null,
        externalRef: null,
        status: 'active',
        spend: { amountCents: 500_000_00, currency: 'EUR' },
        // Ohne Zuordnung (PLT-06)
        primaryMaterialGroup: null,
        materialGroups: [],
      },
      {
        relationshipId: ids.relAShared,
        name: `Gemeinsam ${run}`,
        country: 'PL',
        externalRef: 'A-1',
        status: 'active',
        spend: { amountCents: 123_456_78, currency: 'EUR' },
        // Ohne Zuordnung (PLT-06)
        primaryMaterialGroup: null,
        materialGroups: [],
      },
      {
        relationshipId: ids.relEnded,
        name: `Beendet ${run}`,
        country: 'IT',
        externalRef: null,
        status: 'ended',
        spend: { amountCents: 1_000_00, currency: 'EUR' },
        // Ohne Zuordnung (PLT-06)
        primaryMaterialGroup: null,
        materialGroups: [],
      },
      {
        relationshipId: ids.relDraft,
        name: `Entwurf ${run}`,
        country: 'AT',
        externalRef: null,
        status: 'draft',
        spend: null,
        // Ohne Zuordnung (PLT-06)
        primaryMaterialGroup: null,
        materialGroups: [],
      },
    ]);
  });

  it('Anzahl und Gesamtspend stimmen mit der Datenbank überein', async () => {
    const body = await listFor(users.a);
    const expected = await db.execute<{ n: number; cent: string }>(sql`
      select count(*)::int as n,
        (select sum(sp.amount_cents) from relationship_spend sp
          join relationship r2 on r2.id = sp.relationship_id
          where r2.buyer_org_id = ${ids.oemA} and r2.status <> 'ended' and sp.year = ${year})::text as cent
      from relationship r
      where r.buyer_org_id = ${ids.oemA} and r.status <> 'ended'
    `);
    expect(body.count).toBe(expected.rows[0]?.n);
    expect(body.count).toBe(3);
    expect(body.totalSpend).toEqual([
      { amountCents: Number(expected.rows[0]?.cent), currency: 'EUR' },
    ]);
  });

  it('Der Zweit-OEM sieht beim gemeinsamen Lieferanten weder Spend noch eigene Nummer oder Notizen des Test-OEM', async () => {
    const a = await listFor(users.a);
    const b = await listFor(users.b, 'leser');
    const sharedFor = (body: { suppliers: { name: string }[] }) =>
      body.suppliers.filter((supplier) => supplier.name === `Gemeinsam ${run}`);

    expect(sharedFor(a)).toMatchObject([
      { externalRef: 'A-1', spend: { amountCents: 123_456_78 } },
    ]);
    expect(sharedFor(b)).toMatchObject([{ externalRef: 'B-77', spend: { amountCents: 9_999_00 } }]);
    expect(b.suppliers.map((supplier) => supplier.name)).toEqual([`Gemeinsam ${run}`]);
    for (const leak of ['A-1', 'Nur für OEM A', '12345678', `Nur A ${run}`, `Entwurf ${run}`]) {
      expect(JSON.stringify(b)).not.toContain(leak);
    }
  });

  // Seit PLT-05 zählt die Rolle in der Datenbank; jeder Nutzer hat genau eine.
  it.each(['admin', 'member', 'viewer'] as const)('erlaubt die Rolle %s', async (role) => {
    await db
      .update(appUserTable)
      .set({ orgRole: role })
      .where(sql`${appUserTable.id} = ${users.a}`);
    expect((await get(users.a, null)).status).toBe(200);
  });

  it('liest keine Rollen mehr aus dem Token', async () => {
    await db
      .update(appUserTable)
      .set({ orgRole: 'viewer' })
      .where(sql`${appUserTable.id} = ${users.a}`);
    const res = await testApp.get(
      '/api/suppliers/lookup?ust=DE123456789',
      await testApp.signToken({ subject: users.a, claims: roleClaim('admin') }),
    );
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
  const year = lastFullYear();

  beforeAll(async () => {
    testApp = await startTestApp();
    db = testApp.adminDb;
    const { organization, appUser } = schema;
    await db.insert(organization).values([
      { id: ids.oem, name: `Jahre-OEM ${user}` },
      { id: ids.alt, name: `Alt ${user}` },
      { id: ids.neu, name: `Neu ${user}` },
    ]);
    // Käuferfunktionen über das Feature buyer (PLT-02).
    await db
      .insert(schema.organizationFeature)
      .values([{ organizationId: ids.oem, feature: 'buyer' as const }]);
    await insertRelationships(db, [
      {
        id: ids.relAlt,
        buyer: ids.oem,
        supplier: ids.alt,
        spend: [{ year: year - 1, amountCents: 700_00 }],
      },
      {
        id: ids.relNeu,
        buyer: ids.oem,
        supplier: ids.neu,
        spend: [
          { year: year - 1, amountCents: 100_00 },
          { year, amountCents: 300_00 },
          { year: year + 1, amountCents: 5_000_00 },
        ],
      },
    ]);
    await db
      .insert(appUser)
      .values({ id: user, name: 'J', email: 'j@example.com', organizationId: ids.oem });
  });

  afterAll(async () => {
    const { organization, appUser } = schema;
    await db.delete(appUser).where(sql`${appUser.id} = ${user}`);
    await deleteRelationships(db, [ids.oem]);
    await db.delete(organization).where(sql`${organization.id} in ${[ids.oem, ids.alt, ids.neu]}`);
    await testApp.close();
  });

  it('zählt beim Gesamtspend nur das letzte volle Kalenderjahr und nennt es', async () => {
    const token = await testApp.signToken({
      subject: user,
      claims: { 'urn:zitadel:iam:org:project:test-project:roles': { nutzer: { '1': 'test' } } },
    });
    const body = suppliersResponseSchema.parse(
      await (await testApp.get('/api/suppliers', token)).json(),
    );
    expect(body.count).toBe(2);
    expect(body.spendYear).toBe(new Date().getFullYear() - 1);
    expect(body.totalSpend).toEqual([{ amountCents: 300_00, currency: 'EUR' }]);
    // Ohne Spend im letzten vollen Jahr: kein Betrag statt eines alten.
    expect(body.suppliers.find((s) => s.relationshipId === ids.relAlt)?.spend).toBeNull();
  });
});
