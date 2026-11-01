import { sql } from 'drizzle-orm';
import { afterEach, describe, expect, it } from 'vitest';
import { createTempDatabase, migrateTo } from './testing/temp-database.js';

// PLT-02: Die Migration legt Felder und Tabellen an und läuft auf leerer und bestehender Datenbank.
describe('Migrationen', () => {
  let temp: Awaited<ReturnType<typeof createTempDatabase>> | undefined;

  afterEach(async () => {
    await temp?.drop();
    temp = undefined;
  });

  const columns = async (table: string) => {
    if (!temp) throw new Error('keine Testdatenbank');
    const result = await temp.db.execute<{ column_name: string }>(
      sql`select column_name from information_schema.columns where table_name = ${table} order by ordinal_position`,
    );
    return result.rows.map((row) => row.column_name);
  };

  it('laufen auf einer leeren Datenbank durch', async () => {
    temp = await createTempDatabase();
    await migrateTo(temp.db);

    expect(await columns('organization')).toEqual([
      'id',
      'name',
      'created_at',
      'country',
      'vat_id',
      'duns',
      'zitadel_org_id',
    ]);
    expect(await columns('organization_feature')).toEqual([
      'organization_id',
      'feature',
      'enabled_at',
    ]);
    expect(await columns('app_user')).toContain('organization_id');
    expect(await columns('relationship')).toEqual([
      'id',
      'buyer_org_id',
      'supplier_org_id',
      'status',
      'created_at',
      'ended_at',
    ]);
    expect(await columns('relationship_side')).toEqual([
      'id',
      'relationship_id',
      'org_id',
      'display_name',
      'external_ref',
      'notes',
      'is_focus',
      'focus_reason',
    ]);
    expect(await columns('relationship_spend')).toEqual([
      'id',
      'relationship_id',
      'year',
      'amount_cents',
      'currency',
      'source',
    ]);
    expect(await columns('beziehung')).toEqual([]);
    expect(await columns('beziehung_kaeufer')).toEqual([]);

    const rls = await temp.db.execute<{ relname: string }>(
      sql`select relname from pg_class where relrowsecurity and relforcerowsecurity and relname like 'relationship%' and relkind = 'r' order by relname`,
    );
    expect(rls.rows.map((row) => row.relname)).toEqual([
      'relationship',
      'relationship_business_unit',
      'relationship_material_group',
      'relationship_member',
      'relationship_side',
      'relationship_spend',
    ]);
  });

  it('PLT-03a: überführen Beziehungen und Spend aus beziehung und beziehung_kaeufer, ohne etwas zu verlieren', async () => {
    temp = await createTempDatabase();
    // Stand nach PLT-04 (0008), vor dem neuen Modell.
    await migrateTo(temp.db, 9);
    const [buyer, supplierA, supplierB] = ['Käufer (Demo)', 'Aktiv (Demo)', 'Beendet (Demo)'];
    await temp.db.execute(sql`
      insert into organization (id, name) values
        ('00000000-0000-7000-8000-000000000001', ${buyer}),
        ('00000000-0000-7000-8000-000000000002', ${supplierA}),
        ('00000000-0000-7000-8000-000000000003', ${supplierB})
    `);
    await temp.db.execute(sql`
      insert into beziehung (id, kaeufer_org_id, lieferant_org_id, ended_at) values
        ('00000000-0000-7000-8000-0000000000a1', '00000000-0000-7000-8000-000000000001', '00000000-0000-7000-8000-000000000002', null),
        ('00000000-0000-7000-8000-0000000000a2', '00000000-0000-7000-8000-000000000001', '00000000-0000-7000-8000-000000000003', now())
    `);
    await temp.db.execute(sql`
      insert into beziehung_kaeufer (beziehung_id, warengruppe, jahresspend_cent, spend_jahr, waehrung) values
        ('00000000-0000-7000-8000-0000000000a1', 'Guss', 482000000, 2025, 'EUR'),
        ('00000000-0000-7000-8000-0000000000a2', 'Logistik', 12345, 2024, 'USD')
    `);

    await migrateTo(temp.db);

    const relationships = await temp.db.execute(sql`
      select id::text, buyer_org_id::text, supplier_org_id::text, status, ended_at is not null as ended
      from relationship order by id
    `);
    expect(relationships.rows).toEqual([
      {
        id: '00000000-0000-7000-8000-0000000000a1',
        buyer_org_id: '00000000-0000-7000-8000-000000000001',
        supplier_org_id: '00000000-0000-7000-8000-000000000002',
        status: 'active',
        ended: false,
      },
      {
        id: '00000000-0000-7000-8000-0000000000a2',
        buyer_org_id: '00000000-0000-7000-8000-000000000001',
        supplier_org_id: '00000000-0000-7000-8000-000000000003',
        status: 'ended',
        ended: true,
      },
    ]);
    const spend = await temp.db.execute(sql`
      select relationship_id::text, year, amount_cents::text, currency, source
      from relationship_spend order by relationship_id
    `);
    expect(spend.rows).toEqual([
      {
        relationship_id: '00000000-0000-7000-8000-0000000000a1',
        year: 2025,
        amount_cents: '482000000',
        currency: 'EUR',
        source: 'import',
      },
      {
        relationship_id: '00000000-0000-7000-8000-0000000000a2',
        year: 2024,
        amount_cents: '12345',
        currency: 'USD',
        source: 'import',
      },
    ]);
  });

  it('laufen auf einer bestehenden Datenbank mit Organisationen und Nutzern durch', async () => {
    temp = await createTempDatabase();
    // Stand vor PLT-02: organization, app_user und given_name.
    await migrateTo(temp.db, 3);
    await temp.db.execute(sql`insert into organization (name) values ('Altbestand GmbH')`);
    await temp.db.execute(
      sql`insert into app_user (id, name, email) values ('alt-1', 'Alt Nutzer', 'alt@example.com')`,
    );

    await migrateTo(temp.db);

    // Bisherige Käufer behalten über das Feature buyer ihre Käuferfunktionen (PLT-02).
    const org = await temp.db.execute<{ country: string | null; features: string[] }>(sql`
      select o.country, array(select f.feature from organization_feature f where f.organization_id = o.id) as features
      from organization o where o.name = 'Altbestand GmbH'
    `);
    expect(org.rows).toEqual([{ country: null, features: ['buyer'] }]);
    const user = await temp.db.execute<{ organization_id: string | null }>(
      sql`select organization_id from app_user where id = 'alt-1'`,
    );
    expect(user.rows).toEqual([{ organization_id: null }]);
  });

  it('legen das Protokoll des Betreiber-Zugangs an, für reziproq_app nicht lesbar', async () => {
    temp = await createTempDatabase();
    await migrateTo(temp.db);
    expect(await columns('support_access_log')).toEqual([
      'id',
      'user_id',
      'organization_id',
      'action',
      'occurred_at',
    ]);
    const db = temp.db;
    const error = await db
      .transaction(async (tx) => {
        await tx.execute(sql`set local role reziproq_app`);
        return tx.execute(sql`select * from support_access_log`);
      })
      .catch((caught: unknown) => caught);
    expect(String((error as Error).cause)).toMatch(/permission denied/);
  });

  it('UMB-01: Die Umbenennung verliert keine Einträge', async () => {
    temp = await createTempDatabase();
    // Stand vor UMB-01 (0000 bis 0014) mit Einträgen im alten Protokoll.
    await migrateTo(temp.db, 15);
    await temp.db.execute(sql`
      insert into organization (id, name) values ('00000000-0000-7000-8000-000000000001', 'K (Demo)')
    `);
    await temp.db.execute(sql`
      insert into betreiber_zugriff (nutzer_id, organization_id, aktion, zeitpunkt) values
        ('betreiber-1', null, 'GET /api/betreiber/kunden', '2026-10-01T08:00:00Z'),
        ('betreiber-1', '00000000-0000-7000-8000-000000000001', 'GET /api/suppliers', '2026-10-01T08:01:00Z')
    `);
    await migrateTo(temp.db);
    const rows = await temp.db.execute(sql`
      select user_id, organization_id::text, action, occurred_at::text from support_access_log order by occurred_at
    `);
    expect(rows.rows).toEqual([
      {
        user_id: 'betreiber-1',
        organization_id: null,
        action: 'GET /api/betreiber/kunden',
        occurred_at: '2026-10-01 08:00:00+00',
      },
      {
        user_id: 'betreiber-1',
        organization_id: '00000000-0000-7000-8000-000000000001',
        action: 'GET /api/suppliers',
        occurred_at: '2026-10-01 08:01:00+00',
      },
    ]);
    expect(await columns('betreiber_zugriff')).toEqual([]);
    // Das Protokoll schreibt weiter, jetzt in die neue Tabelle.
    await temp.db.execute(
      sql`select app_betreiber_protokoll('betreiber-2', null, 'GET /api/betreiber/kunden')`,
    );
    const count = await temp.db.execute<{ n: number }>(
      sql`select count(*)::int as n from support_access_log`,
    );
    expect(count.rows[0]?.n).toBe(3);
  });

  it('Spend liegt in Cent in der Datenbank: ganze Zahl, nicht negativ, mit ISO-Währung', async () => {
    temp = await createTempDatabase();
    await migrateTo(temp.db);
    const type = await temp.db.execute<{ data_type: string }>(
      sql`select data_type from information_schema.columns where table_name = 'relationship_spend' and column_name = 'amount_cents'`,
    );
    expect(type.rows).toEqual([{ data_type: 'bigint' }]);

    await temp.db.execute(sql`
      insert into organization (id, name) values
        ('00000000-0000-7000-8000-000000000001', 'K (Demo)'),
        ('00000000-0000-7000-8000-000000000002', 'L (Demo)');
      insert into relationship (id, buyer_org_id, supplier_org_id) values
        ('00000000-0000-7000-8000-0000000000a1', '00000000-0000-7000-8000-000000000001', '00000000-0000-7000-8000-000000000002')
    `);
    const insertSpend = (cents: string, currency: string) =>
      temp?.db
        .execute(
          sql.raw(
            `insert into relationship_spend (relationship_id, year, amount_cents, currency) values ('00000000-0000-7000-8000-0000000000a1', 2025, ${cents}, '${currency}')`,
          ),
        )
        .then(() => 'ok')
        .catch(() => 'abgelehnt');
    expect(await insertSpend('-1', 'EUR')).toBe('abgelehnt');
    expect(await insertSpend('100', 'euro')).toBe('abgelehnt');
    expect(await insertSpend('48200000000', 'EUR')).toBe('ok');
  });
});
