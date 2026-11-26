import { randomUUID } from 'node:crypto';
import { type Database, schema, sql } from '@reziproq/db';
import { activityFeedSchema } from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { createPromptTools, invokePromptTool } from '../prompt/tools.js';
import { SuppliersService } from '../suppliers/suppliers.service.js';
import { ActivitiesService } from './activities.service.js';

// Tests zu docs/specs/AK-01.md, T2-S03 (K2-a.4): Eine Notiz „Nur ich“ sieht nur ihre Autorin, im
// Verlauf und über Frag Reziproq, auch keine Person im Team der Beziehung und kein Admin. Die
// Datenbank erzwingt das (Policy note_private_author); Frag Reziproq liest mit den Rechten der
// fragenden Person. Jedes Werkzeug von Frag Reziproq wird geprüft, auch künftige.

describe('AK-01 T2-S03 Notizen „Nur ich“', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const run = randomUUID().slice(0, 8);
  const orgs = { oem: randomUUID(), supplier: randomUUID() };
  const rel = randomUUID();
  const supplierName = `AK01-Lieferant ${run}`;
  const users = {
    author: `ak01-autorin-${run}`,
    colleague: `ak01-kollege-${run}`,
    admin: `ak01-admin-${run}`,
  };
  const secret = `Nur für mich ${run}`;
  const team = `Für das Team ${run}`;
  const base = `/suppliers/${rel}`;

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
  const titles = async (user: string) =>
    activityFeedSchema
      .parse((await call(user, 'GET', `${base}/aktivitaeten`)).body)
      .items.map((item) => item.title);
  const auth = (userId: string, orgRole: 'admin' | 'member'): AuthContext => ({
    userId,
    accessToken: '',
    orgRole,
    isControlling: false,
    isOperator: false,
    tokenRoles: [],
    organization: { id: orgs.oem, name: `AK01-OEM ${run}`, country: null, buyer: true },
  });
  // Eingaben je Werkzeug, die auf die Beziehung mit der Notiz zielen
  const inputs: Record<string, unknown> = {
    lieferanten_suchen: { name: supplierName },
    seite_oeffnen: { lieferant: supplierName },
    lieferant_mails: { lieferant: supplierName },
  };

  beforeAll(async () => {
    testApp = await startTestApp();
    db = testApp.adminDb;
    await db.insert(schema.organization).values([
      { id: orgs.oem, name: `AK01-OEM ${run}` },
      { id: orgs.supplier, name: supplierName },
    ]);
    await db
      .insert(schema.organizationFeature)
      .values({ organizationId: orgs.oem, feature: 'buyer' });
    const person = (id: string, orgRole: 'admin' | 'member') => ({
      id,
      name: id,
      email: `${id}@example.com`,
      organizationId: orgs.oem,
      orgRole,
      rolesImportedAt: new Date(),
    });
    await db
      .insert(schema.appUser)
      .values([
        person(users.author, 'member'),
        person(users.colleague, 'member'),
        person(users.admin, 'admin'),
      ]);
    await insertRelationships(db, [{ id: rel, buyer: orgs.oem, supplier: orgs.supplier }]);
    await db.insert(schema.relationshipMember).values([
      { relationshipId: rel, orgId: orgs.oem, userId: users.author, teamRole: 'sro' },
      { relationshipId: rel, orgId: orgs.oem, userId: users.colleague, teamRole: 'member' },
    ]);
    for (const [text, visibility] of [
      [team, 'team'],
      [secret, 'private'],
    ] as const) {
      const created = await call(users.author, 'POST', `${base}/notizen`, { text, visibility });
      expect(created.status).toBe(201);
    }
  });

  afterAll(async () => {
    const orgIds = Object.values(orgs);
    await db.execute(sql`delete from note where org_id in ${orgIds}`);
    await deleteRelationships(db, orgIds);
    await db.execute(sql`delete from app_user where organization_id in ${orgIds}`);
    await db.execute(sql`delete from organization_feature where organization_id in ${orgIds}`);
    await db.execute(sql`delete from organization where id in ${orgIds}`);
    await testApp.close();
  });

  it('im Verlauf sieht nur die Autorin ihre Notiz „Nur ich“, das Team und der Admin nicht', async () => {
    expect(await titles(users.author)).toEqual(expect.arrayContaining([team, secret]));
    for (const user of [users.colleague, users.admin]) {
      const seen = await titles(user);
      expect(seen).toContain(team);
      expect(seen).not.toContain(secret);
    }
  });

  it('kein Werkzeug von Frag Reziproq liefert sie einer anderen Person', async () => {
    const tools = Object.keys(createPromptTools(async () => null)).sort();
    // Ein neues Werkzeug braucht hier eine Eingabe, sonst bleibt es ungeprüft
    expect(tools).toEqual(Object.keys(inputs).sort());
    for (const [user, role] of [
      [users.colleague, 'member'],
      [users.admin, 'admin'],
    ] as const) {
      for (const name of tools) {
        const result = await invokePromptTool(
          name,
          inputs[name],
          auth(user, role),
          testApp.app.get(SuppliersService),
          () => {},
          testApp.app.get(ActivitiesService),
        );
        expect(JSON.stringify(result), `${name} für ${role}`).not.toContain(secret);
      }
    }
    // Gegenprobe: Die Werkzeuge finden die Beziehung, sie prüfen also wirklich diese Akte
    const found = await invokePromptTool(
      'lieferanten_suchen',
      inputs.lieferanten_suchen,
      auth(users.colleague, 'member'),
      testApp.app.get(SuppliersService),
      () => {},
      testApp.app.get(ActivitiesService),
    );
    expect(JSON.stringify(found)).toContain(supplierName);
  });
});
