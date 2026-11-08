import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { type Database, schema, sql } from '@reziproq/db';
import {
  type Action,
  actions,
  auditResponseSchema,
  type OrgRole,
  orgRoles,
  permissionsResponseSchema,
} from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { discoverRoutes } from '../../testing/routes.js';
import { startTestApp } from '../../testing/test-app.js';
import { permissions } from './permissions.js';
import { renderRightsDoc } from './rights-doc.js';

// Tests zu docs/specs/PLT-05.md, Teil a, über die API: Rechte-Matrix, can() an jedem Endpunkt,
// letzter Admin, Verlauf der Rollen und docs/rechte.md.

describe('PLT-05a: Rollen und Rechte über die API', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const run = randomUUID().slice(0, 8);
  const orgs = { oem: randomUUID(), zweit: randomUUID(), supplier: randomUUID() };
  const relationshipId = randomUUID();
  // Je Rolle eine Person im OEM, dazu ein Ziel für Rollenänderungen und ein Admin im Zweit-OEM.
  const users = {
    admin: `p05-admin-${run}`,
    member: `p05-member-${run}`,
    viewer: `p05-viewer-${run}`,
    target: `p05-target-${run}`,
    zweitAdmin: `p05-zweit-${run}`,
    operator: `p05-operator-${run}`,
  };

  const token = (user: string, claims: Record<string, unknown> = {}) =>
    testApp.signToken({ subject: user, claims });

  const request = async (
    user: string,
    method: string,
    path: string,
    body?: unknown,
    claims?: Record<string, unknown>,
  ) => {
    const res = await fetch(`${testApp.baseUrl}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${await token(user, claims)}`,
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: res.status, body: (await res.json().catch(() => null)) as unknown };
  };

  const actionsOf = async (user: string) =>
    permissionsResponseSchema.parse((await request(user, 'GET', '/api/me/permissions')).body)
      .actions;

  /**
   * Je Aktion ein echter Endpunkt, der genau diese Aktion braucht. Aktionen ohne eigenen
   * Endpunkt (nur Oberfläche oder spätere Specs) prüft der Test über /me/permissions.
   */
  const endpoints: Record<Action, ((user: string) => Promise<number>) | 'nur-oberflaeche'> = {
    'organisation.sehen': async (user) => (await request(user, 'GET', '/api/organisation')).status,
    'start.sehen': async (user) => (await request(user, 'GET', '/api/start')).status,
    'rollen.aendern': async (user) =>
      (
        await request(user, 'PUT', `/api/organisation/mitglieder/${users.target}`, {
          orgRole: 'viewer',
          isControlling: false,
          defaultFunction: null,
        })
      ).status,
    'einstellungen.verwalten': 'nur-oberflaeche',
    'lieferanten.sehen': async (user) => (await request(user, 'GET', '/api/suppliers')).status,
    'lieferanten.bearbeiten': async (user) =>
      (await request(user, 'GET', '/api/suppliers/lookup?ust=DE123456789')).status,
    'team.festlegen': async (user) =>
      (await request(user, 'PUT', `/api/suppliers/${relationshipId}/team`, { members: [] })).status,
    'verlauf.sehen': async (user) =>
      (await request(user, 'GET', `/api/audit?object_type=relationship&object_id=${randomUUID()}`))
        .status,
    'prompt.nutzen': async (user) =>
      (
        await request(user, 'POST', '/api/prompt', {
          messages: [{ role: 'user', content: 'Hallo' }],
        })
      ).status,
    'kunden.wechseln': async (user) => (await request(user, 'GET', '/api/betreiber/kunden')).status,
    'stammdaten.verwalten': async (user) =>
      (
        await request(user, 'POST', '/api/business-units', {
          name: 'Probe',
          code: `P-${randomUUID().slice(0, 8)}`,
        })
      ).status,
    'zuordnung.bearbeiten': async (user) =>
      (
        await request(user, 'PUT', `/api/suppliers/${relationshipId}/zuordnung`, {
          businessUnitIds: [],
          materialGroupIds: [],
          primaryMaterialGroupId: null,
        })
      ).status,
    'segmentmodell.sehen': 'nur-oberflaeche',
    'segmentmodell.verwalten': 'nur-oberflaeche',
    'runden.sehen': async (user) => (await request(user, 'GET', '/api/rounds')).status,
    'runden.verwalten': async (user) =>
      (await request(user, 'POST', '/api/rounds', { name: 'Probe', dueDate: '2099-01-01' })).status,
    'runden.nachnominieren': async (user) =>
      (await request(user, 'GET', '/api/rounds/raters')).status,
    'bewertungen.sehen': async (user) => (await request(user, 'GET', '/api/ratings/mine')).status,
    // Eine unbekannte Einladung gibt für Berechtigte 404; das Recht selbst ist damit erwiesen.
    'bewertungen.abgeben': async (user) => {
      const { status } = await request(
        user,
        'PUT',
        '/api/ratings/00000000-0000-4000-8000-000000000000',
        { criterionKey: 'x', ist: 1 },
      );
      return status === 404 ? 200 : status;
    },
    // Eine unbekannte Beziehung gibt für Berechtigte 404; das Recht selbst ist damit erwiesen.
    'segmentierung.konsolidieren': async (user) => {
      const level = { impactLevel: 1, qualityLevel: 1 };
      const { status } = await request(
        user,
        'POST',
        '/api/ratings/relationship/00000000-0000-4000-8000-000000000000/decisions',
        { total: { ist: level, soll: level, reason: 'x' }, entries: [] },
      );
      return status === 404 ? 200 : status;
    },
    // Eine unbekannte Beziehung gibt für Berechtigte 404; das Recht selbst ist damit erwiesen.
    'fokus.setzen': async (user) => {
      const { status } = await request(
        user,
        'PUT',
        '/api/portfolio/fokus/00000000-0000-4000-8000-000000000000',
        { isFocus: true, reason: 'x' },
      );
      return status === 404 ? 200 : status;
    },
    'zyklus.starten': async (user) => {
      const { status } = await request(
        user,
        'POST',
        '/api/suppliers/00000000-0000-4000-8000-000000000000/cycle',
      );
      return status === 404 ? 200 : status;
    },
    'lieferantenplan.bearbeiten': async (user) => {
      const { status } = await request(
        user,
        'POST',
        '/api/suppliers/00000000-0000-4000-8000-000000000000/plan',
      );
      return status === 404 ? 200 : status;
    },
    'portfolio.sehen': async (user) => (await request(user, 'GET', '/api/portfolio')).status,
    // Käufer haben keine Kunden; die leere Liste zeigt, dass das Recht greift (LIF-02).
    'kunden.sehen': async (user) => (await request(user, 'GET', '/api/kunden')).status,
    // Eine unbekannte Beziehung gibt für Berechtigte 404; das Recht selbst ist damit erwiesen.
    'lieferanten.einladen': async (user) => {
      const { status } = await request(
        user,
        'POST',
        '/api/suppliers/00000000-0000-4000-8000-000000000000/einladungen',
        { email: 'kim@example.com' },
      );
      return status === 404 ? 200 : status;
    },
  };

  beforeAll(async () => {
    testApp = await startTestApp();
    db = testApp.adminDb;
    await db.insert(schema.organization).values([
      { id: orgs.oem, name: `P05-OEM ${run}` },
      { id: orgs.zweit, name: `P05-Zweit ${run}` },
      { id: orgs.supplier, name: `P05-Lieferant ${run}` },
    ]);
    await insertRelationships(db, [
      { id: relationshipId, buyer: orgs.oem, supplier: orgs.supplier },
    ]);
    await db.insert(schema.organizationFeature).values([
      { organizationId: orgs.oem, feature: 'buyer' as const },
      { organizationId: orgs.zweit, feature: 'buyer' as const },
    ]);
    const person = (id: string, orgRole: OrgRole, organizationId: string | null = orgs.oem) => ({
      id,
      name: id,
      email: `${id}@example.com`,
      organizationId,
      orgRole,
      rolesImportedAt: new Date(),
    });
    await db
      .insert(schema.appUser)
      .values([
        person(users.admin, 'admin'),
        person(users.member, 'member'),
        person(users.viewer, 'viewer'),
        person(users.target, 'viewer'),
        person(users.zweitAdmin, 'admin', orgs.zweit),
        { ...person(users.operator, 'viewer', null), isOperator: true },
      ]);
  });

  afterAll(async () => {
    await db
      .delete(schema.segmentationRound)
      .where(sql`${schema.segmentationRound.orgId} in ${Object.values(orgs)}`);
    await db.delete(schema.appUser).where(sql`${schema.appUser.id} in ${Object.values(users)}`);
    await deleteRelationships(db, [orgs.oem]);
    await db
      .delete(schema.organization)
      .where(sql`${schema.organization.id} in ${Object.values(orgs)}`);
    await testApp.close();
  });

  describe('Ein tabellengesteuerter Test prüft jede Zeile der Matrix für jede Rolle gegen die API: erlaubt gibt 2xx, verboten gibt 403', () => {
    it('jede Aktion der Matrix hat hier eine Zeile', () => {
      expect(Object.keys(endpoints).sort()).toEqual([...actions].sort());
    });

    for (const action of actions) {
      for (const role of orgRoles) {
        it(`${action} als ${role}`, async () => {
          const allowed = permissions[action].roles.includes(role);
          const check = endpoints[action];
          expect((await actionsOf(users[role])).includes(action)).toBe(allowed);
          if (check === 'nur-oberflaeche') return;
          const status = await check(users[role]);
          if (allowed) expect(status, `${action} als ${role}`).toBeLessThan(300);
          else expect(status, `${action} als ${role}`).toBe(403);
        });
      }
    }

    it('kunden.wechseln als Betreiber', async () => {
      const status = await request(users.operator, 'GET', '/api/betreiber/kunden');
      expect(status.status).toBe(200);
    });
  });

  it('Ein Test geht alle Endpunkte durch und schlägt fehl, wenn einer ohne can() auskommt. Ausgenommen sind /health, /me und der Einladungslink.', () => {
    const routes = discoverRoutes(testApp.app);
    expect(routes.length).toBeGreaterThan(10);
    const unchecked = routes
      .filter((route) => !route.isPublic && !route.path.startsWith('/api/me'))
      .filter((route) => !route.requires)
      .map((route) => `${route.method} ${route.path}`);
    expect(unchecked).toEqual([]);
    // Ausnahmen sind genau /health und der Einladungslink (LIF-01a, beide öffentlich) und /me.
    const exempt = routes.filter((route) => !route.requires).map((route) => route.path);
    expect(new Set(exempt)).toEqual(
      new Set([
        '/api/health',
        '/api/me',
        '/api/me/permissions',
        '/api/me/anmeldung',
        '/api/me/sprache',
        '/api/einladungen/00000000-0000-7000-8000-000000000000',
        '/api/einladungen/00000000-0000-7000-8000-000000000000/annahme',
      ]),
    );
  });

  it('Der letzte Admin einer Organisation kann sich nicht selbst herabstufen', async () => {
    const res = await request(
      users.zweitAdmin,
      'PUT',
      `/api/organisation/mitglieder/${users.zweitAdmin}`,
      {
        orgRole: 'member',
        isControlling: false,
        defaultFunction: null,
      },
    );
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ code: 'letzter_admin' });
    const stored = await db.execute<{ org_role: string }>(
      sql`select org_role from app_user where id = ${users.zweitAdmin}`,
    );
    expect(stored.rows[0]?.org_role).toBe('admin');
  });

  it('Rollenwechsel stehen im internen Verlauf', async () => {
    const res = await request(users.admin, 'PUT', `/api/organisation/mitglieder/${users.target}`, {
      orgRole: 'member',
      isControlling: true,
      defaultFunction: 'quality',
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      orgRole: 'member',
      isControlling: true,
      defaultFunction: 'quality',
    });

    const history = auditResponseSchema.parse(
      (
        await request(
          users.admin,
          'GET',
          `/api/audit?object_type=app_user_role&object_id=${users.target}`,
        )
      ).body,
    );
    expect(history.entries[0]).toMatchObject({
      actorName: users.admin,
      action: 'updated',
      changes: {
        org_role: { from: 'viewer', to: 'member' },
        is_controlling: { from: false, to: true },
        default_function: { from: null, to: 'quality' },
      },
    });
    // Nur intern: Der Zweit-OEM sieht nichts davon.
    const foreign = auditResponseSchema.parse(
      (
        await request(
          users.zweitAdmin,
          'GET',
          `/api/audit?object_type=app_user_role&object_id=${users.target}`,
        )
      ).body,
    );
    expect(foreign.entries).toEqual([]);
    const visibility = await db.execute<{ visibility: string }>(
      sql`select distinct visibility from audit_event where object_type = 'app_user_role' and object_id = ${users.target}`,
    );
    expect(visibility.rows).toEqual([{ visibility: 'internal' }]);

    // Danach zurück, damit die Matrix-Tests in jeder Reihenfolge laufen.
    await db
      .update(schema.appUser)
      .set({ orgRole: 'viewer', isControlling: false })
      .where(sql`${schema.appUser.id} = ${users.target}`);
  });

  it('Ein Admin ändert keine Mitglieder einer anderen Organisation', async () => {
    const res = await request(
      users.admin,
      'PUT',
      `/api/organisation/mitglieder/${users.zweitAdmin}`,
      {
        orgRole: 'viewer',
        isControlling: false,
        defaultFunction: null,
      },
    );
    expect(res.status).toBe(404);
  });

  it('prüft Rolle und Funktion beim Ändern', async () => {
    const res = await request(users.admin, 'PUT', `/api/organisation/mitglieder/${users.target}`, {
      orgRole: 'chef',
      isControlling: false,
      defaultFunction: 'marketing',
    });
    expect(res.status).toBe(400);
  });

  it('docs/rechte.md wird aus permissions.ts erzeugt. Ein Test schlägt fehl, wenn die Datei veraltet ist.', () => {
    const file = fileURLToPath(new URL('../../../../../docs/rechte.md', import.meta.url));
    expect(readFileSync(file, 'utf8'), 'Bitte pnpm rechte ausführen').toBe(renderRightsDoc());
    for (const action of actions) expect(renderRightsDoc()).toContain(`\`${action}\``);
  });
});
