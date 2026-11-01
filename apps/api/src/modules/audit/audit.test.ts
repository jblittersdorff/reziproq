import { randomUUID } from 'node:crypto';
import { auditedObject, type Database, privateColumns, schema, sql } from '@reziproq/db';
import { auditResponseSchema } from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';
import { auditedObjects } from './audited-objects.js';

// Tests zu docs/specs/PLT-08.md über die API. Bis PLT-03b die Beziehung einträgt, steht hier ein
// Probe-Objekt im Register der Objekte mit Verlauf.

vi.mock('./audited-objects.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('./audited-objects.js')>();
  const probe = auditedObject({ type: 'probe', visibility: 'shared', fields: ['status'] });
  return {
    ...original,
    auditedObjectByType: (type: string) =>
      type === 'probe' ? probe : original.auditedObjectByType(type),
  };
});

describe('GET /api/audit', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const run = randomUUID().slice(0, 8);
  const ids = {
    oemA: randomUUID(),
    oemB: randomUUID(),
    supplier: randomUUID(),
    relA: randomUUID(),
    relB: randomUUID(),
  };
  const users = { a: `audit-a-${run}`, b: `audit-b-${run}` };
  // Ein gemeinsames Objekt-ID bei beiden Käufern, damit nur RLS die Einträge trennt.
  const objectId = `objekt-${run}`;

  const history = async (user: string, query = `object_type=probe&object_id=${objectId}`) =>
    testApp.get(
      `/api/audit?${query}`,
      await testApp.signToken({
        subject: user,
        claims: { 'urn:zitadel:iam:org:project:test-project:roles': { nutzer: { '1': 'test' } } },
      }),
    );

  beforeAll(async () => {
    testApp = await startTestApp();
    db = testApp.adminDb;
    await db.insert(schema.organization).values([
      { id: ids.oemA, name: `Audit-OEM A ${run}` },
      { id: ids.oemB, name: `Audit-OEM B ${run}` },
      { id: ids.supplier, name: `Audit-Lieferant ${run}` },
    ]);
    await insertRelationships(db, [
      { id: ids.relA, buyer: ids.oemA, supplier: ids.supplier },
      { id: ids.relB, buyer: ids.oemB, supplier: ids.supplier },
    ]);
    await db.insert(schema.appUser).values([
      { id: users.a, name: 'Anna A', email: 'a@example.com', organizationId: ids.oemA },
      { id: users.b, name: 'Bea B', email: 'b@example.com', organizationId: ids.oemB },
    ]);
    const event = (org: string, relationship: string, name: string, at: string, to: string) => ({
      occurredAt: new Date(at),
      actorUserId: `nutzer-${run}`,
      actorName: name,
      ownerOrgId: org,
      visibility: 'shared' as const,
      relationshipId: relationship,
      objectType: 'probe',
      objectId,
      action: 'updated' as const,
      changes: { status: { from: 'draft', to } },
    });
    await db
      .insert(schema.auditEvent)
      .values([
        event(ids.oemA, ids.relA, 'Anna A', '2026-11-01T09:00:00Z', 'active'),
        event(ids.oemA, ids.relA, 'Anna A', '2026-11-01T10:00:00Z', 'ended'),
        event(ids.oemB, ids.relB, 'Bea B', '2026-11-01T11:00:00Z', 'active'),
      ]);
  });

  afterAll(async () => {
    // Der Verlauf selbst bleibt: Niemand kann ihn löschen, auch der Test nicht.
    await db.delete(schema.appUser).where(sql`${schema.appUser.id} in ${Object.values(users)}`);
    await deleteRelationships(db, [ids.oemA, ids.oemB]);
    await db
      .delete(schema.organization)
      .where(sql`${schema.organization.id} in ${Object.values(ids).slice(0, 3)}`);
    await testApp.close();
  });

  it('liefert den Verlauf neueste zuerst, mit Name, Organisation, Aktion und Änderungen', async () => {
    const res = await history(users.a);
    expect(res.status).toBe(200);
    const { entries } = auditResponseSchema.parse(await res.json());
    expect(entries.map(({ id: _, ...entry }) => entry)).toEqual([
      {
        occurredAt: '2026-11-01T10:00:00.000Z',
        actorName: 'Anna A',
        organization: `Audit-OEM A ${run}`,
        action: 'updated',
        changes: { status: { from: 'draft', to: 'ended' } },
      },
      {
        occurredAt: '2026-11-01T09:00:00.000Z',
        actorName: 'Anna A',
        organization: `Audit-OEM A ${run}`,
        action: 'updated',
        changes: { status: { from: 'draft', to: 'active' } },
      },
    ]);
  });

  it('Ein Nutzer des Zweit-OEM sieht keinen Verlaufseintrag des Test-OEM', async () => {
    const { entries } = auditResponseSchema.parse(await (await history(users.b)).json());
    expect(entries.map((entry) => entry.organization)).toEqual([`Audit-OEM B ${run}`]);
    expect(JSON.stringify(entries)).not.toContain('Anna A');
  });

  it('lehnt Objekttypen ohne Verlauf und unvollständige Anfragen ab', async () => {
    expect((await history(users.a, `object_type=gibt_es_nicht&object_id=${objectId}`)).status).toBe(
      400,
    );
    expect((await history(users.a, 'object_type=probe')).status).toBe(400);
  });

  it('antwortet ohne Login mit 401', async () => {
    expect((await testApp.get(`/api/audit?object_type=probe&object_id=${objectId}`)).status).toBe(
      401,
    );
  });

  it('Ein geteilter Verlaufseintrag enthält keine Felder aus privaten Tabellen: kein geteiltes Objekt im Register nennt ein privates Feld', async () => {
    const columns = await privateColumns(db);
    expect(columns.size).toBeGreaterThan(0);
    const leaks = auditedObjects
      .filter((object) => object.visibility === 'shared')
      .flatMap((object) =>
        object.fields
          .filter((field) => columns.has(field))
          .map((field) => `${object.type}.${field}`),
      );
    expect(leaks).toEqual([]);
  });
});
