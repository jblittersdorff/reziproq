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

    expect(await columns('organization')).toEqual(['id', 'name', 'created_at', 'typ', 'land']);
    expect(await columns('app_user')).toContain('organization_id');
    expect(await columns('beziehung')).toEqual([
      'id',
      'kaeufer_org_id',
      'lieferant_org_id',
      'created_at',
    ]);
    expect(await columns('beziehung_kaeufer')).toEqual([
      'beziehung_id',
      'warengruppe',
      'jahresspend_cent',
      'spend_jahr',
      'waehrung',
    ]);

    const rls = await temp.db.execute<{ relname: string }>(
      sql`select relname from pg_class where relrowsecurity and relname in ('organization', 'beziehung', 'beziehung_kaeufer') order by relname`,
    );
    expect(rls.rows.map((row) => row.relname)).toEqual([
      'beziehung',
      'beziehung_kaeufer',
      'organization',
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

    const org = await temp.db.execute<{ typ: string; land: string | null }>(
      sql`select typ, land from organization where name = 'Altbestand GmbH'`,
    );
    expect(org.rows).toEqual([{ typ: 'kaeufer', land: null }]);
    const user = await temp.db.execute<{ organization_id: string | null }>(
      sql`select organization_id from app_user where id = 'alt-1'`,
    );
    expect(user.rows).toEqual([{ organization_id: null }]);
  });

  it('verlangen Spend als ganze Cent, nicht negativ, mit ISO-Währung', async () => {
    temp = await createTempDatabase();
    await migrateTo(temp.db);
    const type = await temp.db.execute<{ data_type: string }>(
      sql`select data_type from information_schema.columns where table_name = 'beziehung_kaeufer' and column_name = 'jahresspend_cent'`,
    );
    expect(type.rows).toEqual([{ data_type: 'bigint' }]);
  });
});
