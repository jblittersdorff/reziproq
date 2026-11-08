import { randomUUID } from 'node:crypto';
import { type Database, schema, sql } from '@reziproq/db';
import { type OrgRole, supplierOverviewSchema } from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TenantDatabase } from '../../common/database.module.js';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { OverviewService } from './overview.service.js';
import type { OverviewMetricSource } from './overview-metric.js';

// Tests zu docs/specs/NAV-06.md über die API: Kopf und Überblick des Arbeitsbereichs.

describe('NAV-06: Kopf und Überblick über die API', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const run = randomUUID().slice(0, 8);
  const orgs = { oem: randomUUID(), zweit: randomUUID(), supplier: randomUUID() };
  const relationshipId = randomUUID();
  const users = {
    admin: `n06-admin-${run}`,
    member: `n06-member-${run}`,
    zweit: `n06-zweit-${run}`,
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

  const overview = async (user = users.member) =>
    supplierOverviewSchema.parse(
      (await call(user, 'GET', `/suppliers/${relationshipId}/overview`)).body,
    );

  const setTeam = (members: { userId: string; teamRole: string; function: string | null }[]) =>
    call(users.admin, 'PUT', `/suppliers/${relationshipId}/team`, { members });

  beforeAll(async () => {
    testApp = await startTestApp();
    db = testApp.adminDb;
    await db.insert(schema.organization).values([
      { id: orgs.oem, name: `N06-OEM ${run}` },
      { id: orgs.zweit, name: `N06-Zweit ${run}` },
      { id: orgs.supplier, name: `N06-Lieferant ${run}` },
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
        person(users.zweit, 'Zoe Zweit', 'admin', orgs.zweit),
      ]);
    await insertRelationships(db, [
      { id: relationshipId, buyer: orgs.oem, supplier: orgs.supplier },
    ]);
  });

  afterAll(async () => {
    await deleteRelationships(db, [orgs.oem]);
    await db.delete(schema.appUser).where(sql`${schema.appUser.id} in ${Object.values(users)}`);
    await db
      .delete(schema.organization)
      .where(sql`${schema.organization.id} in ${Object.values(orgs)}`);
    await testApp.close();
  });

  it('Der Kopf zeigt die Werte aus ihrem Ort. Ein Test ändert den SRO im Team und prüft den Kopf.', async () => {
    // Ohne Team, Segment und Termin: alles noch offen.
    expect((await overview()).head).toEqual({
      segment: null,
      sro: null,
      nextMeeting: null,
      isFocus: false,
    });

    await setTeam([
      { userId: users.admin, teamRole: 'sro', function: 'purchasing' },
      { userId: users.member, teamRole: 'member', function: null },
    ]);
    expect((await overview()).head.sro).toEqual({ userId: users.admin, name: 'Ada Admin' });

    // SRO im Team wechseln: Der Kopf folgt ohne eigene Kopie.
    await setTeam([
      { userId: users.admin, teamRole: 'sponsor', function: 'purchasing' },
      { userId: users.member, teamRole: 'sro', function: null },
    ]);
    expect((await overview()).head.sro).toEqual({ userId: users.member, name: 'Max Mitglied' });
  });

  it('Der Überblick speichert keine eigenen Daten: Kennzahlen kommen aus den Modulen', async () => {
    await setTeam([{ userId: users.admin, teamRole: 'sro', function: null }]);
    expect((await overview()).metrics).toEqual([
      { tile: 'relationship', kind: 'team_size', count: 1 },
    ]);

    expect(
      (
        await call(users.admin, 'PUT', `/suppliers/${relationshipId}/spend/2024`, {
          amountCents: 150_000_00,
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await call(users.admin, 'PUT', `/suppliers/${relationshipId}/spend/2025`, {
          amountCents: 420_000_00,
        })
      ).status,
    ).toBe(200);
    expect((await overview()).metrics).toEqual([
      {
        tile: 'strategy',
        kind: 'spend',
        year: 2025,
        amount: { amountCents: 420_000_00, currency: 'EUR' },
      },
      { tile: 'relationship', kind: 'team_size', count: 1 },
    ]);

    // Ein Abruf schreibt nichts, auch keinen Verlauf.
    const events = async () =>
      (
        await db.execute<{ count: number }>(
          sql`select count(*)::int as count from audit_event where relationship_id = ${relationshipId}`,
        )
      ).rows[0]?.count;
    const before = await events();
    await overview();
    await overview(users.admin);
    expect(await events()).toBe(before);
  });

  it('Der Überblick speichert keine eigenen Daten: Eine Quelle, die schreiben will, scheitert', async () => {
    const writer: OverviewMetricSource = {
      async overviewMetric(id, _user, tx) {
        await tx.execute(
          sql`update relationship_side set notes = 'vom Überblick' where relationship_id = ${id}`,
        );
        return null;
      },
    };
    const service = new OverviewService(testApp.app.get(TenantDatabase), [writer]);
    const auth: AuthContext = {
      userId: users.admin,
      accessToken: '',
      orgRole: 'admin',
      isControlling: false,
      isOperator: false,
      tokenRoles: [],
      organization: { id: orgs.oem, name: 'N06-OEM', country: 'DE', buyer: true },
    };
    const failure = await service.overview(auth, relationshipId).catch((caught: Error) => caught);
    expect(String((failure as Error).cause ?? failure)).toMatch(/read-only transaction/);
  });

  it('Der Zweit-OEM bekommt den Überblick fremder Lieferanten nicht', async () => {
    expect((await call(users.zweit, 'GET', `/suppliers/${relationshipId}/overview`)).status).toBe(
      404,
    );
    expect((await call(users.zweit, 'GET', '/suppliers/keine-uuid/overview')).status).toBe(400);
  });
});
