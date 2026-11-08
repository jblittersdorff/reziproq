import { randomUUID } from 'node:crypto';
import { type Database, schema, sql } from '@reziproq/db';
import { meetingDetailSchema, meetingListSchema } from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';

// Tests zu docs/specs/QBR-01.md, Teil a: Termine mit Agenda, Teilnehmenden, Protokoll und
// Beschlüssen, auf beiden Seiten. Jede Seite ändert nur ihre eigenen Zeilen.
describe('QBR-01a Termine über die API', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const run = randomUUID().slice(0, 8);
  const orgs = { oem: randomUUID(), supplier: randomUUID(), other: randomUUID() };
  const rel = randomUUID();
  const users = {
    sro: `qbr-sro-${run}`,
    outside: `qbr-outside-${run}`,
    viewer: `qbr-viewer-${run}`,
    kam: `qbr-kam-${run}`,
    stranger: `qbr-stranger-${run}`,
  };
  const buyer = `/suppliers/${rel}/termine`;
  const supplier = `/kunden/${rel}/termine`;
  let meetingId = '';

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
  const detail = async (user: string, base: string) =>
    meetingDetailSchema.parse((await call(user, 'GET', `${base}/${meetingId}`)).body);

  beforeAll(async () => {
    testApp = await startTestApp();
    db = testApp.adminDb;
    await db.insert(schema.organization).values([
      { id: orgs.oem, name: `QBR-OEM ${run}` },
      { id: orgs.supplier, name: `QBR-Lieferant ${run}` },
      { id: orgs.other, name: `QBR-Fremd ${run}` },
    ]);
    await db
      .insert(schema.organizationFeature)
      .values({ organizationId: orgs.oem, feature: 'buyer' });
    const person = (id: string, orgRole: 'admin' | 'member', organizationId: string) => ({
      id,
      name: id === users.sro ? 'Sara Ost' : id === users.kam ? 'Kim Kaiser' : id,
      email: `${id}@example.com`,
      organizationId,
      orgRole,
      rolesImportedAt: new Date(),
    });
    await db
      .insert(schema.appUser)
      .values([
        person(users.sro, 'member', orgs.oem),
        person(users.outside, 'member', orgs.oem),
        person(users.viewer, 'member', orgs.oem),
        person(users.kam, 'admin', orgs.supplier),
        person(users.stranger, 'admin', orgs.other),
      ]);
    await insertRelationships(db, [{ id: rel, buyer: orgs.oem, supplier: orgs.supplier }]);
    await db.insert(schema.relationshipMember).values([
      { relationshipId: rel, orgId: orgs.oem, userId: users.sro, teamRole: 'sro' },
      { relationshipId: rel, orgId: orgs.oem, userId: users.viewer, teamRole: 'viewer' },
    ]);
  });

  afterAll(async () => {
    await db.execute(sql`delete from meeting_note where relationship_id = ${rel}`);
    await db.execute(sql`delete from meeting_decision where relationship_id = ${rel}`);
    await db.execute(sql`delete from meeting_agenda_item where relationship_id = ${rel}`);
    await db.execute(sql`delete from meeting_participant where relationship_id = ${rel}`);
    await db.execute(sql`delete from meeting where relationship_id = ${rel}`);
    await deleteRelationships(db, Object.values(orgs));
    await db.execute(sql`delete from app_user where organization_id in ${Object.values(orgs)}`);
    await db.execute(sql`delete from organization_feature where organization_id = ${orgs.oem}`);
    await db.execute(sql`delete from organization where id in ${Object.values(orgs)}`);
    await testApp.close();
  });

  it('der SRO legt einen Termin an; die Agenda kommt aus der Vorlage der Art', async () => {
    const { status, body } = await call(users.sro, 'POST', buyer, {
      type: 'quarterly_review',
      ruleSetItemId: null,
      title: 'Quartalsreview Q1',
      startsAt: '2099-03-15T09:00:00Z',
      location: 'Werk Nord',
      participants: ['Sara Ost', 'Tom Krüger'],
      locale: 'de',
    });
    expect(status).toBe(201);
    const created = meetingDetailSchema.parse(body);
    meetingId = created.meeting.id;
    expect(created.meeting).toMatchObject({
      ownerSide: 'buyer',
      status: 'planned',
      createdByName: 'Sara Ost',
    });
    expect(created.agenda.map((item) => item.title)).toEqual([
      'Rückblick auf das Quartal',
      'Kennzahlen und Scorecard',
      'Offene Maßnahmen',
      'Ausblick und nächste Schritte',
    ]);
    expect(created.participants.map((entry) => entry.name)).toEqual(['Sara Ost', 'Tom Krüger']);
    expect(created).toMatchObject({ canEditMeeting: true, canContribute: true });
  });

  it('beide Seiten sehen den Termin unter den kommenden', async () => {
    const own = meetingListSchema.parse((await call(users.sro, 'GET', buyer)).body);
    const theirs = meetingListSchema.parse((await call(users.kam, 'GET', supplier)).body);
    expect(own.upcoming.map((meeting) => meeting.id)).toEqual([meetingId]);
    expect(theirs.upcoming).toEqual([
      expect.objectContaining({ id: meetingId, ownerSide: 'buyer' }),
    ]);
    expect(theirs.canCreate).toBe(true);
  });

  it('der Lieferant schlägt eigene Agendapunkte vor, ändert aber den Termin des Käufers nicht', async () => {
    const proposed = meetingDetailSchema.parse(
      (
        await call(users.kam, 'PUT', `${supplier}/${meetingId}/agenda`, {
          items: ['Neue Kapazitäten 2027'],
        })
      ).body,
    );
    expect(proposed.agenda.at(-1)).toMatchObject({
      title: 'Neue Kapazitäten 2027',
      side: 'supplier',
      own: true,
    });
    expect(proposed.agenda.filter((item) => item.side === 'buyer')).toHaveLength(4);
    expect(proposed.canEditMeeting).toBe(false);
    const update = await call(users.kam, 'PUT', `${supplier}/${meetingId}`, {
      title: 'Geändert',
      startsAt: '2099-03-15T09:00:00Z',
      location: null,
      participants: [],
    });
    expect(update.status).toBe(403);
  });

  it('Protokoll schreibt die Seite, die den Termin angelegt hat; Beschlüsse jede Seite für sich', async () => {
    const asBuyer = meetingDetailSchema.parse(
      (
        await call(users.sro, 'PUT', `${buyer}/${meetingId}/protokoll`, {
          protocol: 'Liefertreue im Quartal bei 97 %.',
          decisions: ['Kapazitätsplanung bis Ende April abstimmen'],
        })
      ).body,
    );
    expect(asBuyer.meeting.protocol).toBe('Liefertreue im Quartal bei 97 %.');
    const supplierProtocol = await call(users.kam, 'PUT', `${supplier}/${meetingId}/protokoll`, {
      protocol: 'Anderes Protokoll',
      decisions: [],
    });
    expect(supplierProtocol.status).toBe(403);
    const asSupplier = meetingDetailSchema.parse(
      (
        await call(users.kam, 'PUT', `${supplier}/${meetingId}/protokoll`, {
          protocol: null,
          decisions: ['Angebot für Zusatzschicht bis 15. April'],
        })
      ).body,
    );
    expect(asSupplier.meeting.protocol).toBe('Liefertreue im Quartal bei 97 %.');
    expect(asSupplier.decisions.map((entry) => [entry.side, entry.text])).toEqual([
      ['buyer', 'Kapazitätsplanung bis Ende April abstimmen'],
      ['supplier', 'Angebot für Zusatzschicht bis 15. April'],
    ]);
  });

  it('ein Termin lässt sich ohne andere Werkzeuge vorbereiten und protokollieren', async () => {
    const updated = meetingDetailSchema.parse(
      (
        await call(users.sro, 'PUT', `${buyer}/${meetingId}`, {
          title: 'Quartalsreview Q1 2099',
          startsAt: '2099-03-16T10:00:00Z',
          location: 'https://meet.example/q1',
          participants: ['Sara Ost'],
        })
      ).body,
    );
    expect(updated.meeting).toMatchObject({
      title: 'Quartalsreview Q1 2099',
      location: 'https://meet.example/q1',
    });
    expect(updated.participants.map((entry) => entry.name)).toEqual(['Sara Ost']);
    const seen = await detail(users.kam, supplier);
    expect(seen.meeting.title).toBe('Quartalsreview Q1 2099');
    expect(seen.agenda.length).toBe(5);
    expect(seen.decisions.length).toBe(2);
  });

  it('interne Notizen sieht die andere Seite nie', async () => {
    await call(users.sro, 'PUT', `${buyer}/${meetingId}/notiz`, {
      text: 'Preisdruck ansprechen, intern.',
    });
    await call(users.kam, 'PUT', `${supplier}/${meetingId}/notiz`, {
      text: 'Kapazität ist knapp, intern.',
    });
    expect((await detail(users.sro, buyer)).note).toBe('Preisdruck ansprechen, intern.');
    expect((await detail(users.kam, supplier)).note).toBe('Kapazität ist knapp, intern.');
    const supplierText = JSON.stringify(
      (await call(users.kam, 'GET', `${supplier}/${meetingId}`)).body,
    );
    expect(supplierText).not.toContain('Preisdruck');
    const buyerText = JSON.stringify((await call(users.sro, 'GET', `${buyer}/${meetingId}`)).body);
    expect(buyerText).not.toContain('Kapazität ist knapp');
  });

  it('außerhalb des Teams oder mit Teamrolle Leser nur sehen; Fremde gar nichts', async () => {
    const outside = await detail(users.outside, buyer);
    expect(outside).toMatchObject({ canEditMeeting: false, canContribute: false });
    expect(
      (await call(users.outside, 'PUT', `${buyer}/${meetingId}/agenda`, { items: [] })).status,
    ).toBe(403);
    expect(
      (await call(users.viewer, 'PUT', `${buyer}/${meetingId}/notiz`, { text: 'x' })).status,
    ).toBe(403);
    expect((await call(users.stranger, 'GET', supplier)).status).toBe(404);
  });

  it('ein Format muss aus den Spielregeln dieser Beziehung stammen', async () => {
    const { status } = await call(users.sro, 'POST', buyer, {
      type: 'format',
      ruleSetItemId: randomUUID(),
      title: 'Innovationstag',
      startsAt: '2099-05-01T09:00:00Z',
      location: null,
      participants: [],
      locale: 'de',
    });
    expect(status).toBe(400);
  });

  it('ein abgeschlossener Termin ist gesperrt, auch für die andere Seite (Grundlage für QBR-01b)', async () => {
    await db.execute(sql`update meeting set status = 'closed' where id = ${meetingId}`);
    const closed = await detail(users.kam, supplier);
    expect(closed).toMatchObject({ canEditMeeting: false, canContribute: false });
    expect(
      (await call(users.kam, 'PUT', `${supplier}/${meetingId}/agenda`, { items: ['Neu'] })).status,
    ).toBe(409);
    expect(
      (
        await call(users.sro, 'PUT', `${buyer}/${meetingId}/protokoll`, {
          protocol: 'x',
          decisions: [],
        })
      ).status,
    ).toBe(409);
    // Auch direkt in der Datenbank lässt sich nichts mehr ändern.
    await expect(
      db.execute(sql`update meeting_decision set text = 'x' where meeting_id = ${meetingId}`),
    ).rejects.toThrow();
    await db.execute(sql`alter table meeting disable trigger meeting_closed_unchanged`);
    await db.execute(sql`update meeting set status = 'planned' where id = ${meetingId}`);
    await db.execute(sql`alter table meeting enable trigger meeting_closed_unchanged`);
  });
});
