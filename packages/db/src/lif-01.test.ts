import { createHash } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedBuyers } from './seed.js';
import { createTempDatabase } from './testing/temp-database.js';

// Tests zu docs/specs/LIF-01.md (Teil a) direkt in der Datenbank: Lesen und Annehmen einer
// Einladung ohne Login über app_einladung_lesen und app_einladung_annehmen.
describe('LIF-01a in der Datenbank', () => {
  let temp: Awaited<ReturnType<typeof createTempDatabase>>;
  const supplierId = '01960000-0000-7000-8000-00000000a001';
  const relOem = '01960000-0000-7000-8000-00000000a101';
  const relZweit = '01960000-0000-7000-8000-00000000a102';
  const hash = (token: string) => createHash('sha256').update(token).digest('hex');

  /** Legt eine Einladung an, wie es die API in der Mandanten-Session tut, hier direkt als Eigentümer. */
  async function invite(
    token: string,
    relationshipId: string,
    orgId: string,
    options: { expiresAt?: string; revoked?: boolean } = {},
  ) {
    await temp.db.execute(sql`
      insert into invitation (relationship_id, org_id, email, token_hash, invited_by, expires_at, revoked_at)
      values (${relationshipId}, ${orgId}, 'kam@lieferant.example', ${hash(token)},
        ${orgId === seedBuyers.testOem.id ? 'demo-test-oem-1' : 'demo-zweit-oem-1'},
        ${options.expiresAt ?? '2099-01-01T00:00:00Z'}::timestamptz,
        ${options.revoked ? sql`now()` : null})
    `);
  }

  /** Führt SQL als reziproq_api aus, so wie die API es tut. */
  const asApi = async <T extends Record<string, unknown>>(query: ReturnType<typeof sql>) =>
    temp.db.transaction(async (tx) => {
      await tx.execute(sql`set local role reziproq_api`);
      return (await tx.execute<T>(query)).rows;
    });

  const read = (token: string) =>
    asApi<{ status: string; customer: string; sro: string | null; kam_taken: boolean }>(
      sql`select * from app_einladung_lesen(${hash(token)})`,
    );

  const accept = (token: string, userId: string, teamRole = 'sro', zitadelOrgId = 'zitadel-neu') =>
    asApi<{ org_role: string; relationship_id: string }>(sql`
      select * from app_einladung_annehmen(${hash(token)}, ${userId}, 'Kim Kaiser', 'Kim',
        'kim@lieferant.example', ${zitadelOrgId}, ${teamRole}, 'de')
    `);

  const failure = async (promise: Promise<unknown>) => {
    try {
      await promise;
    } catch (error) {
      const cause = (error as { cause?: { message?: string } }).cause;
      return cause?.message;
    }
    return 'kein Fehler';
  };

  beforeAll(async () => {
    temp = await createTempDatabase({ from: 'seeded' });
    await temp.db.execute(sql`
      insert into organization (id, name, country) values (${supplierId}, 'Neuer Lieferant', 'DE')
    `);
    await temp.db.execute(sql`
      insert into relationship (id, buyer_org_id, supplier_org_id, status) values
        (${relOem}, ${seedBuyers.testOem.id}, ${supplierId}, 'draft'),
        (${relZweit}, ${seedBuyers.zweitOem.id}, ${supplierId}, 'draft')
    `);
    await temp.db.execute(sql`
      insert into relationship_member (relationship_id, org_id, user_id, team_role)
      values (${relOem}, ${seedBuyers.testOem.id}, 'demo-test-oem-1', 'sro')
    `);
    await invite('offen-oem', relOem, seedBuyers.testOem.id);
    await invite('offen-zweit', relZweit, seedBuyers.zweitOem.id);
    await invite('abgelaufen', relOem, seedBuyers.testOem.id, {
      expiresAt: '2020-01-01T00:00:00Z',
    });
    await invite('zurueckgezogen', relOem, seedBuyers.testOem.id, { revoked: true });
  });

  afterAll(async () => {
    await temp.drop();
  });

  it('die Vorschau nennt Kunde und SRO, aber keine fremden Daten', async () => {
    const [row] = await read('offen-oem');
    expect(row).toMatchObject({
      status: 'open',
      customer: seedBuyers.testOem.name,
      sro: 'Lena Berger',
      supplier: 'Neuer Lieferant',
      kam_taken: false,
    });
    expect(await read('gibt-es-nicht')).toEqual([]);
  });

  it('ein abgelaufener oder zurückgezogener Link ist nicht annehmbar', async () => {
    expect((await read('abgelaufen'))[0]?.status).toBe('expired');
    expect((await read('zurueckgezogen'))[0]?.status).toBe('revoked');
    expect(await failure(accept('abgelaufen', 'zitadel-user-x'))).toBe('invitation_unavailable');
    expect(await failure(accept('zurueckgezogen', 'zitadel-user-x'))).toBe(
      'invitation_unavailable',
    );
    expect(await failure(accept('gibt-es-nicht', 'zitadel-user-x'))).toBe('invitation_not_found');
  });

  it('nur Teamrollen der Lieferantenseite sind erlaubt', async () => {
    expect(await failure(accept('offen-oem', 'zitadel-kim', 'viewer'))).toBe(
      'invitation_team_role',
    );
  });

  it('die erste Annahme verknüpft die Zitadel-Organisation, macht die Person zum Admin und aktiviert die Beziehung', async () => {
    const [result] = await accept('offen-oem', 'zitadel-kim');
    expect(result).toEqual({ org_role: 'admin', relationship_id: relOem });
    const org = await temp.db.execute(
      sql`select zitadel_org_id from organization where id = ${supplierId}`,
    );
    expect(org.rows[0]).toEqual({ zitadel_org_id: 'zitadel-neu' });
    const user = await temp.db.execute(
      sql`select organization_id, org_role, roles_imported_at is not null as fixed from app_user where id = 'zitadel-kim'`,
    );
    expect(user.rows[0]).toEqual({ organization_id: supplierId, org_role: 'admin', fixed: true });
    const team = await temp.db.execute(
      sql`select org_id, team_role from relationship_member where user_id = 'zitadel-kim'`,
    );
    expect(team.rows).toEqual([{ org_id: supplierId, team_role: 'sro' }]);
    const rel = await temp.db.execute(sql`select status from relationship where id = ${relOem}`);
    expect(rel.rows[0]).toEqual({ status: 'active' });
    const audit = await temp.db.execute(sql`
      select owner_org_id, visibility, changes from audit_event
      where relationship_id = ${relOem} and object_type = 'relationship'
    `);
    expect(audit.rows).toEqual([
      {
        owner_org_id: supplierId,
        visibility: 'shared',
        changes: { status: { from: 'draft', to: 'active' } },
      },
    ]);
  });

  it('der erste Login danach behält Organisation und Admin-Rolle', async () => {
    await asApi(sql`
      select app_nutzer_synchronisieren('zitadel-kim', 'Kim Kaiser', 'Kim', 'kim@lieferant.example',
        'zitadel-neu', true, '{}'::text[], 'de')
    `);
    const user = await temp.db.execute(
      sql`select organization_id, org_role from app_user where id = 'zitadel-kim'`,
    );
    expect(user.rows[0]).toEqual({ organization_id: supplierId, org_role: 'admin' });
  });

  it('ein schon benutzter Link ist verbraucht', async () => {
    expect((await read('offen-oem'))[0]?.status).toBe('used');
    expect(await failure(accept('offen-oem', 'zitadel-andere'))).toBe('invitation_unavailable');
  });

  it('ein Lieferant mit zwei Kunden hat danach eine Organisation und zwei aktive Beziehungen', async () => {
    expect(await failure(accept('offen-zweit', 'zitadel-kim', 'sro', 'zitadel-fremd'))).toBe(
      'invitation_zitadel_mismatch',
    );
    const [result] = await accept('offen-zweit', 'zitadel-kim');
    expect(result).toEqual({ org_role: 'admin', relationship_id: relZweit });
    const orgs = await temp.db.execute(
      sql`select count(*)::int as n from organization where zitadel_org_id = 'zitadel-neu'`,
    );
    expect(orgs.rows[0]).toEqual({ n: 1 });
    const rels = await temp.db.execute(sql`
      select status from relationship where supplier_org_id = ${supplierId} order by id
    `);
    expect(rels.rows).toEqual([{ status: 'active' }, { status: 'active' }]);
  });

  it('weitere Personen werden Mitglied, und der Key Account Manager ist nur einmal vergeben', async () => {
    await invite('zweite-person', relOem, seedBuyers.testOem.id);
    expect((await read('zweite-person'))[0]?.kam_taken).toBe(true);
    expect(await failure(accept('zweite-person', 'zitadel-ole'))).toBe('invitation_kam_taken');
    const [result] = await accept('zweite-person', 'zitadel-ole', 'member');
    expect(result?.org_role).toBe('member');
  });

  it('eine Person einer anderen Organisation lässt sich nicht übernehmen', async () => {
    await invite('fremde-person', relOem, seedBuyers.testOem.id);
    expect(await failure(accept('fremde-person', 'demo-test-oem-2', 'member'))).toBe(
      'invitation_user_other_org',
    );
  });

  it('nach dem Beenden der Beziehung gilt die Einladung als zurückgezogen', async () => {
    const ended = '01960000-0000-7000-8000-00000000a103';
    const otherSupplier = '01960000-0000-7000-8000-00000000a002';
    await temp.db.execute(sql`
      insert into organization (id, name) values (${otherSupplier}, 'Beendeter Lieferant')
    `);
    await temp.db.execute(sql`
      insert into relationship (id, buyer_org_id, supplier_org_id, status, ended_at)
      values (${ended}, ${seedBuyers.testOem.id}, ${otherSupplier}, 'ended', now())
    `);
    await invite('beendet', ended, seedBuyers.testOem.id);
    expect((await read('beendet'))[0]?.status).toBe('revoked');
    expect(await failure(accept('beendet', 'zitadel-pia', 'member', 'zitadel-pia-org'))).toBe(
      'invitation_unavailable',
    );
  });

  it('die API selbst liest Einladungen nur in ihrer Mandanten-Session', async () => {
    expect(await asApi(sql`select * from invitation`)).toEqual([]);
  });
});
