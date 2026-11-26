import { randomUUID } from 'node:crypto';
import { type Database, schema, sql } from '@reziproq/db';
import type { NextAction, SupplierOverview, Timeline } from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';
import { insertWorkItems } from '../../testing/work-items.js';

// NAV-10 1.1 / UX-20 Phase 3: Überblick des Lieferanten. „Als Nächstes“ (scope relationship) und
// „Termine und Fristen“ nur für diesen Lieferanten und nur mit Zugriff; Kennzahlen aus ihrem Ort.
describe('UX-20 Phase 3: Lieferanten-Überblick über die API', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const run = randomUUID().slice(0, 8);
  const orgs = { oem: randomUUID(), seen: randomUUID(), hidden: randomUUID() };
  const rels = { seen: randomUUID(), hidden: randomUUID() };
  const users = { member: `p3-member-${run}`, other: `p3-other-${run}` };
  const group = randomUUID();
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
      { id: orgs.oem, name: `P3-OEM ${run}` },
      { id: orgs.seen, name: `P3-Sichtbar ${run}` },
      { id: orgs.hidden, name: `P3-Verborgen ${run}` },
    ]);
    await db
      .insert(schema.organizationFeature)
      .values({ organizationId: orgs.oem, feature: 'buyer' });
    const person = (id: string) => ({
      id,
      name: `Person ${id}`,
      givenName: 'Pat',
      email: `${id}@example.com`,
      organizationId: orgs.oem,
      orgRole: 'member' as const,
      rolesImportedAt: new Date(),
    });
    await db.insert(schema.appUser).values([person(users.member), person(users.other)]);
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
        meeting(rels.hidden, `QBR verborgen ${run}`, 4),
        meeting(rels.seen, `In sechs Wochen ${run}`, 40),
      ]);
    const action = (relationshipId: string, title: string, dueDate: string, owner: string) => ({
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
    });
    await insertWorkItems(db, [
      action(rels.seen, `Bei Sichtbar fällig ${run}`, day(1), users.member),
      action(rels.hidden, `Bei Verborgen überfällig ${run}`, day(-3), users.member),
    ]);
    // Spend: 2024 und 2025 für den ganzen Lieferanten; 2025 dazu je Warengruppe
    await db
      .insert(schema.materialGroup)
      .values({ id: group, orgId: orgs.oem, name: `Leiterplatten ${run}`, code: `LP-${run}` });
    const year = new Date().getUTCFullYear() - 1;
    await db.insert(schema.relationshipSpend).values([
      { relationshipId: rels.seen, year: year - 1, amountCents: 1_000_000_00 },
      { relationshipId: rels.seen, year, amountCents: 900_000_00 },
      { relationshipId: rels.seen, year, amountCents: 300_000_00, materialGroupId: group },
      { relationshipId: rels.hidden, year, amountCents: 700_000_00, materialGroupId: group },
    ]);
    await db
      .insert(schema.relationshipMaterialGroup)
      .values({ relationshipId: rels.seen, materialGroupId: group, isPrimary: true })
      .onConflictDoUpdate({
        target: [
          schema.relationshipMaterialGroup.relationshipId,
          schema.relationshipMaterialGroup.materialGroupId,
        ],
        set: { isPrimary: true },
      });
  });

  afterAll(async () => {
    const ids = Object.values(rels);
    await db.execute(sql`delete from commitment where relationship_id in ${ids}`);
    await db.execute(sql`delete from task where relationship_id in ${ids}`);
    await db.execute(sql`delete from meeting where relationship_id in ${ids}`);
    await db.execute(sql`delete from relationship_spend where relationship_id in ${ids}`);
    await db.execute(sql`delete from relationship_material_group where relationship_id in ${ids}`);
    await db.execute(sql`delete from material_group where id = ${group}`);
    await deleteRelationships(db, Object.values(orgs));
    await db.execute(sql`delete from app_user where organization_id in ${Object.values(orgs)}`);
    await db.execute(
      sql`delete from organization_feature where organization_id in ${Object.values(orgs)}`,
    );
    await db.execute(sql`delete from organization where id in ${Object.values(orgs)}`);
    await testApp.close();
  });

  it('„Als Nächstes“ mit Lieferant zeigt nur dessen Aufgabe; ohne Zugriff keine Karte', async () => {
    const global = await get<{ next: NextAction | null }>(users.member, '/start/als-naechstes');
    // Global gewinnt nichts vom unsichtbaren Lieferanten, auch wenn die Aufgabe überfällig ist.
    expect(global.body.next?.item.href).toContain(rels.seen);

    const own = await get<{ next: NextAction | null }>(
      users.member,
      `/start/als-naechstes?beziehung=${rels.seen}`,
    );
    expect(own.status).toBe(200);
    expect(own.body.next).toMatchObject({ scope: 'relationship' });
    expect(own.body.next?.item.href).toContain(rels.seen);

    const hidden = await get<{ next: NextAction | null }>(
      users.member,
      `/start/als-naechstes?beziehung=${rels.hidden}`,
    );
    expect(hidden.body.next).toBeNull();

    const invalid = await get(users.member, '/start/als-naechstes?beziehung=keine-id');
    expect(invalid.status).toBe(400);
  });

  it('Termine und Fristen mit Lieferant: nur dessen Einträge, ohne Zugriff leer', async () => {
    const own = await get<Timeline>(users.member, `/start/termine?beziehung=${rels.seen}`);
    expect(own.status).toBe(200);
    const titles = own.body.items.map((item) => item.title);
    expect(titles).toContain(`QBR sichtbar ${run}`);
    expect(titles).not.toContain(`QBR verborgen ${run}`);
    // Standard vier Wochen; mit tage=42 auch der Termin in knapp sechs Wochen
    expect(titles).not.toContain(`In sechs Wochen ${run}`);
    expect(own.body.items.every((item) => item.relationshipId === rels.seen)).toBe(true);
    const longer = await get<Timeline>(
      users.member,
      `/start/termine?tage=42&beziehung=${rels.seen}`,
    );
    expect(longer.body.items.map((item) => item.title)).toContain(`In sechs Wochen ${run}`);

    const hidden = await get<Timeline>(users.member, `/start/termine?beziehung=${rels.hidden}`);
    expect(hidden.body.items).toEqual([]);
    const other = await get<Timeline>(users.other, `/start/termine?beziehung=${rels.hidden}`);
    expect(other.body.items.map((item) => item.title)).toEqual([`QBR verborgen ${run}`]);

    expect((await get(users.member, '/start/termine?beziehung=123')).status).toBe(400);
  });

  it('Kennzahlen im Überblick: Spend mit Veränderung, Anteil an der Haupt-Warengruppe', async () => {
    const { status, body } = await get<SupplierOverview>(
      users.member,
      `/suppliers/${rels.seen}/overview`,
    );
    expect(status).toBe(200);
    const year = new Date().getUTCFullYear() - 1;
    // 900.000 € + 300.000 € gegen 1.000.000 € im Vorjahr: +20 %
    expect(body.figures?.spend).toEqual({
      year,
      amount: { amountCents: 1_200_000_00, currency: 'EUR' },
      changeBasisPoints: 2_000,
    });
    // 300.000 € von 1.000.000 € in der Warengruppe: 30 %
    expect(body.figures?.groupShare).toEqual({
      group: `Leiterplatten ${run}`,
      year,
      basisPoints: 3_000,
    });
    // Ohne aufgedeckte Feedback-Welle keine Lücke
    expect(body.figures?.feedbackGap).toBeNull();
  });
});
