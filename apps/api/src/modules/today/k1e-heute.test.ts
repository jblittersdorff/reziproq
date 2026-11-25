import { randomUUID } from 'node:crypto';
import { type Database, schema, sql } from '@reziproq/db';
import {
  endOfWeek,
  sentenceBacked,
  type TodayAll,
  type TodayPage,
  todayAllSchema,
  todayPageSchema,
} from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';
import { berlinDate } from './berlin.js';

// HE-01 Seite Heute (K1-e.1) über die API: Ansicht Fokus mit „Das Wichtigste“, Kurz prüfen,
// „Diese Woche“ und „Wartet auf andere“; Ansicht Alles mit jedem offenen Thema der Person in den
// Gruppen aus E-K0-26 (T1-HE5). Ein Hinweis ist nur Fokus-Thema, wenn die Person darüber
// entscheidet; die übrigen stehen unter „Hinweise“.
describe('HE-01 Heute mit Fokus und Alles (K1-e.1)', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const run = randomUUID().slice(0, 8);
  const orgs = { oem: randomUUID(), own: randomUUID(), team: randomUUID(), foreign: randomUUID() };
  const rels = { own: randomUUID(), team: randomUUID(), foreign: randomUUID() };
  const users = { me: `k1e-me-${run}`, colleague: `k1e-colleague-${run}` };
  // Wie die Triage: Datum in Berlin
  const day = (offset: number) => {
    const date = new Date(`${berlinDate(new Date())}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + offset);
    return date.toISOString().slice(0, 10);
  };
  const call = async <T>(user: string, path: string) => {
    const response = await fetch(`${testApp.baseUrl}/api${path}`, {
      headers: { authorization: `Bearer ${await testApp.signToken({ subject: user })}` },
    });
    expect(response.status).toBe(200);
    return (await response.json()) as T;
  };
  const page = async (user = users.me) =>
    todayPageSchema.parse(await call<TodayPage>(user, '/heute'));
  const all = async (user = users.me) =>
    todayAllSchema.parse(await call<TodayAll>(user, '/heute/alles'));

  beforeAll(async () => {
    testApp = await startTestApp();
    db = testApp.adminDb;
    await db.insert(schema.organization).values([
      { id: orgs.oem, name: `K1E-OEM ${run}` },
      { id: orgs.own, name: `K1E-Eigen ${run}` },
      { id: orgs.team, name: `K1E-Team ${run}` },
      { id: orgs.foreign, name: `K1E-Fremd ${run}` },
    ]);
    await db
      .insert(schema.organizationFeature)
      .values({ organizationId: orgs.oem, feature: 'buyer' });
    const person = (id: string) => ({
      id,
      name: `Person ${id}`,
      email: `${id}@example.com`,
      organizationId: orgs.oem,
      orgRole: 'member' as const,
      rolesImportedAt: new Date(),
    });
    await db.insert(schema.appUser).values([person(users.me), person(users.colleague)]);
    await insertRelationships(db, [
      { id: rels.own, buyer: orgs.oem, supplier: orgs.own },
      { id: rels.team, buyer: orgs.oem, supplier: orgs.team },
      { id: rels.foreign, buyer: orgs.oem, supplier: orgs.foreign },
    ]);
    // Eigene Beziehung: SRO; Team: nur Mitglied (der Kollege ist SRO); fremde: kein Zugriff.
    await db.insert(schema.relationshipMember).values([
      { relationshipId: rels.own, orgId: orgs.oem, userId: users.me, teamRole: 'sro' },
      { relationshipId: rels.team, orgId: orgs.oem, userId: users.me, teamRole: 'member' },
      { relationshipId: rels.team, orgId: orgs.oem, userId: users.colleague, teamRole: 'sro' },
      { relationshipId: rels.foreign, orgId: orgs.oem, userId: users.colleague, teamRole: 'sro' },
    ]);
    const [group] = await db
      .insert(schema.materialGroup)
      .values({ orgId: orgs.oem, name: `Leiterplatten ${run}`, code: `LP-${run}` })
      .returning({ id: schema.materialGroup.id });
    await db.insert(schema.relationshipMaterialGroup).values({
      relationshipId: rels.own,
      materialGroupId: group?.id as string,
      isPrimary: true,
    });
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
      createdBy: owner,
      createdByName: 'Test',
    });
    await db.insert(schema.action).values([
      // Drei überfällige eigene: die drei im Fokus
      action(rels.own, `Eins ${run}`, day(-3), users.me),
      action(rels.own, `Zwei ${run}`, day(-2), users.me),
      action(rels.own, `Drei ${run}`, day(-1), users.me),
      // Platz 4 und später: morgen und in 30 Tagen
      action(rels.own, `Morgen ${run}`, day(1), users.me),
      action(rels.own, `Später ${run}`, day(30), users.me),
      // Bei anderen: der Kollege, einmal überfällig und einmal morgen
      action(rels.team, `Kollege überfällig ${run}`, day(-4), users.colleague),
      action(rels.team, `Kollege morgen ${run}`, day(1), users.colleague),
      // Ohne Zugriff
      action(rels.foreign, `Fremd ${run}`, day(-1), users.colleague),
    ]);
    const hint = (relationshipId: string, title: string, severity: 'high' | 'medium' | 'low') => ({
      orgId: orgs.oem,
      relationshipId,
      ruleKey: 'performance_drop' as const,
      fingerprint: `k1e-${title}`,
      detail: { kpi: 'Liefertreue', months: 3 },
      severity,
      score: 10,
      title,
    });
    await db
      .insert(schema.hint)
      .values([
        hint(rels.own, `Hinweis eigen ${run}`, 'high'),
        hint(rels.team, `Hinweis Team ${run}`, 'medium'),
        hint(rels.foreign, `Hinweis fremd ${run}`, 'low'),
      ]);
    await db.insert(schema.aiDraft).values({
      orgId: orgs.oem,
      relationshipId: rels.own,
      kind: 'plan_summary',
      objectType: 'supplier_plan',
      objectId: randomUUID(),
      content: `Zusammenfassung ${run}`,
      claims: [{ key: '1', text: `Plan ist auf Kurs ${run}` }],
      model: 'test',
      createdBy: users.me,
      reviewSeconds: 90,
    });
    await db.insert(schema.inboundItem).values({
      orgId: orgs.oem,
      source: 'inbound_mail',
      subject: `Abstimmung Muster ${run}`,
      details: {
        method: 'REQUEST',
        startsAt: `${day(7)}T09:00:00.000Z`,
        endsAt: `${day(7)}T10:00:00.000Z`,
        location: null,
        onlineMeetingUrl: null,
        organizerEmail: null,
        organizerName: null,
        attendees: [],
      },
      suggestedRelationshipIds: [rels.own],
      suggestionKind: 'supplier',
      suggestedType: 'other',
      status: 'needs_review',
      ownerUserId: users.me,
      assigneeUserId: users.me,
    });
  });

  afterAll(async () => {
    const ids = Object.values(rels);
    const orgIds = Object.values(orgs);
    await db.execute(sql`delete from action where relationship_id in ${ids}`);
    await db.execute(sql`delete from hint where org_id in ${orgIds}`);
    await db.execute(sql`delete from ai_draft where org_id in ${orgIds}`);
    await db.execute(sql`delete from inbound_item where org_id in ${orgIds}`);
    await db.execute(sql`delete from focus_item where org_id in ${orgIds}`);
    await deleteRelationships(db, orgIds);
    await db.execute(sql`delete from app_user where organization_id in ${orgIds}`);
    await db.execute(sql`delete from organization_feature where organization_id in ${orgIds}`);
    await db.execute(sql`delete from organization where id in ${orgIds}`);
    await testApp.close();
  });

  it('Ein Hinweis ist nur Fokus-Thema, wenn die Person darüber entscheidet; die übrigen stehen unter Hinweise', async () => {
    const view = await all();
    const titles = view.forYou.map((topic) => topic.title);
    expect(titles).toContain(`Hinweis eigen ${run}`);
    expect(titles).not.toContain(`Hinweis Team ${run}`);
    expect(view.hints.map((hint) => hint.title)).toEqual([`Hinweis Team ${run}`]);
    expect(view.hints[0]).toMatchObject({ severity: 'medium', relationshipId: rels.team });
    // Ohne Zugriff erscheint nichts, weder als Thema noch als Hinweis noch bei anderen.
    const everything = JSON.stringify(view);
    expect(everything).not.toContain(`Fremd ${run}`);
    expect(everything).not.toContain(`Hinweis fremd ${run}`);
  });

  it('T1-HE5: Alles zeigt jede offene Aufgabe, jeden Hinweis und jeden nicht zugeordneten Eingang der Person', async () => {
    const view = await all();
    // Für dich nach Punktzahl, Plätze ohne Lücke
    expect(view.forYou.map((topic) => topic.rank)).toEqual(
      view.forYou.map((_, index) => index + 1),
    );
    for (const title of ['Eins', 'Zwei', 'Drei', 'Morgen', 'Später']) {
      expect(view.forYou.map((topic) => topic.title)).toContain(`${title} ${run}`);
    }
    expect(view.forYou.find((topic) => topic.title === `Eins ${run}`)).toMatchObject({
      art: 'aufgabe',
      materialGroup: `Leiterplatten ${run}`,
      counterpart: `K1E-Eigen ${run}`,
      item: { kind: 'action' },
    });
    expect(view.forYou.find((topic) => topic.title === `Hinweis eigen ${run}`)).toMatchObject({
      art: 'hinweis',
      severity: 'high',
      item: null,
    });
    // Bei anderen: beide Maßnahmen des Kollegen, ohne Zeitgrenze
    expect(view.others.map((item) => item.title)).toEqual([
      `Kollege überfällig ${run}`,
      `Kollege morgen ${run}`,
    ]);
    expect(view.others[0]).toMatchObject({ relationshipId: rels.team, inFocus: false });
    // Entwürfe für Kurz prüfen, Zuordnen und Zusagen und Aufgaben
    expect(view.drafts.rows.map((draft) => draft.title)).toEqual([`Plan ist auf Kurs ${run}`]);
    expect(view.drafts.minutes).toBe(2);
    expect(view.assign).toEqual([
      expect.objectContaining({
        subject: `Abstimmung Muster ${run}`,
        suggestionKind: 'supplier',
        suggestions: [{ relationshipId: rels.own, name: `K1E-Eigen ${run}` }],
      }),
    ]);
    // Eigene fünf und zwei des Kollegen in den sichtbaren Beziehungen
    expect(view.commitments).toMatchObject({ open: 7, relationships: 2 });
    expect(view.commitments.next?.title).toBe(`Kollege überfällig ${run}`);
    expect(view.materialGroups).toContain(`Leiterplatten ${run}`);
    expect(view.relationships.map((entry) => entry.id).sort()).toEqual(
      [rels.own, rels.team].sort(),
    );
  });

  it('T1-HE1: Fokus zeigt höchstens drei Themen; die Zahlen für „Alles anzeigen“ gleichen der Ansicht Alles', async () => {
    const [focus, view] = [await page(), await all()];
    const shown = [...(focus.next ? [focus.next] : []), ...focus.more];
    expect(shown.length).toBeLessThanOrEqual(3);
    expect(shown.map((topic) => topic.id)).toEqual(
      view.forYou.slice(0, 3).map((topic) => topic.id),
    );
    expect(focus.openFocus).toBe(view.forYou.filter((topic) => !topic.snoozed).length);
    expect(focus.counts).toEqual({
      forYou: view.forYou.length,
      others: view.others.length,
      hints: view.hints.length,
      commitments: view.commitments.open,
    });
    expect(focus.drafts.map((draft) => draft.title)).toEqual([`Plan ist auf Kurs ${run}`]);
    expect(focus.review).toEqual({ count: 1, minutes: 2 });
  });

  it('„Das Wichtigste“: ein belegter Satz mit Quellen; ohne Erledigtes nur die weiteren Themen', async () => {
    const focus = await page();
    expect(focus.summary.sentence).toBe(`${focus.more.length} weitere Themen brauchen dich.`);
    expect(sentenceBacked(focus.summary.sentence, focus.summary.facts)).toBe(true);
    expect(focus.summary.sources).toContain('entwuerfe');
    expect(focus.done).toMatchObject({ count: 0, tasks: [] });
  });

  it('„Diese Woche“: eigene Fristen nach heute und Fristen anderer, höchstens drei; „Wartet auf andere“ ohne Doppel', async () => {
    const focus = await page();
    expect(focus.week.length).toBeLessThanOrEqual(3);
    const tomorrowInWeek = day(1) <= endOfWeek(day(0));
    const own = focus.week.flatMap((entry) => (entry.turn === 'own' ? [entry.topic.title] : []));
    const theirs = focus.week.flatMap((entry) =>
      entry.turn === 'counterpart' ? [entry.waiting.title] : [],
    );
    if (tomorrowInWeek) {
      expect(own).toEqual([`Morgen ${run}`]);
      expect(theirs).toEqual([`Kollege morgen ${run}`]);
      expect(focus.week.map((entry) => entry.turn)).toEqual(['own', 'counterpart']);
    } else {
      // Am Sonntag liegt morgen schon in der nächsten Woche.
      expect(focus.week).toEqual([]);
    }
    // Was in „Diese Woche“ steht, wiederholt „Wartet auf andere“ nicht.
    expect(focus.waiting.map((item) => item.title)).toEqual(
      tomorrowInWeek
        ? [`Kollege überfällig ${run}`]
        : [`Kollege überfällig ${run}`, `Kollege morgen ${run}`],
    );
    expect(focus.waitingTotal).toBe(2);
  });

  it('Zurückgestellte Themen stehen in Alles am Ende, nicht im Fokus', async () => {
    const before = await page();
    const first = before.next;
    expect(first).not.toBeNull();
    const response = await fetch(`${testApp.baseUrl}/api/heute/${first?.id}/morgen`, {
      method: 'POST',
      headers: { authorization: `Bearer ${await testApp.signToken({ subject: users.me })}` },
    });
    expect(response.status).toBe(200);
    const [focus, view] = [await page(), await all()];
    expect(focus.next?.id).not.toBe(first?.id);
    expect(focus.openFocus).toBe(before.openFocus - 1);
    const last = view.forYou.at(-1);
    expect(last).toMatchObject({ id: first?.id, snoozed: true, rank: view.forYou.length });
    await db.execute(
      sql`update focus_item set state = 'open', snoozed_until = null where id = ${first?.id ?? ''}`,
    );
  });
});
