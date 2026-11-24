import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { makeAdmin } from './org-link.js';
import { seedBuyers } from './seed.js';
import { withTenant } from './tenant.js';
import { createTempDatabase } from './testing/temp-database.js';

// Tests zu docs/specs/PLT-05.md, Teil a, direkt in der Datenbank: Rollen, Übernahme aus Zitadel,
// Rollen ändern nur als Admin, und der letzte Admin bleibt.

const testOem = seedBuyers.testOem.id;

describe('PLT-05a: Rollen in der Datenbank', () => {
  let temp: Awaited<ReturnType<typeof createTempDatabase>>;

  /** Wie die API beim Login: als reziproq_api über die Anmelde-Funktion. */
  const sync = (id: string, roles: string[], zitadelOrgId: string | null = 'zitadel-test-oem') =>
    temp.db.transaction(async (tx) => {
      await tx.execute(sql`set local role reziproq_api`);
      await tx.execute(sql`select app_nutzer_synchronisieren(
        ${id}, 'Neu Nutzer', 'Neu', ${`${id}@example.com`}, ${zitadelOrgId}, true,
        ${`{${roles.join(',')}}`}::text[], 'de'
      )`);
    });

  const roleOf = async (id: string) =>
    (
      await temp.db.execute<{ org_role: string; is_controlling: boolean }>(
        sql`select org_role, is_controlling from app_user where id = ${id}`,
      )
    ).rows[0];

  /** Ändert Rollen in der Mandanten-Session einer Person, wie die API. */
  const asUser = (userId: string, statement: ReturnType<typeof sql>) =>
    withTenant(temp.db, { userId, organizationId: testOem }, async (tx) =>
      Number((await tx.execute(statement)).rowCount),
    ).catch((caught: unknown) => caught as Error);

  beforeAll(async () => {
    temp = await createTempDatabase({ from: 'seeded' });
    await temp.db.execute(
      sql`update organization set zitadel_org_id = 'zitadel-test-oem' where id = ${testOem}`,
    );
  });

  afterAll(async () => {
    await temp.drop();
  });

  it('Neue Nutzer sind viewer', async () => {
    await sync('neu-1', []);
    expect(await roleOf('neu-1')).toEqual({ org_role: 'viewer', is_controlling: false });
    const defaults = await temp.db.execute<{ column_default: string }>(sql`
      select column_default from information_schema.columns
      where table_name = 'app_user' and column_name = 'org_role'
    `);
    expect(defaults.rows[0]?.column_default).toMatch(/viewer/);
  });

  it('übernimmt die Rollen aus Zitadel einmalig beim Login, danach zählt nur die Datenbank', async () => {
    await sync('alt-admin', ['admin', 'controlling']);
    expect(await roleOf('alt-admin')).toEqual({ org_role: 'admin', is_controlling: true });
    await sync('alt-nutzer', ['nutzer']);
    expect(await roleOf('alt-nutzer')).toEqual({ org_role: 'member', is_controlling: false });
    await sync('alt-leser', ['leser']);
    expect(await roleOf('alt-leser')).toEqual({ org_role: 'viewer', is_controlling: false });

    // Spätere Logins mit anderen Token-Rollen ändern nichts mehr.
    await sync('alt-leser', ['admin']);
    expect(await roleOf('alt-leser')).toEqual({ org_role: 'viewer', is_controlling: false });

    // Vor PLT-05a angemeldete Nutzer (ohne Übernahme) bekommen ihre Rollen beim nächsten Login.
    await temp.db.execute(sql`
      insert into app_user (id, name, email, organization_id) values ('vorher', 'V', 'v@example.com', ${testOem})
    `);
    expect((await roleOf('vorher'))?.org_role).toBe('viewer');
    await sync('vorher', ['nutzer', 'controlling']);
    expect(await roleOf('vorher')).toEqual({ org_role: 'member', is_controlling: true });
  });

  it('Rollen ändert nur ein Admin der eigenen Organisation, und nur Rolle, Controlling und Funktion', async () => {
    // Nutzer (Tom) ändert nichts, der Admin (Lena) schon.
    expect(
      await asUser(
        'demo-test-oem-2',
        sql`update app_user set org_role = 'admin' where id = 'demo-test-oem-3'`,
      ),
    ).toBe(0);
    expect(
      await asUser(
        'demo-test-oem-1',
        sql`update app_user set org_role = 'member', default_function = 'quality' where id = 'demo-test-oem-3'`,
      ),
    ).toBe(1);
    // Mitglieder anderer Organisationen trifft ein Update nicht.
    expect(
      await asUser(
        'demo-test-oem-1',
        sql`update app_user set org_role = 'viewer' where id = 'demo-zweit-oem-2'`,
      ),
    ).toBe(0);
    // Name und E-Mail kommen aus Zitadel, nie aus der App.
    const error = await asUser(
      'demo-test-oem-1',
      sql`update app_user set name = 'Anders' where id = 'demo-test-oem-3'`,
    );
    expect(String((error as Error).cause)).toMatch(/permission denied/);
    await temp.db.execute(
      sql`update app_user set org_role = 'viewer', default_function = null where id = 'demo-test-oem-3'`,
    );
  });

  it('Der letzte Admin einer Organisation kann sich nicht selbst herabstufen', async () => {
    // Lena ist die einzige Admin des Test-OEM.
    await temp.db.execute(sql`
      update app_user set org_role = 'viewer'
      where organization_id = ${testOem} and org_role = 'admin' and id <> 'demo-test-oem-1'
    `);
    const error = await asUser(
      'demo-test-oem-1',
      sql`update app_user set org_role = 'member' where id = 'demo-test-oem-1'`,
    );
    expect(String((error as Error).cause)).toMatch(/mindestens einen Admin/);
    expect((await roleOf('demo-test-oem-1'))?.org_role).toBe('admin');

    // Mit einem zweiten Admin geht es.
    await temp.db.execute(sql`update app_user set org_role = 'admin' where id = 'demo-test-oem-2'`);
    expect(
      await asUser(
        'demo-test-oem-1',
        sql`update app_user set org_role = 'member' where id = 'demo-test-oem-1'`,
      ),
    ).toBe(1);
    await temp.db.execute(sql`update app_user set org_role = 'admin' where id = 'demo-test-oem-1'`);
    await temp.db.execute(
      sql`update app_user set org_role = 'member' where id = 'demo-test-oem-2'`,
    );
  });

  it('pnpm org:link --admin macht eine Person zum Admin ihrer Organisation', async () => {
    await sync('erster-admin', []);
    const user = await makeAdmin(temp.db, 'ERSTER-ADMIN@example.com');
    expect(user.name).toBe('Neu Nutzer');
    expect((await roleOf('erster-admin'))?.org_role).toBe('admin');
    // Der nächste Login übernimmt keine Token-Rollen mehr darüber.
    await sync('erster-admin', ['leser']);
    expect((await roleOf('erster-admin'))?.org_role).toBe('admin');
    await expect(makeAdmin(temp.db, 'niemand@example.com')).rejects.toThrow(/Keine Person/);
  });

  it('meldet vor der Session Organisation, Rolle und Controlling', async () => {
    const rows = await temp.db.transaction(async (tx) => {
      await tx.execute(sql`set local role reziproq_api`);
      return (
        await tx.execute(
          sql`select name, buyer, org_role, is_controlling from app_organisation_des_nutzers('demo-test-oem-2')`,
        )
      ).rows;
    });
    expect(rows).toEqual([
      { name: 'Test-OEM (Demo)', buyer: true, org_role: 'member', is_controlling: true },
    ]);
  });
});
