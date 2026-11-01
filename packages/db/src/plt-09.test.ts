import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTempDatabase, migrateTo } from './testing/temp-database.js';

// Tests zu docs/specs/PLT-09.md direkt in der Datenbank: Sprache je Person.

describe('PLT-09: Sprache in der Datenbank', () => {
  let temp: Awaited<ReturnType<typeof createTempDatabase>>;

  /** Wie die API: als reziproq_api über die Datenbankfunktionen. */
  const asApi = (statement: ReturnType<typeof sql>) =>
    temp.db
      .transaction(async (tx) => {
        await tx.execute(sql`set local role reziproq_api`);
        return tx.execute(statement);
      })
      .catch((caught: unknown) => caught as Error);
  const sync = (id: string, login: boolean, browserLocale: string | null) =>
    asApi(sql`select app_nutzer_synchronisieren(
      ${id}, 'Neu Nutzer', 'Neu', ${`${id}@example.com`}, null, ${login}, '{}'::text[], ${browserLocale}
    )`);
  const localeOf = async (id: string) =>
    (
      await temp.db.execute<{ locale: string | null }>(
        sql`select locale from app_user where id = ${id}`,
      )
    ).rows[0]?.locale;

  beforeAll(async () => {
    temp = await createTempDatabase();
    await migrateTo(temp.db);
  });

  afterAll(async () => {
    await temp.drop();
  });

  it('Beim ersten Login kommt die Sprache aus dem Browser; danach bleibt die gespeicherte', async () => {
    await sync('p09-neu', true, 'en');
    expect(await localeOf('p09-neu')).toBe('en');
    // Ein späterer Login auf einem deutschen Browser ändert die gespeicherte Sprache nicht.
    await sync('p09-neu', true, 'de');
    expect(await localeOf('p09-neu')).toBe('en');
  });

  it('Bestehende Personen ohne Sprache bekommen sie beim nächsten Login, nicht bei /me', async () => {
    await temp.db.execute(
      sql`insert into app_user (id, name, email) values ('p09-alt', 'Alt Nutzer', 'alt@example.com')`,
    );
    expect(await localeOf('p09-alt')).toBeNull();
    await sync('p09-alt', false, 'en');
    expect(await localeOf('p09-alt')).toBeNull();
    // Bis dahin liest die API Deutsch.
    const read = async (id: string) => {
      const result = await asApi(sql`select app_sprache_des_nutzers(${id}) as locale`);
      if (result instanceof Error) throw result;
      return result.rows[0]?.locale;
    };
    expect(await read('p09-alt')).toBe('de');
    await sync('p09-alt', true, 'en');
    expect(await localeOf('p09-alt')).toBe('en');
    expect(await read('p09-alt')).toBe('en');
  });

  it('app_sprache_setzen ändert nur die eigene Sprache und nur auf de oder en', async () => {
    await sync('p09-a', true, 'de');
    await sync('p09-b', true, 'de');
    await asApi(sql`select app_sprache_setzen('p09-a', 'en')`);
    expect(await localeOf('p09-a')).toBe('en');
    expect(await localeOf('p09-b')).toBe('de');

    const invalid = await asApi(sql`select app_sprache_setzen('p09-a', 'fr')`);
    expect(String((invalid as Error).cause)).toMatch(/app_user_locale/);
    expect(await localeOf('p09-a')).toBe('en');
  });

  it('Andere Rollen dürfen die Sprache nicht über die Funktion setzen', async () => {
    const denied = await temp.db
      .transaction(async (tx) => {
        await tx.execute(sql`set local role reziproq_app`);
        return tx.execute(sql`select app_sprache_setzen('p09-a', 'de')`);
      })
      .catch((caught: unknown) => caught as Error);
    expect(String((denied as Error).cause)).toMatch(/permission denied/);
  });
});
