import { randomUUID } from 'node:crypto';
import { type Database, schema, sql } from '@reziproq/db';
import {
  auditResponseSchema,
  type OrgRole,
  supplierDetailSchema,
  teamResponseSchema,
} from '@reziproq/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';

// Tests zu docs/specs/PLT-05.md, Teil b, über die API: Team je Beziehung, Teamrolle Leser.

describe('PLT-05b: Team je Beziehung über die API', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const run = randomUUID().slice(0, 8);
  const orgs = { oem: randomUUID(), zweit: randomUUID(), supplier: randomUUID() };
  const relationships = { oem: randomUUID(), zweit: randomUUID() };
  const users = {
    admin: `p5b-admin-${run}`,
    member: `p5b-member-${run}`,
    other: `p5b-other-${run}`,
    zweit: `p5b-zweit-${run}`,
  };

  const call = async (user: string, method: string, path: string, body?: unknown) => {
    const res = await fetch(`${testApp.baseUrl}/api${path}`, {
      method,
      headers: {
        authorization: `Bearer ${await testApp.signToken({ subject: user })}`,
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: res.status, body: (await res.json().catch(() => null)) as unknown };
  };

  const setTeam = (members: { userId: string; teamRole: string; function: string | null }[]) =>
    call(users.admin, 'PUT', `/suppliers/${relationships.oem}/team`, { members });

  beforeAll(async () => {
    testApp = await startTestApp();
    db = testApp.adminDb;
    await db.insert(schema.organization).values([
      { id: orgs.oem, name: `P5b-OEM ${run}` },
      { id: orgs.zweit, name: `P5b-Zweit ${run}` },
      { id: orgs.supplier, name: `P5b-Lieferant ${run}` },
    ]);
    await db.insert(schema.organizationFeature).values([
      { organizationId: orgs.oem, feature: 'buyer' as const },
      { organizationId: orgs.zweit, feature: 'buyer' as const },
    ]);
    const person = (id: string, name: string, orgRole: OrgRole, organizationId: string) => ({
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
        person(users.admin, 'Ada Admin', 'admin', orgs.oem),
        person(users.member, 'Max Mitglied', 'member', orgs.oem),
        person(users.other, 'Otto Andere', 'member', orgs.oem),
        person(users.zweit, 'Zoe Zweit', 'admin', orgs.zweit),
      ]);
    await insertRelationships(db, [
      { id: relationships.oem, buyer: orgs.oem, supplier: orgs.supplier },
      { id: relationships.zweit, buyer: orgs.zweit, supplier: orgs.supplier },
    ]);
  });

  beforeEach(async () => {
    await db.execute(
      sql`delete from relationship_member where relationship_id in ${Object.values(relationships)}`,
    );
  });

  afterAll(async () => {
    await deleteRelationships(db, [orgs.oem, orgs.zweit]);
    await db.delete(schema.appUser).where(sql`${schema.appUser.id} in ${Object.values(users)}`);
    await db
      .delete(schema.organization)
      .where(sql`${schema.organization.id} in ${Object.values(orgs)}`);
    await testApp.close();
  });

  it('der Admin legt das Team fest; alle sehen es mit Rolle und Funktion, SRO zuerst', async () => {
    const saved = await setTeam([
      { userId: users.member, teamRole: 'member', function: 'logistics' },
      { userId: users.admin, teamRole: 'sro', function: 'purchasing' },
    ]);
    expect(saved.status).toBe(200);
    const team = teamResponseSchema.parse(
      (await call(users.member, 'GET', `/suppliers/${relationships.oem}/team`)).body,
    );
    expect(team.members).toEqual([
      {
        userId: users.admin,
        name: 'Ada Admin',
        teamRole: 'sro',
        function: 'purchasing',
        visibility: 'shared',
      },
      {
        userId: users.member,
        name: 'Max Mitglied',
        teamRole: 'member',
        function: 'logistics',
        visibility: 'internal',
      },
    ]);
    // Kandidaten bekommt nur, wer das Team pflegt (PLB-04).
    expect(team.candidates).toEqual([]);
    const forAdmin = teamResponseSchema.parse(
      (await call(users.admin, 'GET', `/suppliers/${relationships.oem}/team`)).body,
    );
    expect(forAdmin.candidates.map((person) => person.name)).toEqual([
      'Ada Admin',
      'Max Mitglied',
      'Otto Andere',
    ]);
    // Nutzer legen kein Team fest.
    expect(
      (await call(users.member, 'PUT', `/suppliers/${relationships.oem}/team`, { members: [] }))
        .status,
    ).toBe(403);
  });

  it('Mit Teamrolle Leser ist eine Beziehung für diesen Nutzer schreibgeschützt', async () => {
    await setTeam([
      { userId: users.member, teamRole: 'viewer', function: null },
      { userId: users.admin, teamRole: 'viewer', function: null },
    ]);
    for (const user of [users.member, users.admin]) {
      expect(
        (await call(user, 'PATCH', `/suppliers/${relationships.oem}`, { displayName: 'X' })).status,
        user,
      ).toBe(403);
      expect(
        (await call(user, 'PUT', `/suppliers/${relationships.oem}/spend/2025`, { amountCents: 1 }))
          .status,
        user,
      ).toBe(403);
      expect(
        (await call(user, 'POST', `/suppliers/${relationships.oem}/beenden`)).status,
        user,
      ).toBe(403);
      const detail = supplierDetailSchema.parse(
        (await call(user, 'GET', `/suppliers/${relationships.oem}`)).body,
      );
      expect(detail.permissions.edit, user).toBe(false);
    }
    // Lesen geht weiter, und der Admin darf das Team weiter festlegen, um sich wieder freizuschalten.
    expect((await call(users.member, 'GET', `/suppliers/${relationships.oem}`)).status).toBe(200);
    expect((await setTeam([{ userId: users.admin, teamRole: 'sro', function: null }])).status).toBe(
      200,
    );
    expect(
      (
        await call(users.admin, 'PATCH', `/suppliers/${relationships.oem}`, {
          displayName: 'Wieder frei',
        })
      ).status,
    ).toBe(200);
    // Ohne Teamrolle Leser bleibt die Beziehung für andere Nutzer beschreibbar.
    const other = supplierDetailSchema.parse(
      (await call(users.other, 'GET', `/suppliers/${relationships.oem}`)).body,
    );
    expect(other.permissions).toEqual({ edit: true, editTeam: false });
  });

  it('Der Zweit-OEM sieht das Team des Test-OEM nicht', async () => {
    await setTeam([{ userId: users.admin, teamRole: 'sro', function: 'purchasing' }]);
    expect((await call(users.zweit, 'GET', `/suppliers/${relationships.oem}/team`)).status).toBe(
      404,
    );
    const own = teamResponseSchema.parse(
      (await call(users.zweit, 'GET', `/suppliers/${relationships.zweit}/team`)).body,
    );
    expect(own.members).toEqual([]);
    expect(own.candidates.map((person) => person.name)).toEqual(['Zoe Zweit']);
    expect(JSON.stringify(own)).not.toContain('Ada Admin');
  });

  it('Teamänderungen stehen im internen Verlauf', async () => {
    await setTeam([{ userId: users.admin, teamRole: 'sro', function: 'purchasing' }]);
    await setTeam([
      { userId: users.admin, teamRole: 'sponsor', function: 'purchasing' },
      { userId: users.member, teamRole: 'sro', function: null },
    ]);
    const history = auditResponseSchema.parse(
      (
        await call(
          users.member,
          'GET',
          `/audit?object_type=relationship_member&object_id=${relationships.oem}`,
        )
      ).body,
    );
    expect(history.entries[0]?.changes).toEqual({
      team: {
        from: [
          { name: 'Ada Admin', team_role: 'sro', function: 'purchasing', visibility: 'shared' },
        ],
        // Sortiert nach Nutzer-ID: p5b-admin vor p5b-member.
        to: [
          { name: 'Ada Admin', team_role: 'sponsor', function: 'purchasing', visibility: 'shared' },
          { name: 'Max Mitglied', team_role: 'sro', function: null, visibility: 'shared' },
        ],
      },
    });
    const visibility = await db.execute<{ visibility: string }>(
      sql`select distinct visibility from audit_event where object_type = 'relationship_member' and object_id = ${relationships.oem}`,
    );
    expect(visibility.rows).toEqual([{ visibility: 'internal' }]);
    const foreign = auditResponseSchema.parse(
      (
        await call(
          users.zweit,
          'GET',
          `/audit?object_type=relationship_member&object_id=${relationships.oem}`,
        )
      ).body,
    );
    expect(foreign.entries).toEqual([]);
  });

  it('prüft die Grenzen: höchstens ein SRO, zwei Sponsoren, jede Person einmal, nur eigene Personen', async () => {
    const sro = await setTeam([
      { userId: users.admin, teamRole: 'sro', function: null },
      { userId: users.member, teamRole: 'sro', function: null },
    ]);
    expect(sro).toMatchObject({ status: 409, body: { code: 'too_many_sro' } });
    const sponsors = await setTeam([
      { userId: users.admin, teamRole: 'sponsor', function: null },
      { userId: users.member, teamRole: 'sponsor', function: null },
      { userId: users.other, teamRole: 'sponsor', function: null },
    ]);
    expect(sponsors).toMatchObject({ status: 409, body: { code: 'too_many_sponsors' } });
    const twice = await setTeam([
      { userId: users.admin, teamRole: 'member', function: null },
      { userId: users.admin, teamRole: 'viewer', function: null },
    ]);
    expect(twice).toMatchObject({ status: 409, body: { code: 'duplicate_person' } });
    const foreign = await setTeam([{ userId: users.zweit, teamRole: 'member', function: null }]);
    expect(foreign).toMatchObject({ status: 409, body: { code: 'nicht_in_organisation' } });
    expect(
      (
        await call(users.admin, 'PUT', `/suppliers/${relationships.oem}/team`, {
          members: [{ userId: users.admin, teamRole: 'chef', function: null }],
        })
      ).status,
    ).toBe(400);
  });
});
