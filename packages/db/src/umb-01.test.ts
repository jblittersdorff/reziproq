import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setOperator } from './org-link.js';
import { withTenant } from './tenant.js';
import { createTempDatabase } from './testing/temp-database.js';

// Tests zu docs/specs/UMB-01.md direkt in der Datenbank: Betreiber-Flag und Protokoll.

describe('UMB-01: Betreiber in der Datenbank', () => {
  let temp: Awaited<ReturnType<typeof createTempDatabase>>;

  const isOperator = (id: string) =>
    temp.db.transaction(async (tx) => {
      await tx.execute(sql`set local role reziproq_api`);
      const result = await tx.execute<{ yes: boolean }>(
        sql`select app_ist_betreiber(${id}) as yes`,
      );
      return result.rows[0]?.yes;
    });

  beforeAll(async () => {
    temp = await createTempDatabase({ from: 'seeded' });
    await temp.db.execute(sql`
      insert into app_user (id, name, email) values ('olaf', 'Olaf Betrieb', 'olaf@reziproq.test')
    `);
  });

  afterAll(async () => {
    await temp.drop();
  });

  it('pnpm operator:set setzt und entfernt das Flag', async () => {
    expect(await isOperator('olaf')).toBe(false);
    expect((await setOperator(temp.db, 'OLAF@reziproq.test', true)).name).toBe('Olaf Betrieb');
    expect(await isOperator('olaf')).toBe(true);
    await setOperator(temp.db, 'olaf@reziproq.test', false);
    expect(await isOperator('olaf')).toBe(false);
    expect(await isOperator('gibt-es-nicht')).toBe(false);
    await expect(setOperator(temp.db, 'niemand@example.com', true)).rejects.toThrow(/Keine Person/);
  });

  it('Neue Nutzer sind keine Betreiber, und die API kann das Flag nicht setzen', async () => {
    const defaults = await temp.db.execute<{ is_operator: boolean }>(
      sql`select is_operator from app_user where id = 'demo-test-oem-1'`,
    );
    expect(defaults.rows).toEqual([{ is_operator: false }]);
    // Selbst ein Admin in seiner Mandanten-Session darf is_operator nicht ändern.
    const error = await withTenant(
      temp.db,
      { userId: 'demo-test-oem-1', organizationId: '00000000-0000-0000-0000-000000000000' },
      (tx) => tx.execute(sql`update app_user set is_operator = true where id = 'demo-test-oem-1'`),
    ).catch((caught: unknown) => caught);
    expect(String((error as Error).cause)).toMatch(/permission denied/);
  });

  it('Jeder Zugriff steht in support_access_log; die API-Rolle kann das Protokoll nicht lesen', async () => {
    await temp.db.transaction(async (tx) => {
      await tx.execute(sql`set local role reziproq_api`);
      await tx.execute(
        sql`select app_betreiber_protokoll('olaf', null, 'GET /api/betreiber/kunden')`,
      );
    });
    const logged = await temp.db.execute(
      sql`select user_id, action from support_access_log where user_id = 'olaf'`,
    );
    expect(logged.rows).toEqual([{ user_id: 'olaf', action: 'GET /api/betreiber/kunden' }]);
    const error = await temp.db
      .transaction(async (tx) => {
        await tx.execute(sql`set local role reziproq_api`);
        return tx.execute(sql`select * from support_access_log`);
      })
      .catch((caught: unknown) => caught);
    expect(String((error as Error).cause)).toMatch(/permission denied/);
  });
});
