import { randomUUID } from 'node:crypto';
import { type Database, schema, sql } from '@reziproq/db';
import {
  customerListSchema,
  customerWorkspaceSchema,
  meetingDetailSchema,
  startSchema,
  supplierOverviewSchema,
} from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';
import { MEETING_LIVE_SOURCES, type MeetingLiveSource } from './live-sections.js';

// Tests zu docs/specs/QBR-01.md, Teil b: Live-Abschnitte, Abschließen mit eingefrorenem Stand und
// die Termin-Quelle für Start, den Kopf des Lieferanten und die Kunden des Lieferanten.
describe('QBR-01b Termine abschließen und Termin-Quelle', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const run = randomUUID().slice(0, 8);
  const orgs = { oem: randomUUID(), supplier: randomUUID() };
  const rel = randomUUID();
  const users = { sro: `qbr-b-sro-${run}`, kam: `qbr-b-kam-${run}` };
  const buyer = `/suppliers/${rel}/termine`;
  const supplier = `/kunden/${rel}/termine`;
  let meetingId = '';
  let later = '';

  // Eine Live-Quelle für den Test, wie später die Maßnahmen (QBR-03): liest bei jedem Aufruf neu.
  const live = { status: 'offen' };
  const testSource: MeetingLiveSource = {
    key: 'actions',
    read: async () => ({
      key: 'actions',
      items: [{ id: 'a1', title: 'Zweitquelle Gehäuse', status: live.status }],
    }),
  };

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
  const detail = async (user: string, base: string, id = meetingId) =>
    meetingDetailSchema.parse((await call(user, 'GET', `${base}/${id}`)).body);
  const create = async (title: string, startsAt: string) => {
    const { status, body } = await call(users.sro, 'POST', buyer, {
      type: 'quarterly_review',
      ruleSetItemId: null,
      title,
      startsAt,
      location: 'Werk Nord',
      participants: [],
      locale: 'de',
    });
    expect(status).toBe(201);
    return meetingDetailSchema.parse(body).meeting.id;
  };

  beforeAll(async () => {
    testApp = await startTestApp({
      configure: (builder) => builder.overrideProvider(MEETING_LIVE_SOURCES).useValue([testSource]),
    });
    db = testApp.adminDb;
    await db.insert(schema.organization).values([
      { id: orgs.oem, name: `QBRb-OEM ${run}` },
      { id: orgs.supplier, name: `QBRb-Lieferant ${run}` },
    ]);
    await db
      .insert(schema.organizationFeature)
      .values({ organizationId: orgs.oem, feature: 'buyer' });
    await db.insert(schema.appUser).values([
      {
        id: users.sro,
        name: 'Sara Ost',
        email: `${users.sro}@example.com`,
        organizationId: orgs.oem,
        orgRole: 'member',
        rolesImportedAt: new Date(),
      },
      {
        id: users.kam,
        name: 'Kim Kaiser',
        email: `${users.kam}@example.com`,
        organizationId: orgs.supplier,
        orgRole: 'admin',
        rolesImportedAt: new Date(),
      },
    ]);
    await insertRelationships(db, [{ id: rel, buyer: orgs.oem, supplier: orgs.supplier }]);
    await db
      .insert(schema.relationshipMember)
      .values({ relationshipId: rel, orgId: orgs.oem, userId: users.sro, teamRole: 'sro' });
    later = await create('Strategiedialog', '2099-06-01T09:00:00Z');
    meetingId = await create('Quartalsreview Q1', '2099-03-15T09:00:00Z');
  });

  afterAll(async () => {
    await db.execute(sql`delete from meeting_note where relationship_id = ${rel}`);
    // Löscht Teilnehmende, Agenda, Beschlüsse und den eingefrorenen Stand mit (Kaskade).
    await db.execute(sql`delete from meeting where relationship_id = ${rel}`);
    await deleteRelationships(db, Object.values(orgs));
    await db.execute(sql`delete from app_user where organization_id in ${Object.values(orgs)}`);
    await db.execute(sql`delete from organization_feature where organization_id = ${orgs.oem}`);
    await db.execute(sql`delete from organization where id in ${Object.values(orgs)}`);
    await testApp.close();
  });

  it('der nächste Termin steht im Kopf des Lieferanten, auf Start beider Seiten und beim Kunden', async () => {
    const overview = supplierOverviewSchema.parse(
      (await call(users.sro, 'GET', `/suppliers/${rel}/overview`)).body,
    );
    expect(overview.head.nextMeeting).toEqual({ date: '2099-03-15' });

    const buyerStart = startSchema.parse((await call(users.sro, 'GET', '/start')).body);
    expect(buyerStart.nextMeeting).toMatchObject({
      id: meetingId,
      relationshipId: rel,
      title: 'Quartalsreview Q1',
      counterpart: `QBRb-Lieferant ${run}`,
    });

    const supplierStart = startSchema.parse((await call(users.kam, 'GET', '/start')).body);
    expect(supplierStart.nextMeeting).toMatchObject({
      id: meetingId,
      counterpart: `QBRb-OEM ${run}`,
    });
    const cards = customerListSchema.parse((await call(users.kam, 'GET', '/kunden')).body);
    expect(cards.customers.find((card) => card.relationshipId === rel)?.nextMeeting).toBe(
      '2099-03-15',
    );
    const workspace = customerWorkspaceSchema.parse(
      (await call(users.kam, 'GET', `/kunden/${rel}`)).body,
    );
    expect(workspace.nextMeeting).toBe('2099-03-15');
  });

  it('die Live-Abschnitte zeigen den aktuellen Stand aus ihrem Ort, auf beiden Seiten', async () => {
    expect((await detail(users.sro, buyer)).live).toEqual({
      sections: [
        { key: 'actions', items: [{ id: 'a1', title: 'Zweitquelle Gehäuse', status: 'offen' }] },
      ],
      frozenAt: null,
    });
    live.status = 'erledigt';
    const theirs = await detail(users.kam, supplier);
    expect(theirs.live.sections[0]?.items[0]?.status).toBe('erledigt');
    // Abschließen darf nur die Seite, die den Termin angelegt hat.
    expect(theirs.canClose).toBe(false);
    expect((await detail(users.sro, buyer)).canClose).toBe(true);
  });

  it('nur die Seite, die den Termin angelegt hat, schließt ihn ab', async () => {
    const { status } = await call(users.kam, 'POST', `${supplier}/${meetingId}/abschliessen`);
    expect(status).toBe(403);
  });

  it('nach dem Abschließen sind Protokoll und Beschlüsse gesperrt, und der eingefrorene Stand ändert sich nicht mehr', async () => {
    const { status, body } = await call(users.sro, 'POST', `${buyer}/${meetingId}/abschliessen`);
    expect(status).toBe(201);
    const closed = meetingDetailSchema.parse(body);
    expect(closed.meeting.status).toBe('closed');
    expect(closed.live.frozenAt).not.toBeNull();
    expect(closed).toMatchObject({ canClose: false, canEditMeeting: false, canContribute: false });

    // Der Ort ändert sich, der eingefrorene Stand nicht.
    live.status = 'wieder offen';
    const later = await detail(users.kam, supplier);
    expect(later.live.sections[0]?.items[0]?.status).toBe('erledigt');
    expect(later.live.frozenAt).toBe(closed.live.frozenAt);

    // Protokoll und Beschlüsse sind gesperrt, ein zweites Abschließen auch.
    const protocol = await call(users.sro, 'PUT', `${buyer}/${meetingId}/protokoll`, {
      protocol: 'Nachträglich',
      decisions: [],
    });
    expect(protocol.status).toBe(409);
    const again = await call(users.sro, 'POST', `${buyer}/${meetingId}/abschliessen`);
    expect(again.status).toBe(409);
  });

  it('auch die Datenbank lässt den eingefrorenen Stand nicht ändern oder löschen', async () => {
    const [frozen] = await db
      .select({ id: schema.meetingSnapshot.id })
      .from(schema.meetingSnapshot)
      .where(sql`${schema.meetingSnapshot.meetingId} = ${meetingId}`);
    expect(frozen).toBeDefined();
    await expect(
      db.execute(sql`update meeting_snapshot set content = '{}' where id = ${frozen?.id}`),
    ).rejects.toMatchObject({ cause: { message: 'meeting_snapshot_frozen' } });
    await expect(
      db.execute(sql`delete from meeting_snapshot where id = ${frozen?.id}`),
    ).rejects.toMatchObject({ cause: { message: 'meeting_snapshot_frozen' } });
  });

  it('nach dem Abschließen ist der nächste offene Termin dran', async () => {
    const overview = supplierOverviewSchema.parse(
      (await call(users.sro, 'GET', `/suppliers/${rel}/overview`)).body,
    );
    expect(overview.head.nextMeeting).toEqual({ date: '2099-06-01' });
    const buyerStart = startSchema.parse((await call(users.sro, 'GET', '/start')).body);
    expect(buyerStart.nextMeeting?.id).toBe(later);
  });
});
