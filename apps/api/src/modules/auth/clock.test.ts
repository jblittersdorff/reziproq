import { randomUUID } from 'node:crypto';
import { type Database, schema, sql } from '@reziproq/db';
import type { Timeline } from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';

// DM-01, K1-a.2: Die API rechnet im Demo-Mandanten mit dessen Uhr, über die ganze Anfrage und in
// jeder Mandanten-Transaktion; andere Organisationen rechnen mit der Echtzeit.

describe('Uhr je Mandant über die API (DM-01)', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const run = randomUUID().slice(0, 8);
  const orgs = { demo: randomUUID(), live: randomUUID(), supplier: randomUUID() };
  const rels = { demo: randomUUID(), live: randomUUID() };
  const users = { demo: `uhr-demo-${run}`, live: `uhr-live-${run}` };
  // Demo-Uhr weit in der Vergangenheit, damit sich Demo- und Echtzeit sicher unterscheiden.
  const demoNow = new Date('2025-03-03T07:00:00Z');
  const meetingAt = new Date('2025-03-05T09:00:00Z');

  const timeline = async (user: string) => {
    const response = await fetch(`${testApp.baseUrl}/api/start/termine`, {
      headers: { authorization: `Bearer ${await testApp.signToken({ subject: user })}` },
    });
    expect(response.status).toBe(200);
    return ((await response.json()) as Timeline).items.map((item) => item.title);
  };

  beforeAll(async () => {
    testApp = await startTestApp();
    db = testApp.adminDb;
    await db.insert(schema.organization).values([
      { id: orgs.demo, name: `Uhr-Demo ${run}`, isDemo: true, demoNow },
      { id: orgs.live, name: `Uhr-Live ${run}` },
      { id: orgs.supplier, name: `Uhr-Lieferant ${run}` },
    ]);
    await db.insert(schema.organizationFeature).values([
      { organizationId: orgs.demo, feature: 'buyer' },
      { organizationId: orgs.live, feature: 'buyer' },
    ]);
    const person = (id: string, organizationId: string) => ({
      id,
      name: id,
      email: `${id}@example.com`,
      organizationId,
      orgRole: 'member' as const,
      rolesImportedAt: demoNow,
    });
    await db
      .insert(schema.appUser)
      .values([person(users.demo, orgs.demo), person(users.live, orgs.live)]);
    await insertRelationships(db, [
      { id: rels.demo, buyer: orgs.demo, supplier: orgs.supplier },
      { id: rels.live, buyer: orgs.live, supplier: orgs.supplier },
    ]);
    await db.insert(schema.relationshipMember).values([
      { relationshipId: rels.demo, orgId: orgs.demo, userId: users.demo, teamRole: 'sro' },
      { relationshipId: rels.live, orgId: orgs.live, userId: users.live, teamRole: 'sro' },
    ]);
    const meeting = (
      relationshipId: string,
      ownerOrgId: string,
      title: string,
      createdBy: string,
    ) => ({
      relationshipId,
      ownerOrgId,
      visibility: 'shared' as const,
      type: 'quarterly_review' as const,
      title,
      startsAt: meetingAt,
      durationMinutes: 60,
      createdBy,
      createdByName: 'Probe',
    });
    await db
      .insert(schema.meeting)
      .values([
        meeting(rels.demo, orgs.demo, `QBR Demo ${run}`, users.demo),
        meeting(rels.live, orgs.live, `QBR Live ${run}`, users.live),
      ]);
  });

  afterAll(async () => {
    await db.execute(sql`delete from meeting where relationship_id in ${Object.values(rels)}`);
    await deleteRelationships(db, Object.values(orgs));
    await db.execute(sql`delete from app_user where organization_id in ${Object.values(orgs)}`);
    await db.execute(
      sql`delete from organization_feature where organization_id in ${Object.values(orgs)}`,
    );
    await db.execute(sql`delete from organization where id in ${Object.values(orgs)}`);
    await testApp.close();
  });

  it('Termine und Fristen rechnen im Demo-Mandanten mit der Demo-Uhr, sonst mit der Echtzeit', async () => {
    // Zwei Tage nach der Demo-Uhr: liegt in den nächsten vier Wochen des Demo-Mandanten.
    expect(await timeline(users.demo)).toContain(`QBR Demo ${run}`);
    // Für die Echtzeit liegt derselbe Zeitpunkt weit in der Vergangenheit.
    expect(await timeline(users.live)).not.toContain(`QBR Live ${run}`);
  });

  it('Eine neue Zeile im Demo-Mandanten trägt die Demo-Uhr als Zeitstempel', async () => {
    const response = await fetch(`${testApp.baseUrl}/api/suppliers/${rels.demo}/notizen`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${await testApp.signToken({ subject: users.demo })}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ text: `Notiz ${run}`, visibility: 'team' }),
    });
    expect([200, 201]).toContain(response.status);
    const [note] = await db
      .select({ createdAt: schema.note.createdAt })
      .from(schema.note)
      .where(sql`${schema.note.relationshipId} = ${rels.demo}`);
    expect(note?.createdAt.toISOString()).toBe(demoNow.toISOString());
    await db.execute(sql`delete from note where relationship_id = ${rels.demo}`);
  });
});
