import { randomUUID } from 'node:crypto';
import { type Database, schema, sql, withTenant } from '@reziproq/db';
import { auditResponseSchema, defaultSroDescription, teamResponseSchema } from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';

// Tests zu docs/specs/PLB-04.md: interne Mitglieder sieht die andere Seite nie; jede Seite ändert
// nur ihr Team (sonst 403); Grenzen je Seite; bestehende Teams ohne Verlust überführt; der
// Verlauf nennt die Sichtbarkeit; die Rollenbeschreibung ist je Kunde änderbar und steht im Team.
describe('PLB-04 Team beider Seiten', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const run = randomUUID().slice(0, 8);
  const orgs = { oem: randomUUID(), supplier: randomUUID() };
  const rel = randomUUID();
  const users = {
    admin: `plb04-admin-${run}`,
    sro: `plb04-sro-${run}`,
    buyerMember: `plb04-bm-${run}`,
    kam: `plb04-kam-${run}`,
    supplierMember: `plb04-sm-${run}`,
    supplierOther: `plb04-so-${run}`,
  };
  const buyerTeam = `/suppliers/${rel}/team`;
  const supplierTeam = `/kunden/${rel}/team`;

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

  beforeAll(async () => {
    testApp = await startTestApp();
    db = testApp.adminDb;
    await db.insert(schema.organization).values([
      { id: orgs.oem, name: `PLB4-OEM ${run}` },
      { id: orgs.supplier, name: `PLB4-Lieferant ${run}` },
    ]);
    await db
      .insert(schema.organizationFeature)
      .values({ organizationId: orgs.oem, feature: 'buyer' });
    const user = (
      id: string,
      name: string,
      organizationId: string,
      orgRole: 'admin' | 'member',
    ) => ({
      id,
      name,
      email: `${id}@example.com`,
      organizationId,
      orgRole,
      rolesImportedAt: new Date(),
    });
    await db
      .insert(schema.appUser)
      .values([
        user(users.admin, 'Ada Admin', orgs.oem, 'admin'),
        user(users.sro, 'Sara Ost', orgs.oem, 'member'),
        user(users.buyerMember, 'Tom Berg', orgs.oem, 'member'),
        user(users.kam, 'Kim Kaiser', orgs.supplier, 'member'),
        user(users.supplierMember, 'Lea Lang', orgs.supplier, 'member'),
        user(users.supplierOther, 'Ole Brandt', orgs.supplier, 'admin'),
      ]);
    await insertRelationships(db, [{ id: rel, buyer: orgs.oem, supplier: orgs.supplier }]);
    // Wie aus PLT-05 und der Annahme einer Einladung: nur org_id, ohne Seite, Name und Sichtbarkeit.
    await db.insert(schema.relationshipMember).values([
      { relationshipId: rel, orgId: orgs.oem, userId: users.sro, teamRole: 'sro' },
      { relationshipId: rel, orgId: orgs.supplier, userId: users.kam, teamRole: 'sro' },
    ]);
  });

  afterAll(async () => {
    await db.execute(sql`delete from role_description where org_id = ${orgs.oem}`);
    await deleteRelationships(db, Object.values(orgs));
    await db.execute(sql`delete from app_user where organization_id in ${Object.values(orgs)}`);
    await db.execute(sql`delete from organization_feature where organization_id = ${orgs.oem}`);
    await db.execute(sql`delete from organization where id in ${Object.values(orgs)}`);
    await testApp.close();
  });

  it('bestehende Zeilen bekommen Seite und Namen; nichts geht verloren', async () => {
    const rows = await db.execute<{ owner: string; org: string; name: string | null }>(sql`
      select owner_org_id as owner, org_id as org, member_name as name from relationship_member
      where relationship_id = ${rel} order by member_name
    `);
    expect(rows.rows).toEqual([
      { owner: orgs.supplier, org: orgs.supplier, name: 'Kim Kaiser' },
      { owner: orgs.oem, org: orgs.oem, name: 'Sara Ost' },
    ]);
    const missing = await db.execute<{ n: number }>(sql`
      select count(*)::int as n from relationship_member
      where owner_org_id is null or owner_org_id <> org_id or member_name is null
    `);
    expect(missing.rows[0]?.n).toBe(0);
  });

  it('interne Mitglieder einer Seite sieht die andere Seite nie', async () => {
    expect(
      (
        await call(users.sro, 'PUT', buyerTeam, {
          members: [
            { userId: users.sro, teamRole: 'sro', function: 'purchasing' },
            { userId: users.buyerMember, teamRole: 'member', function: 'quality' },
          ],
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await call(users.kam, 'PUT', supplierTeam, {
          members: [
            { userId: users.kam, teamRole: 'sro', function: null },
            { userId: users.supplierMember, teamRole: 'member', function: null },
            {
              userId: users.supplierOther,
              teamRole: 'sponsor',
              function: null,
              visibility: 'internal',
            },
          ],
        })
      ).status,
    ).toBe(200);
    const buyer = teamResponseSchema.parse((await call(users.sro, 'GET', buyerTeam)).body);
    expect(buyer.members.map((member) => [member.name, member.visibility])).toEqual([
      ['Sara Ost', 'shared'],
      ['Tom Berg', 'internal'],
    ]);
    expect(buyer.counterpart).toEqual([{ name: 'Kim Kaiser', teamRole: 'sro', function: null }]);
    const supplier = teamResponseSchema.parse((await call(users.kam, 'GET', supplierTeam)).body);
    expect(supplier.side).toBe('supplier');
    expect(supplier.counterpart.map((member) => member.name)).toEqual(['Sara Ost']);
    expect(supplier.sroDescription).toBeNull();
    // Auch direkt in der Datenbank: die Lieferantenseite sieht kein internes Mitglied des Käufers.
    const seen = await withTenant(
      db,
      { userId: users.kam, organizationId: orgs.supplier, customerOrganizationId: orgs.oem },
      async (tx) =>
        (
          await tx.execute<{ name: string }>(
            sql`select member_name as name from relationship_member where relationship_id = ${rel} order by 1`,
          )
        ).rows.map((row) => row.name),
    );
    expect(seen).toEqual(['Kim Kaiser', 'Lea Lang', 'Ole Brandt', 'Sara Ost']);
  });

  it('jede Seite ändert nur ihr Team; Versuche an der anderen Seite geben 403', async () => {
    expect((await call(users.sro, 'PUT', supplierTeam, { members: [] })).status).toBe(403);
    expect((await call(users.kam, 'PUT', buyerTeam, { members: [] })).status).toBe(403);
    // Wer nicht SRO, KAM oder Admin ist, pflegt kein Team.
    expect((await call(users.buyerMember, 'PUT', buyerTeam, { members: [] })).status).toBe(403);
    expect((await call(users.supplierMember, 'PUT', supplierTeam, { members: [] })).status).toBe(
      403,
    );
    // Personen der anderen Seite kommen nicht ins eigene Team.
    expect(
      (
        await call(users.sro, 'PUT', buyerTeam, {
          members: [{ userId: users.kam, teamRole: 'member', function: null }],
        })
      ).status,
    ).toBe(409);
    // Ändern auf einer Seite lässt die andere unberührt.
    const before = teamResponseSchema.parse((await call(users.sro, 'GET', buyerTeam)).body);
    await call(users.supplierOther, 'PUT', supplierTeam, {
      members: [{ userId: users.kam, teamRole: 'sro', function: null }],
    });
    const after = teamResponseSchema.parse((await call(users.sro, 'GET', buyerTeam)).body);
    expect(after.members).toEqual(before.members);
  });

  it('bis zu zwei Sponsoren je Seite, genau ein SRO bzw. KAM je Seite', async () => {
    const three = [users.kam, users.supplierMember, users.supplierOther].map((userId) => ({
      userId,
      teamRole: 'sponsor',
      function: null,
    }));
    expect((await call(users.supplierOther, 'PUT', supplierTeam, { members: three })).status).toBe(
      409,
    );
    expect(
      (
        await call(users.admin, 'PUT', buyerTeam, {
          members: [
            { userId: users.sro, teamRole: 'sro', function: null },
            { userId: users.buyerMember, teamRole: 'sro', function: null },
          ],
        })
      ).status,
    ).toBe(409);
  });

  it('Teamänderungen stehen im Verlauf, mit der Sichtbarkeit des Mitglieds', async () => {
    const history = auditResponseSchema.parse(
      (await call(users.admin, 'GET', `/audit?object_type=relationship_member&object_id=${rel}`))
        .body,
    );
    const latest = history.entries[0]?.changes.team as {
      to: { name: string; visibility: string }[];
    };
    expect(latest.to.find((member) => member.name === 'Tom Berg')?.visibility).toBe('internal');
  });

  it('die Rollenbeschreibung ist je Kunde änderbar und erscheint auf der Team-Seite', async () => {
    const initial = teamResponseSchema.parse((await call(users.sro, 'GET', buyerTeam)).body);
    expect(initial.sroDescription).toMatchObject({ ...defaultSroDescription, updatedByName: null });
    expect((await call(users.sro, 'PUT', '/rollen/sro', { does: ['x'], doesNot: [] })).status).toBe(
      403,
    );
    expect(
      (
        await call(users.admin, 'PUT', '/rollen/sro', {
          does: ['Strategie', 'Gesamtblick'],
          doesNot: ['Verhandlungen'],
        })
      ).status,
    ).toBe(200);
    const team = teamResponseSchema.parse((await call(users.sro, 'GET', buyerTeam)).body);
    expect(team.sroDescription).toEqual({
      role: 'sro',
      does: ['Strategie', 'Gesamtblick'],
      doesNot: ['Verhandlungen'],
      updatedByName: 'Ada Admin',
    });
  });
});
