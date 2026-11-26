import { randomUUID } from 'node:crypto';
import { type Database, schema, sql } from '@reziproq/db';
import {
  type MyDay,
  myDaySchema,
  type NeedsYou,
  type NextAction,
  type Timeline,
  timelineSchema,
} from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TenantDatabase } from '../../common/database.module.js';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';
import { doneToday, orgModulesOf, timelineItems } from './my-day-data.js';
import { insertWorkItems, type LegacyActionRow } from '../../testing/work-items.js';

// NAV-10 1.1 / UX-20 Phase 2: Mein Tag, Terminschiene, „Als Nächstes“ und „Brauchen dich“.
// Ein Käufer ohne Zugriff auf einen Lieferanten sieht ihn in keiner Zahl, keiner Zeile und keiner
// Karte „Als Nächstes“; jeder Eintrag der Terminschiene öffnet sein Objekt. B-33: „heute“ gilt in
// Berlin, auch kurz nach Mitternacht und auch, wenn die Datenbank-Sitzung in UTC läuft.
describe('UX-20 Phase 2: Mein Tag und Terminschiene über die API', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const run = randomUUID().slice(0, 8);
  const orgs = { oem: randomUUID(), seen: randomUUID(), hidden: randomUUID(), night: randomUUID() };
  const rels = { seen: randomUUID(), hidden: randomUUID(), night: randomUUID() };
  const users = {
    member: `p2-member-${run}`,
    other: `p2-other-${run}`,
    idle: `p2-idle-${run}`,
    supplier: `p2-sup-${run}`,
    night: `p2-night-${run}`,
  };
  // B-33: Demo-Uhr eines eigenen Mandanten auf 00:30 in Berlin am 27.11., in UTC noch der 26.11.
  const nightNow = new Date('2026-11-26T23:30:00.000Z');
  // Tage nach dem Berliner Datum wie Mein Tag (B-33)
  const berlinDay = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' });
  const day = (offset: number) => {
    const date = new Date(`${berlinDay.format(new Date())}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + offset);
    return date.toISOString().slice(0, 10);
  };
  const at = (offset: number) => new Date(`${day(offset)}T09:00:00Z`);

  const get = async <T>(user: string, path: string) => {
    const response = await fetch(`${testApp.baseUrl}/api${path}`, {
      headers: { authorization: `Bearer ${await testApp.signToken({ subject: user })}` },
    });
    return { status: response.status, body: (await response.json()) as T };
  };

  beforeAll(async () => {
    testApp = await startTestApp();
    db = testApp.adminDb;
    await db.insert(schema.organization).values([
      { id: orgs.oem, name: `P2-OEM ${run}` },
      { id: orgs.seen, name: `P2-Sichtbar ${run}` },
      { id: orgs.hidden, name: `P2-Verborgen ${run}` },
      { id: orgs.night, name: `P2-Nacht ${run}`, isDemo: true, demoNow: nightNow },
    ]);
    await db.insert(schema.organizationFeature).values([
      { organizationId: orgs.oem, feature: 'buyer' },
      { organizationId: orgs.night, feature: 'buyer' },
    ]);
    const person = (id: string, organizationId: string) => ({
      id,
      name: `Person ${id}`,
      givenName: 'Pat',
      email: `${id}@example.com`,
      organizationId,
      orgRole: 'member' as const,
      rolesImportedAt: new Date(),
    });
    await db
      .insert(schema.appUser)
      .values([
        person(users.member, orgs.oem),
        person(users.other, orgs.oem),
        person(users.idle, orgs.oem),
        person(users.supplier, orgs.seen),
        person(users.night, orgs.night),
      ]);
    await insertRelationships(db, [
      { id: rels.seen, buyer: orgs.oem, supplier: orgs.seen },
      { id: rels.hidden, buyer: orgs.oem, supplier: orgs.hidden },
      { id: rels.night, buyer: orgs.night, supplier: orgs.seen },
    ]);
    await db.insert(schema.relationshipMember).values([
      { relationshipId: rels.seen, orgId: orgs.oem, userId: users.member, teamRole: 'sro' },
      { relationshipId: rels.hidden, orgId: orgs.oem, userId: users.other, teamRole: 'sro' },
      { relationshipId: rels.night, orgId: orgs.night, userId: users.night, teamRole: 'sro' },
    ]);
    const meeting = (relationshipId: string, title: string, offset: number) => ({
      relationshipId,
      ownerOrgId: orgs.oem,
      visibility: 'shared' as const,
      type: 'quarterly_review' as const,
      title,
      startsAt: at(offset),
      durationMinutes: 60,
      createdBy: users.member,
      createdByName: 'Pat',
    });
    const nightMeeting = (title: string, startsAt: string) => ({
      ...meeting(rels.night, title, 0),
      ownerOrgId: orgs.night,
      createdBy: users.night,
      startsAt: new Date(startsAt),
    });
    await db.insert(schema.meeting).values([
      meeting(rels.seen, `QBR sichtbar ${run}`, 3),
      meeting(rels.hidden, `QBR verborgen ${run}`, 3),
      meeting(rels.seen, `Weit weg ${run}`, 40),
      // B-33: 00:45 in Berlin am 27.11. gehört zu heute, 23:30 am 26.11. nicht
      nightMeeting(`Nacht früh ${run}`, '2026-11-26T23:45:00.000Z'),
      nightMeeting(`Nacht gestern ${run}`, '2026-11-26T22:30:00.000Z'),
    ]);
    const action = (
      relationshipId: string,
      title: string,
      dueDate: string,
      owner: string,
      extra: Partial<LegacyActionRow> = {},
    ) => ({
      relationshipId,
      ownerOrgId: orgs.oem,
      visibility: 'shared' as const,
      title,
      ownerSide: 'buyer' as const,
      ownerUserId: owner,
      ownerName: `Person ${owner}`,
      dueDate,
      sourceType: 'manual' as const,
      createdBy: users.member,
      createdByName: 'Pat',
      ...extra,
    });
    await insertWorkItems(db, [
      action(rels.seen, `Überfällig ${run}`, day(-2), users.member),
      action(rels.seen, `Heute ${run}`, day(0), users.member),
      action(rels.seen, `Wartet ${run}`, day(1), users.other),
      action(rels.hidden, `Verborgen wartet ${run}`, day(1), users.other),
      action(rels.seen, `Erledigt ${run}`, day(0), users.member, {
        status: 'done',
        doneAt: new Date(),
      }),
      // B-33: Maßnahmen des Mandanten mit Demo-Uhr 00:30 in Berlin am 27.11.
      ...[
        action(rels.night, `Nacht überfällig ${run}`, '2026-11-25', users.night),
        action(rels.night, `Nacht heute ${run}`, '2026-11-27', users.night),
        action(rels.night, `Nacht erledigt ${run}`, '2026-11-27', users.night, {
          status: 'done',
          doneAt: new Date('2026-11-26T23:10:00.000Z'),
        }),
        action(rels.night, `Nacht gestern erledigt ${run}`, '2026-11-26', users.night, {
          status: 'done',
          doneAt: new Date('2026-11-26T22:50:00.000Z'),
        }),
      ].map((entry) => ({ ...entry, ownerOrgId: orgs.night, createdBy: users.night })),
    ]);
  });

  afterAll(async () => {
    const ids = Object.values(rels);
    await db.execute(sql`delete from commitment where relationship_id in ${ids}`);
    await db.execute(sql`delete from task where relationship_id in ${ids}`);
    await db.execute(sql`delete from meeting where relationship_id in ${ids}`);
    await deleteRelationships(db, Object.values(orgs));
    await db.execute(sql`delete from app_user where organization_id in ${Object.values(orgs)}`);
    await db.execute(
      sql`delete from organization_feature where organization_id in ${Object.values(orgs)}`,
    );
    await db.execute(sql`delete from organization where id in ${Object.values(orgs)}`);
    await testApp.close();
  });

  it('Terminschiene: nur sichtbare Lieferanten, im Zeitraum, jeder Eintrag öffnet sein Objekt', async () => {
    const { status, body } = await get<Timeline>(users.member, '/start/termine?tage=28');
    expect(status).toBe(200);
    const timeline = timelineSchema.parse(body);
    const mine = timeline.items.filter((item) => item.title.endsWith(run));
    // ZQ-01 (K2-a.3): Die früheren geteilten Maßnahmen sind Zusagen und stehen mit ihrer Frist in
    // der Schiene, wie zuvor die Zusagen des Gemeinsamen Plans; erledigte und überfällige nicht.
    expect(mine.map((item) => item.title)).toEqual([
      `Heute ${run}`,
      `Wartet ${run}`,
      `QBR sichtbar ${run}`,
    ]);
    const meeting = mine.find((item) => item.kind === 'meeting');
    expect(meeting).toMatchObject({
      kind: 'meeting',
      date: day(3),
      relationshipId: rels.seen,
      counterpart: `P2-Sichtbar ${run}`,
    });
    expect(meeting?.href).toMatch(
      new RegExp(`^/lieferanten/${rels.seen}/umsetzung/termine/[0-9a-f-]{36}$`),
    );
    // Eine Zusage ohne Gemeinsamen Plan öffnet bis zur Akte (K2-c) die Maßnahmen-Seite.
    const commitment = mine.find((item) => item.title === `Heute ${run}`);
    expect(commitment).toMatchObject({ kind: 'commitment', date: day(0) });
    expect(commitment?.href).toMatch(
      new RegExp(`^/lieferanten/${rels.seen}/umsetzung/massnahmen#[0-9a-f-]{36}$`),
    );
    expect(JSON.stringify(body)).not.toContain(rels.hidden);
  });

  it('Terminschiene: falscher Zeitraum ist ein Fehler, der Lieferant bekommt keine', async () => {
    expect((await get(users.member, '/start/termine?tage=0')).status).toBe(400);
    const supplier = await get<Timeline>(users.supplier, '/start/termine');
    expect(supplier.status).toBe(200);
    expect(supplier.body.items).toEqual([]);
  });

  it('Mein Tag: überfällig als Nächstes, heute darunter, erledigt gezählt, Wartet ohne Fremde', async () => {
    const { status, body } = await get<MyDay>(users.member, '/start/mein-tag');
    expect(status).toBe(200);
    const myDay = myDaySchema.parse(body);
    expect(myDay.next?.item.detail).toBe(`Überfällig ${run}`);
    expect(myDay.next).toMatchObject({ overdueDays: 2, minutes: 5, scope: 'global' });
    expect(myDay.todayItems.map((item) => item.detail)).toContain(`Heute ${run}`);
    expect(myDay.todayItems.map((item) => item.detail)).not.toContain(`Überfällig ${run}`);
    expect(myDay.doneToday).toBe(1);
    expect(myDay.waiting.map((item) => item.title)).toEqual([`Wartet ${run}`]);
    expect(myDay.timeline.map((item) => item.title)).toEqual([
      `Heute ${run}`,
      `Wartet ${run}`,
      `QBR sichtbar ${run}`,
    ]);
    expect(JSON.stringify(body)).not.toContain(rels.hidden);
  });

  it('„Als Nächstes“ global und „Brauchen dich“ nennen nur sichtbare Lieferanten', async () => {
    const next = await get<{ next: NextAction | null }>(users.member, '/start/als-naechstes');
    expect(next.body.next?.item.detail).toBe(`Überfällig ${run}`);
    const needs = await get<NeedsYou>(users.member, '/start/brauchen-dich');
    // ZQ-01 (K2-a.3): Die fällige geteilte Maßnahme ist jetzt eine Zusage
    expect(needs.body.items).toEqual([
      { relationshipId: rels.seen, reason: 'due', title: 'commitment' },
    ]);
  });

  it('B-33: kurz nach Mitternacht gilt der Tag in Berlin, nicht in UTC', async () => {
    const { status, body } = await get<MyDay>(users.night, '/start/mein-tag');
    expect(status).toBe(200);
    const myDay = myDaySchema.parse(body);
    expect(myDay.today).toBe('2026-11-27');
    expect(myDay.next?.item.detail).toBe(`Nacht überfällig ${run}`);
    expect(myDay.next).toMatchObject({ overdueDays: 2 });
    expect(myDay.todayItems.map((item) => item.detail)).toContain(`Nacht heute ${run}`);
    expect(myDay.doneToday).toBe(1);
    // Termin um 00:45 und Zusage mit Frist am 27.11. gehören zu heute, der Termin um 23:30 nicht.
    // Ohne Reihenfolge: das Datum eines Termins in der Schiene folgt noch UTC (B-33, Rest offen).
    expect(myDay.timeline.map((item) => item.title).sort()).toEqual([
      `Nacht früh ${run}`,
      `Nacht heute ${run}`,
    ]);
  });

  it('B-33: Termine und „erledigt heute“ nach Berlin, auch in einer Datenbank-Sitzung in UTC', async () => {
    const viewer = { orgId: orgs.night, userId: users.night, admin: false };
    await testApp.app.get(TenantDatabase).run(
      { userId: users.night, organizationId: orgs.night },
      async (tx) => {
        await tx.execute(sql`set local time zone 'UTC'`);
        expect(await doneToday(tx, viewer, '2026-11-27')).toBe(1);
        const items = await timelineItems(
          tx,
          viewer,
          new Map([[rels.night, `P2-Sichtbar ${run}`]]),
          { from: '2026-11-27', to: '2026-12-03' },
          { rounds: 'own', modules: await orgModulesOf(tx, orgs.night) },
        );
        expect(items.map((item) => item.title).sort()).toEqual([
          `Nacht früh ${run}`,
          `Nacht heute ${run}`,
        ]);
      },
      { readOnly: true },
    );
  });

  it('ohne Kandidat liefert „Als Nächstes“ nichts', async () => {
    const next = await get<{ next: NextAction | null }>(users.idle, '/start/als-naechstes');
    expect(next.status).toBe(200);
    expect(next.body.next).toBeNull();
  });
});
