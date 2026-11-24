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
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';

// NAV-10 1.1 / UX-20 Phase 2: Mein Tag, Terminschiene, „Als Nächstes“ und „Brauchen dich“.
// Ein Käufer ohne Zugriff auf einen Lieferanten sieht ihn in keiner Zahl, keiner Zeile und keiner
// Karte „Als Nächstes“; jeder Eintrag der Terminschiene öffnet sein Objekt.
describe('UX-20 Phase 2: Mein Tag und Terminschiene über die API', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const run = randomUUID().slice(0, 8);
  const orgs = { oem: randomUUID(), seen: randomUUID(), hidden: randomUUID() };
  const rels = { seen: randomUUID(), hidden: randomUUID() };
  const users = {
    member: `p2-member-${run}`,
    other: `p2-other-${run}`,
    idle: `p2-idle-${run}`,
    supplier: `p2-sup-${run}`,
  };
  const day = (offset: number) => {
    const date = new Date();
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
    ]);
    await db
      .insert(schema.organizationFeature)
      .values({ organizationId: orgs.oem, feature: 'buyer' });
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
      ]);
    await insertRelationships(db, [
      { id: rels.seen, buyer: orgs.oem, supplier: orgs.seen },
      { id: rels.hidden, buyer: orgs.oem, supplier: orgs.hidden },
    ]);
    await db.insert(schema.relationshipMember).values([
      { relationshipId: rels.seen, orgId: orgs.oem, userId: users.member, teamRole: 'sro' },
      { relationshipId: rels.hidden, orgId: orgs.oem, userId: users.other, teamRole: 'sro' },
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
    await db
      .insert(schema.meeting)
      .values([
        meeting(rels.seen, `QBR sichtbar ${run}`, 3),
        meeting(rels.hidden, `QBR verborgen ${run}`, 3),
        meeting(rels.seen, `Weit weg ${run}`, 40),
      ]);
    const action = (
      relationshipId: string,
      title: string,
      dueDate: string,
      owner: string,
      extra: Partial<typeof schema.action.$inferInsert> = {},
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
    await db.insert(schema.action).values([
      action(rels.seen, `Überfällig ${run}`, day(-2), users.member),
      action(rels.seen, `Heute ${run}`, day(0), users.member),
      action(rels.seen, `Wartet ${run}`, day(1), users.other),
      action(rels.hidden, `Verborgen wartet ${run}`, day(1), users.other),
      action(rels.seen, `Erledigt ${run}`, day(0), users.member, {
        status: 'done',
        doneAt: new Date(),
      }),
    ]);
  });

  afterAll(async () => {
    const ids = Object.values(rels);
    await db.execute(sql`delete from action where relationship_id in ${ids}`);
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
    expect(mine.map((item) => item.title)).toEqual([`QBR sichtbar ${run}`]);
    const [meeting] = mine;
    expect(meeting).toMatchObject({
      kind: 'meeting',
      date: day(3),
      relationshipId: rels.seen,
      counterpart: `P2-Sichtbar ${run}`,
    });
    expect(meeting?.href).toMatch(
      new RegExp(`^/lieferanten/${rels.seen}/umsetzung/termine/[0-9a-f-]{36}$`),
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
    expect(myDay.timeline.map((item) => item.title)).toEqual([`QBR sichtbar ${run}`]);
    expect(JSON.stringify(body)).not.toContain(rels.hidden);
  });

  it('„Als Nächstes“ global und „Brauchen dich“ nennen nur sichtbare Lieferanten', async () => {
    const next = await get<{ next: NextAction | null }>(users.member, '/start/als-naechstes');
    expect(next.body.next?.item.detail).toBe(`Überfällig ${run}`);
    const needs = await get<NeedsYou>(users.member, '/start/brauchen-dich');
    expect(needs.body.items).toEqual([
      { relationshipId: rels.seen, reason: 'due', title: 'action' },
    ]);
  });

  it('ohne Kandidat liefert „Als Nächstes“ nichts', async () => {
    const next = await get<{ next: NextAction | null }>(users.idle, '/start/als-naechstes');
    expect(next.status).toBe(200);
    expect(next.body.next).toBeNull();
  });
});
