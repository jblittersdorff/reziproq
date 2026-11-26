import { randomUUID } from 'node:crypto';
import { type Database, schema, sql } from '@reziproq/db';
import {
  actionItemSchema,
  actionListSchema,
  auditResponseSchema,
  meetingDetailSchema,
  myActionsSchema,
  startSchema,
  supplierOverviewSchema,
} from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';

// Tests zu docs/specs/QBR-03.md: Maßnahmen beider Seiten mit genau einer Quelle, Status über die
// Seiten hinweg, interne bleiben intern, Start und /start/massnahmen, Verlauf. Seit ZQ-01 (K2-a.3)
// sind geteilte Maßnahmen Zusagen (Status offen, gehalten mit Beleg, verfehlt, zurückgezogen) und
// interne Aufgaben; die Schnittstelle der Maßnahmen bedient beide bis zur Akte (K2-c).
describe('QBR-03 Maßnahmen über die API', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const run = randomUUID().slice(0, 8);
  const orgs = { oem: randomUUID(), supplier: randomUUID() };
  const rel = randomUUID();
  const users = {
    sro: `qbr3-sro-${run}`,
    viewer: `qbr3-viewer-${run}`,
    kam: `qbr3-kam-${run}`,
  };
  const buyer = `/suppliers/${rel}/massnahmen`;
  const supplier = `/kunden/${rel}/massnahmen`;
  let meetingId = '';
  let shared = '';
  let internal = '';

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
  const list = async (user: string, base: string) =>
    actionListSchema.parse((await call(user, 'GET', base)).body);
  const action = (overrides: Record<string, unknown> = {}) => ({
    title: 'Zweitquelle Gehäuse',
    description: null,
    visibility: 'shared',
    ownerSide: 'buyer',
    ownerUserId: users.sro,
    ownerName: null,
    dueDate: '2020-01-31',
    ...overrides,
  });

  beforeAll(async () => {
    testApp = await startTestApp();
    db = testApp.adminDb;
    await db.insert(schema.organization).values([
      { id: orgs.oem, name: `QBR3-OEM ${run}` },
      { id: orgs.supplier, name: `QBR3-Lieferant ${run}` },
    ]);
    await db
      .insert(schema.organizationFeature)
      .values({ organizationId: orgs.oem, feature: 'buyer' });
    const person = (
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
        person(users.sro, 'Sara Ost', orgs.oem, 'member'),
        person(users.viewer, 'Vera Lese', orgs.oem, 'member'),
        person(users.kam, 'Kim Kaiser', orgs.supplier, 'admin'),
      ]);
    await insertRelationships(db, [{ id: rel, buyer: orgs.oem, supplier: orgs.supplier }]);
    await db.insert(schema.relationshipMember).values([
      { relationshipId: rel, orgId: orgs.oem, userId: users.sro, teamRole: 'sro' },
      { relationshipId: rel, orgId: orgs.oem, userId: users.viewer, teamRole: 'viewer' },
      { relationshipId: rel, orgId: orgs.supplier, userId: users.kam, teamRole: 'sro' },
    ]);
    const created = await call(users.sro, 'POST', `/suppliers/${rel}/termine`, {
      type: 'quarterly_review',
      ruleSetItemId: null,
      title: 'Quartalsreview Q1',
      startsAt: '2099-03-15T09:00:00Z',
      location: null,
      participants: [],
      locale: 'de',
    });
    meetingId = meetingDetailSchema.parse(created.body).meeting.id;
  });

  afterAll(async () => {
    await db.execute(sql`delete from commitment_private_source where relationship_id = ${rel}`);
    await db.execute(sql`delete from commitment where relationship_id = ${rel}`);
    await db.execute(sql`delete from task where relationship_id = ${rel}`);
    await db.execute(sql`delete from meeting where relationship_id = ${rel}`);
    await deleteRelationships(db, Object.values(orgs));
    await db.execute(sql`delete from app_user where organization_id in ${Object.values(orgs)}`);
    await db.execute(sql`delete from organization_feature where organization_id = ${orgs.oem}`);
    await db.execute(sql`delete from organization where id in ${Object.values(orgs)}`);
    await testApp.close();
  });

  it('der SRO legt eine geteilte Maßnahme aus dem Termin an; sie trägt die Quelle', async () => {
    const { status, body } = await call(users.sro, 'POST', buyer, {
      action: action(),
      sourceType: 'meeting',
      sourceId: meetingId,
    });
    expect(status).toBe(201);
    const created = actionItemSchema.parse(body);
    shared = created.id;
    expect(created).toMatchObject({
      kind: 'commitment',
      sourceType: 'meeting',
      sourceId: meetingId,
      sourceTitle: 'Quartalsreview Q1',
      ownerName: 'Sara Ost',
      side: 'buyer',
      own: true,
      overdue: true,
    });
  });

  it('jede Maßnahme hat genau eine Quelle', async () => {
    const both = await call(users.sro, 'POST', buyer, {
      action: action(),
      sourceType: 'manual',
      sourceId: meetingId,
    });
    expect(both.status).toBe(400);
    const none = await call(users.sro, 'POST', buyer, {
      action: action(),
      sourceType: 'meeting',
      sourceId: null,
    });
    expect(none.status).toBe(400);
    // Auch die Datenbank lässt keine Aufgabe ohne oder mit zwei Quellen zu.
    await expect(
      db.execute(sql`
        insert into task (relationship_id, org_id, title, owner_name, due_date, source_type,
          source_id, created_by, created_by_name)
        values (${rel}, ${orgs.oem}, 'x', 'x', '2099-01-01', 'manual', ${meetingId}, 'x', 'x')
      `),
    ).rejects.toMatchObject({ cause: { constraint: 'task_one_source' } });
  });

  it('interne Maßnahmen sieht die andere Seite nie', async () => {
    const { body } = await call(users.sro, 'POST', buyer, {
      action: action({ title: 'Preisspielraum klären', visibility: 'internal' }),
      sourceType: 'manual',
      sourceId: null,
    });
    const created = actionItemSchema.parse(body);
    internal = created.id;
    expect(created.kind).toBe('task');
    const own = await list(users.sro, buyer);
    expect(own.actions.map((entry) => entry.id).sort()).toEqual([shared, internal].sort());
    const theirs = await list(users.kam, supplier);
    expect(theirs.actions.map((entry) => entry.id)).toEqual([shared]);
    expect((await call(users.kam, 'GET', `${supplier}/${internal}`)).status).toBe(404);
  });

  it('der Lieferant ändert den Status der geteilten Zusage, aber nicht ihren Inhalt', async () => {
    const theirs = await list(users.kam, supplier);
    expect(theirs.actions[0]).toMatchObject({ own: false, canEdit: false, canChangeStatus: true });
    // „In Arbeit“ gibt es nur bei Aufgaben; gehalten nur mit Beleg (ZQ-01 Regel 2)
    expect(
      (await call(users.kam, 'PUT', `${supplier}/${shared}/status`, { status: 'in_progress' }))
        .status,
    ).toBe(400);
    expect(
      await call(users.kam, 'PUT', `${supplier}/${shared}/status`, { status: 'kept' }),
    ).toMatchObject({ status: 422, body: { code: 'beleg_fehlt' } });
    const changed = await call(users.kam, 'PUT', `${supplier}/${shared}/status`, {
      status: 'kept',
      evidence: { kind: 'confirmation', note: 'Muster freigegeben' },
    });
    expect(changed.status).toBe(200);
    expect(actionItemSchema.parse(changed.body)).toMatchObject({
      status: 'kept',
      evidence: { kind: 'confirmation', note: 'Muster freigegeben' },
    });
    // Der SRO öffnet sie wieder; die folgenden Fälle brauchen sie offen
    const reopened = await call(users.sro, 'PUT', `${buyer}/${shared}/status`, { status: 'open' });
    expect(actionItemSchema.parse(reopened.body).status).toBe('open');
    const edit = await call(users.kam, 'PUT', `${supplier}/${shared}`, action({ title: 'Anders' }));
    expect(edit.status).toBe(403);
    // Die Leserin im Team sieht, ändert aber nichts.
    expect((await list(users.viewer, buyer)).canCreate).toBe(false);
    const viewer = await call(users.viewer, 'PUT', `${buyer}/${shared}/status`, {
      status: 'missed',
    });
    expect(viewer.status).toBe(403);
  });

  it('der Lieferant legt eigene Maßnahmen an und nennt eine Person beim Käufer', async () => {
    const { status, body } = await call(users.kam, 'POST', supplier, {
      action: action({
        title: 'Kapazitätsplan teilen',
        ownerSide: 'buyer',
        ownerUserId: null,
        ownerName: 'Sara Ost',
        dueDate: '2099-02-01',
      }),
      sourceType: 'manual',
      sourceId: null,
    });
    expect(status).toBe(201);
    expect(actionItemSchema.parse(body)).toMatchObject({
      side: 'supplier',
      own: true,
      overdue: false,
    });
  });

  it('überfällige Maßnahmen sind markiert und stehen auf Start der verantwortlichen Person', async () => {
    const start = startSchema.parse((await call(users.sro, 'GET', '/start')).body);
    // Aufgaben kommen als action, Zusagen als commitment (ohne Plan mit Link auf die Maßnahmen)
    const due = start.due.items.filter(
      (item) => item.kind === 'action' || item.kind === 'commitment',
    );
    expect(due.map((item) => item.detail).sort()).toEqual(
      ['Preisspielraum klären', 'Zweitquelle Gehäuse'].sort(),
    );
    expect(due[0]?.href).toMatch(new RegExp(`^/lieferanten/${rel}/umsetzung/massnahmen#`));
    const overview = supplierOverviewSchema.parse(
      (await call(users.sro, 'GET', `/suppliers/${rel}/overview`)).body,
    );
    expect(overview.metrics).toContainEqual({
      tile: 'execution',
      kind: 'actions',
      open: 3,
      overdue: 2,
    });
  });

  it('der SRO sieht auf /start/massnahmen alle offenen Maßnahmen seiner Beziehungen', async () => {
    const mine = myActionsSchema.parse((await call(users.sro, 'GET', '/start/massnahmen')).body);
    expect(mine.items.map((item) => item.title).sort()).toEqual(
      ['Kapazitätsplan teilen', 'Preisspielraum klären', 'Zweitquelle Gehäuse'].sort(),
    );
    expect(mine.items[0]).toMatchObject({ counterpart: `QBR3-Lieferant ${run}` });
    // Der Lieferant sieht seine Kunden, ohne die internen des Käufers.
    const theirs = myActionsSchema.parse((await call(users.kam, 'GET', '/start/massnahmen')).body);
    expect(theirs.items.map((item) => item.title).sort()).toEqual(
      ['Kapazitätsplan teilen', 'Zweitquelle Gehäuse'].sort(),
    );
  });

  it('der Termin zeigt die offenen Maßnahmen als Live-Abschnitt', async () => {
    const meeting = meetingDetailSchema.parse(
      (await call(users.kam, 'GET', `/kunden/${rel}/termine/${meetingId}`)).body,
    );
    const section = meeting.live.sections.find((entry) => entry.key === 'actions');
    expect(section?.items.map((item) => item.title).sort()).toEqual(
      ['Kapazitätsplan teilen', 'Zweitquelle Gehäuse'].sort(),
    );
    expect(section?.items.find((item) => item.title === 'Zweitquelle Gehäuse')).toMatchObject({
      status: 'open',
      dueDate: '2020-01-31',
    });
  });

  it('Änderungen geteilter Zusagen stehen im Verlauf, beide Seiten sehen ihn', async () => {
    await call(users.sro, 'PUT', `${buyer}/${shared}/status`, {
      status: 'kept',
      evidence: { kind: 'goods_receipt' },
    });
    const history = auditResponseSchema.parse(
      (await call(users.sro, 'GET', `/audit?object_type=commitment&object_id=${shared}`)).body,
    );
    expect(history.entries.map((entry) => entry.action)).toEqual([
      'updated',
      'updated',
      'updated',
      'created',
    ]);
    expect(history.entries[2]?.changes.status).toEqual({ from: 'open', to: 'kept' });
    expect(history.entries[2]?.organization).toBe(`QBR3-Lieferant ${run}`);
    // Erledigt verschwindet von Start.
    const start = startSchema.parse((await call(users.sro, 'GET', '/start')).body);
    expect(start.due.items.map((item) => item.detail)).not.toContain('Zweitquelle Gehäuse');
  });

  it('ZQ-01: Aufgaben nur für die eigene Seite, Art und Sichtbarkeit fest, Status je Art', async () => {
    const forSupplier = await call(users.sro, 'POST', buyer, {
      action: action({
        title: 'Für den Lieferanten',
        visibility: 'internal',
        ownerSide: 'supplier',
        ownerUserId: null,
        ownerName: 'Kim Kaiser',
      }),
      sourceType: 'manual',
      sourceId: null,
    });
    expect(forSupplier).toMatchObject({ status: 400, body: { code: 'aufgabe_eigene_seite' } });
    // Eine Aufgabe wird beim Bearbeiten keine Zusage, eine geteilte Zusage nicht wieder intern
    const shareTask = await call(
      users.sro,
      'PUT',
      `${buyer}/${internal}`,
      action({ title: 'Preisspielraum klären', visibility: 'shared' }),
    );
    expect(shareTask).toMatchObject({ status: 400, body: { code: 'art_fest' } });
    const hide = await call(
      users.sro,
      'PUT',
      `${buyer}/${shared}`,
      action({ visibility: 'internal' }),
    );
    expect(hide).toMatchObject({ status: 400, body: { code: 'art_fest' } });
    // Gehalten gibt es nur bei Zusagen, erledigt nur bei Aufgaben
    const keptTask = await call(users.sro, 'PUT', `${buyer}/${internal}/status`, {
      status: 'kept',
      evidence: { kind: 'document' },
    });
    expect(keptTask).toMatchObject({ status: 400, body: { code: 'status_unpassend' } });
    const doneCommitment = await call(users.sro, 'PUT', `${buyer}/${shared}/status`, {
      status: 'done',
    });
    expect(doneCommitment).toMatchObject({ status: 400, body: { code: 'status_unpassend' } });
    const doneTask = await call(users.sro, 'PUT', `${buyer}/${internal}/status`, {
      status: 'done',
    });
    expect(actionItemSchema.parse(doneTask.body)).toMatchObject({ kind: 'task', status: 'done' });

    // Eine interne Zusage aus dem Termin bleibt bearbeitbar und intern
    const [note] = await db
      .insert(schema.commitment)
      .values({
        relationshipId: rel,
        ownerOrgId: orgs.oem,
        visibility: 'internal',
        side: 'supplier',
        title: 'Muster bis März',
        ownerName: 'Kim Kaiser',
        dueOn: '2099-03-31',
        sourceType: 'meeting',
        sourceRef: meetingId,
        createdBy: users.sro,
        createdByName: 'Sara Ost',
      })
      .returning({ id: schema.commitment.id });
    const noteId = note?.id as string;
    const supplierNote = (overrides: Record<string, unknown>) =>
      action({
        visibility: 'internal',
        ownerSide: 'supplier',
        ownerUserId: null,
        ownerName: 'Kim Kaiser',
        ...overrides,
      });
    const edited = await call(
      users.sro,
      'PUT',
      `${buyer}/${noteId}`,
      supplierNote({ title: 'Muster bis April', dueDate: '2099-04-30' }),
    );
    expect(edited.status).toBe(200);
    expect(actionItemSchema.parse(edited.body)).toMatchObject({
      kind: 'commitment',
      visibility: 'internal',
      title: 'Muster bis April',
      dueDate: '2099-04-30',
    });
    const shareNote = await call(
      users.sro,
      'PUT',
      `${buyer}/${noteId}`,
      supplierNote({ visibility: 'shared' }),
    );
    expect(shareNote).toMatchObject({ status: 400, body: { code: 'art_fest' } });
    expect((await call(users.kam, 'GET', `${supplier}/${noteId}`)).status).toBe(404);
  });
});
