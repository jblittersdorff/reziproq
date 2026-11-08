import { randomUUID } from 'node:crypto';
import { type Database, schema, sql } from '@reziproq/db';
import {
  customerListSchema,
  customerWorkspaceSchema,
  permissionsResponseSchema,
  startSchema,
} from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { discoverRoutes } from '../../testing/routes.js';
import { startTestApp } from '../../testing/test-app.js';

// Tests zu docs/specs/LIF-02.md über die API. Dass im Kontext eines Kunden keine Zeile eines
// anderen Kunden sichtbar ist, prüft das Gerüst in packages/db/src/layers.test.ts für jede Tabelle
// (Betrachter „Test-Lieferant bei Test-OEM“ und „bei Zweit-OEM“).
describe('LIF-02 Arbeitsbereich des Lieferanten über die API', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const run = randomUUID().slice(0, 8);
  const orgs = {
    oem: randomUUID(),
    zweit: randomUUID(),
    dritt: randomUUID(),
    supplier: randomUUID(),
    other: randomUUID(),
  };
  const rel = {
    oem: randomUUID(),
    zweit: randomUUID(),
    draft: randomUUID(),
    foreign: randomUUID(),
  };
  const users = {
    kam: `lif2-kam-${run}`,
    buyer: `lif2-buyer-${run}`,
  };

  const call = async (user: string, method: string, path: string) => {
    const response = await fetch(`${testApp.baseUrl}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${await testApp.signToken({ subject: user })}`,
        ...(method === 'GET' ? {} : { 'content-type': 'application/json' }),
      },
      ...(method === 'GET' ? {} : { body: '{}' }),
    });
    return { status: response.status, body: (await response.json().catch(() => null)) as unknown };
  };

  beforeAll(async () => {
    testApp = await startTestApp();
    db = testApp.adminDb;
    await db.insert(schema.organization).values([
      { id: orgs.oem, name: `B-Kunde ${run}` },
      { id: orgs.zweit, name: `A-Kunde ${run}` },
      { id: orgs.dritt, name: `C-Entwurf ${run}` },
      { id: orgs.supplier, name: `LIF2-Lieferant ${run}` },
      { id: orgs.other, name: `LIF2-Fremd ${run}` },
    ]);
    await db.insert(schema.organizationFeature).values([
      { organizationId: orgs.oem, feature: 'buyer' },
      { organizationId: orgs.zweit, feature: 'buyer' },
      { organizationId: orgs.dritt, feature: 'buyer' },
    ]);
    await db.insert(schema.appUser).values([
      {
        id: users.kam,
        name: 'Kim Kaiser',
        email: `${users.kam}@example.com`,
        organizationId: orgs.supplier,
        orgRole: 'admin',
        rolesImportedAt: new Date(),
      },
      {
        id: users.buyer,
        name: 'Lena Berger',
        email: `${users.buyer}@example.com`,
        organizationId: orgs.oem,
        orgRole: 'admin',
        rolesImportedAt: new Date(),
      },
    ]);
    await insertRelationships(db, [
      {
        id: rel.oem,
        buyer: orgs.oem,
        supplier: orgs.supplier,
        externalRef: 'GEHEIM-OEM',
        notes: 'Interne Notiz des Käufers',
        spend: [{ year: 2025, amountCents: 123_456_00 }],
      },
      { id: rel.zweit, buyer: orgs.zweit, supplier: orgs.supplier },
      { id: rel.draft, buyer: orgs.dritt, supplier: orgs.supplier, status: 'draft' },
      { id: rel.foreign, buyer: orgs.oem, supplier: orgs.other },
    ]);
    await db.insert(schema.relationshipMember).values({
      relationshipId: rel.oem,
      orgId: orgs.oem,
      userId: users.buyer,
      teamRole: 'sro',
    });
  });

  afterAll(async () => {
    await deleteRelationships(db, Object.values(orgs));
    await db.execute(sql`delete from app_user where id in ${Object.values(users)}`);
    await db.execute(
      sql`delete from organization_feature where organization_id in ${Object.values(orgs)}`,
    );
    await db.execute(sql`delete from organization where id in ${Object.values(orgs)}`);
    await testApp.close();
  });

  it('Kunden zeigt alle aktiven Kunden nach Name, ohne Entwurf und ohne fremde Beziehungen', async () => {
    const { status, body } = await call(users.kam, 'GET', '/api/kunden');
    expect(status).toBe(200);
    expect(customerListSchema.parse(body).customers).toEqual([
      { relationshipId: rel.zweit, name: `A-Kunde ${run}`, nextMeeting: null },
      { relationshipId: rel.oem, name: `B-Kunde ${run}`, nextMeeting: null },
    ]);
  });

  it('der Arbeitsbereich eines Kunden nennt nur ihn und nichts Internes des Käufers, auch keine Anzahl', async () => {
    const { status, body } = await call(users.kam, 'GET', `/api/kunden/${rel.oem}`);
    expect(status).toBe(200);
    expect(customerWorkspaceSchema.parse(body)).toEqual({
      relationshipId: rel.oem,
      name: `B-Kunde ${run}`,
      relationshipType: null,
      nextMeeting: null,
    });
    // Genau diese Felder; Spend, eigene Nummer, Notizen oder Zähler des Käufers kommen nie mit.
    expect(Object.keys(body as object).sort()).toEqual([
      'name',
      'nextMeeting',
      'relationshipId',
      'relationshipType',
    ]);
    const text = JSON.stringify(body);
    for (const secret of ['GEHEIM-OEM', 'Interne Notiz', '12345600', 'A-Kunde']) {
      expect(text).not.toContain(secret);
    }
  });

  it('ein Entwurf, eine fremde und eine unbekannte Beziehung geben 404', async () => {
    for (const id of [rel.draft, rel.foreign, randomUUID()]) {
      expect((await call(users.kam, 'GET', `/api/kunden/${id}`)).status).toBe(404);
    }
  });

  it('der Lieferant bekommt auf allen Adressen des Käufers 403, auch für die eigene Beziehung', async () => {
    const buyerPrefixes = [
      '/api/suppliers',
      '/api/portfolio',
      '/api/rounds',
      '/api/ratings',
      '/api/segment-model',
      '/api/business-units',
      '/api/material-groups',
    ];
    const routes = discoverRoutes(testApp.app).filter(
      (route) =>
        route.method === 'GET' && buyerPrefixes.some((prefix) => route.path.startsWith(prefix)),
    );
    expect(routes.length).toBeGreaterThan(10);
    const results: string[] = [];
    for (const route of routes) {
      // Die Beispiel-ID ersetzt durch die echte Beziehung des Lieferanten.
      const path = route.path.replaceAll('00000000-0000-7000-8000-000000000000', rel.oem);
      results.push(
        `${route.method} ${route.path} → ${(await call(users.kam, 'GET', path)).status}`,
      );
    }
    expect(results).toEqual(routes.map((route) => `${route.method} ${route.path} → 403`));
  });

  it('die Rechte der Lieferantenseite enthalten keine Aktionen des Käufers', async () => {
    const { actions } = permissionsResponseSchema.parse(
      (await call(users.kam, 'GET', '/api/me/permissions')).body,
    );
    expect(actions).toContain('kunden.sehen');
    for (const buyerAction of [
      'lieferanten.sehen',
      'lieferanten.einladen',
      'portfolio.sehen',
      'runden.sehen',
      'bewertungen.sehen',
      'segmentmodell.sehen',
      'lieferantenplan.bearbeiten',
    ]) {
      expect(actions).not.toContain(buyerAction);
    }
  });

  it('die Startseite nennt die Kunden mit Namen, ohne Soll-Typ des Käufers', async () => {
    const data = startSchema.parse((await call(users.kam, 'GET', '/api/start')).body);
    expect(data.relationships).toEqual({
      items: [
        { id: rel.zweit, name: `A-Kunde ${run}`, target: null },
        { id: rel.oem, name: `B-Kunde ${run}`, target: null },
      ],
      total: 2,
    });
    expect(data.due.items).toEqual([]);
  });

  it('Käufer haben hier keine Kunden und keinen Arbeitsbereich', async () => {
    expect(customerListSchema.parse((await call(users.buyer, 'GET', '/api/kunden')).body)).toEqual({
      customers: [],
    });
    expect((await call(users.buyer, 'GET', `/api/kunden/${rel.oem}`)).status).toBe(403);
  });
});
