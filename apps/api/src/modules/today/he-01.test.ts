import { randomUUID } from 'node:crypto';
import { type Database, schema, sql } from '@reziproq/db';
import { type MyDay, type NextAction, sentenceBacked, type Today } from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';
import { berlinTime } from './berlin.js';
import { TriageWorker } from './triage.worker.js';

// HE-01 Triage (K1-c) über die API: jedes Ergebnis genau ein Fokus-Thema, Punktzahl aus Wirkung ×
// Dringlichkeit × Segmentgewicht, höchstens drei sichtbar (T1-HE1), nur belegte Sätze (T1-HE2),
// keine fremde Beziehung in Zahl, Zeile oder Karte (TN-12), „Morgen erinnern“ und der Lauf um 06:00.
describe('HE-01 Triage über die API', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const run = randomUUID().slice(0, 8);
  const orgs = {
    oem: randomUUID(),
    normal: randomUUID(),
    strategic: randomUUID(),
    big: randomUUID(),
    hidden: randomUUID(),
    demo: randomUUID(),
    demoSupplier: randomUUID(),
  };
  const rels = {
    normal: randomUUID(),
    strategic: randomUUID(),
    big: randomUUID(),
    hidden: randomUUID(),
    demo: randomUUID(),
  };
  const users = {
    member: `he1-member-${run}`,
    other: `he1-other-${run}`,
    idle: `he1-idle-${run}`,
    demo: `he1-demo-${run}`,
  };
  const day = (offset: number) => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + offset);
    return date.toISOString().slice(0, 10);
  };
  const actions: Record<string, string> = {};

  const call = async <T>(user: string, path: string, method = 'GET') => {
    const response = await fetch(`${testApp.baseUrl}/api${path}`, {
      method,
      headers: { authorization: `Bearer ${await testApp.signToken({ subject: user })}` },
    });
    return { status: response.status, body: (await response.json()) as T };
  };
  const today = async (user: string) => {
    const response = await call<Today>(user, '/heute');
    expect(response.status).toBe(200);
    return response.body;
  };
  const shown = (body: Today) => [...(body.next ? [body.next] : []), ...body.more];
  const stored = async (user: string) =>
    (
      await db.execute<{ level: string; kind: string; state: string; title: string }>(
        sql`select level, kind, state, title from focus_item where user_id = ${user} order by title`,
      )
    ).rows;

  beforeAll(async () => {
    testApp = await startTestApp();
    db = testApp.adminDb;
    await db.insert(schema.organization).values([
      { id: orgs.oem, name: `HE1-OEM ${run}` },
      { id: orgs.normal, name: `HE1-Normal ${run}` },
      { id: orgs.strategic, name: `HE1-Strategisch ${run}` },
      { id: orgs.big, name: `HE1-Groß ${run}` },
      { id: orgs.hidden, name: `HE1-Verborgen ${run}` },
      { id: orgs.demo, name: `HE1-Demo ${run}`, isDemo: true },
      { id: orgs.demoSupplier, name: `HE1-Demo-Lieferant ${run}` },
    ]);
    await db.insert(schema.organizationFeature).values([
      { organizationId: orgs.oem, feature: 'buyer' },
      { organizationId: orgs.demo, feature: 'buyer' },
    ]);
    const person = (id: string, organizationId: string) => ({
      id,
      name: `Person ${id}`,
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
        person(users.demo, orgs.demo),
      ]);
    const lastYear = new Date().getUTCFullYear() - 1;
    await insertRelationships(db, [
      { id: rels.normal, buyer: orgs.oem, supplier: orgs.normal },
      { id: rels.strategic, buyer: orgs.oem, supplier: orgs.strategic },
      {
        id: rels.big,
        buyer: orgs.oem,
        supplier: orgs.big,
        spend: [{ year: lastYear, amountCents: 5_000_000_00 }],
      },
      { id: rels.hidden, buyer: orgs.oem, supplier: orgs.hidden },
      { id: rels.demo, buyer: orgs.demo, supplier: orgs.demoSupplier },
    ]);
    await db.insert(schema.relationshipMember).values([
      { relationshipId: rels.normal, orgId: orgs.oem, userId: users.member, teamRole: 'sro' },
      { relationshipId: rels.strategic, orgId: orgs.oem, userId: users.member, teamRole: 'sro' },
      { relationshipId: rels.big, orgId: orgs.oem, userId: users.member, teamRole: 'sro' },
      { relationshipId: rels.hidden, orgId: orgs.oem, userId: users.other, teamRole: 'sro' },
      { relationshipId: rels.demo, orgId: orgs.demo, userId: users.demo, teamRole: 'sro' },
    ]);
    // Segmentmodell: der strategische Typ (höchste Wirkung, beste Beziehung) zählt doppelt.
    const [model] = await db
      .insert(schema.segmentModel)
      .values({
        orgId: orgs.oem,
        version: 1,
        status: 'active',
        lowMax: 33,
        midMax: 66,
        activatedAt: new Date(),
      })
      .returning({ id: schema.segmentModel.id });
    await db.insert(schema.segmentType).values([
      {
        modelId: model?.id as string,
        impactLevel: 3,
        qualityLevel: 3,
        name: 'Strategisch',
        description: 'Höchste Wirkung, beste Beziehung',
        triageWeight: 2,
      },
      {
        modelId: model?.id as string,
        impactLevel: 2,
        qualityLevel: 2,
        name: 'Mitte',
        description: 'Mittlere Wirkung und Beziehung',
      },
    ]);
    const decision = (relationshipId: string, level: number) => ({
      relationshipId,
      scope: 'total' as const,
      istImpactLevel: level,
      istQualityLevel: level,
      sollImpactLevel: level,
      sollQualityLevel: level,
      reason: 'Test',
      modelVersion: 1,
      decidedBy: users.member,
      version: 1,
      origin: 'manual' as const,
    });
    await db
      .insert(schema.segmentDecision)
      .values([decision(rels.strategic, 3), decision(rels.normal, 2)]);
    const action = (
      relationshipId: string,
      ownerOrgId: string,
      title: string,
      dueDate: string,
      owner: string,
    ) => ({
      relationshipId,
      ownerOrgId,
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
    const created = await db
      .insert(schema.action)
      .values([
        action(rels.strategic, orgs.oem, `Strategisch überfällig ${run}`, day(-2), users.member),
        action(rels.big, orgs.oem, `Groß in fünf Tagen ${run}`, day(5), users.member),
        action(rels.normal, orgs.oem, `Normal überfällig ${run}`, day(-2), users.member),
        action(rels.normal, orgs.oem, `Normal heute ${run}`, day(0), users.member),
        action(rels.normal, orgs.oem, `Normal später ${run}`, day(20), users.member),
        action(rels.hidden, orgs.oem, `Verborgen überfällig ${run}`, day(-5), users.other),
      ])
      .returning({ id: schema.action.id, title: schema.action.title });
    for (const row of created) actions[row.title] = row.id;
    await db.insert(schema.hint).values({
      orgId: orgs.oem,
      relationshipId: rels.normal,
      ruleKey: 'performance_drop',
      fingerprint: `he1-${run}`,
      detail: { kpi: 'Liefertreue', months: 3 },
      severity: 'high',
      score: 100,
      title: `Liefertreue sinkt ${run}`,
    });
    await db.insert(schema.aiDraft).values([
      {
        orgId: orgs.oem,
        relationshipId: rels.normal,
        kind: 'plan_summary',
        objectType: 'supplier_plan',
        objectId: randomUUID(),
        content: `Zusammenfassung ${run}`,
        claims: [{ key: '1', text: `Plan ist auf Kurs ${run}` }],
        model: 'test',
        createdBy: users.member,
        reviewSeconds: 150,
      },
      {
        orgId: orgs.oem,
        relationshipId: rels.strategic,
        kind: 'share_request',
        objectType: 'action',
        objectId: randomUUID(),
        content: `Maßnahme teilen ${run}`,
        model: 'none',
        createdBy: users.member,
      },
    ]);
  });

  afterAll(async () => {
    const ids = Object.values(rels);
    const orgIds = Object.values(orgs);
    await db.execute(sql`delete from action where relationship_id in ${ids}`);
    await db.execute(sql`delete from hint where org_id in ${orgIds}`);
    await db.execute(sql`delete from ai_draft where org_id in ${orgIds}`);
    await db.execute(sql`delete from segment_decision where relationship_id in ${ids}`);
    await db.execute(sql`delete from segment_model where org_id in ${orgIds}`);
    await db.execute(sql`delete from agent_run where org_id in ${orgIds}`);
    await db.execute(sql`delete from agent_version where org_id in ${orgIds}`);
    await db.execute(sql`delete from agent where org_id in ${orgIds}`);
    await deleteRelationships(db, orgIds);
    await db.execute(sql`delete from app_user where organization_id in ${orgIds}`);
    await db.execute(sql`delete from organization_feature where organization_id in ${orgIds}`);
    await db.execute(sql`delete from organization where id in ${orgIds}`);
    await testApp.close();
  });

  it('T1-HE1: höchstens drei Fokus-Themen, genau eine Karte „Als Nächstes“, die Zahl gleicht den offenen', async () => {
    const body = await today(users.member);
    // Strategisch überfällig: 1 × 4 × 2; Groß (5 Mio. € Spend) in fünf Tagen: 3 × 2 × 1;
    // Normal überfällig: 1 × 4 × 1. Danach Hinweis (Schwere hoch) und „heute“ mit je 300.
    expect(body.next).toMatchObject({
      title: `Strategisch überfällig ${run}`,
      relationshipId: rels.strategic,
      score: 800,
      kind: 'decision',
      level: 'focus',
      dueDate: day(-2),
      sentence: 'Seit 2 Tagen überfällig.',
    });
    expect(body.more.map((topic) => [topic.title, topic.score])).toEqual([
      [`Groß in fünf Tagen ${run}`, 600],
      [`Normal überfällig ${run}`, 400],
    ]);
    // Fünf Maßnahmen, der Hinweis und die Anfrage zum Teilen sind offen; der Entwurf ist Kurz prüfen.
    expect(body.openFocus).toBe(7);
    const [open] = (
      await db.execute<{ n: number }>(
        sql`select count(*)::int as n from next_action where user_id = ${users.member}`,
      )
    ).rows;
    expect(open?.n).toBe(body.openFocus);
    expect(body.review).toEqual({ count: 1, minutes: 3 });
    expect(body.done).toEqual({ count: 0 });
    expect(body.next?.counterpart).toBe(`HE1-Strategisch ${run}`);
  });

  it('Jedes Ergebnis ist genau ein Fokus-Thema, auch nach einem zweiten Lauf', async () => {
    await today(users.member);
    const rows = await stored(users.member);
    expect(rows).toHaveLength(8);
    expect(rows).toContainEqual({
      level: 'focus',
      kind: 'decision',
      state: 'open',
      title: `Liefertreue sinkt ${run}`,
    });
    expect(rows).toContainEqual({
      level: 'focus',
      kind: 'approval',
      state: 'open',
      title: `Maßnahme teilen ${run}`,
    });
    expect(rows).toContainEqual({
      level: 'review',
      kind: 'draft',
      state: 'open',
      title: `Plan ist auf Kurs ${run}`,
    });
  });

  it('T1-HE2: Jeder angezeigte Satz ist durch seine Fakten belegt', async () => {
    const body = await today(users.member);
    for (const topic of shown(body)) {
      expect(sentenceBacked(topic.sentence, topic.facts)).toBe(true);
    }
    // Ein Satz mit einer Zahl ohne Fakt kommt nie an: Die Triage schreibt beim nächsten Lauf neu,
    // und die Antwort prüft jeden Satz.
    await db.execute(sql`
      update focus_item set sentence = 'Seit 99 Tagen überfällig.', sentence_facts = '[]'
      where user_id = ${users.member}`);
    const again = await today(users.member);
    expect(shown(again).map((topic) => topic.sentence)).not.toContain('Seit 99 Tagen überfällig.');
    expect(again.next?.sentence).toBe('Seit 2 Tagen überfällig.');
  });

  it('„Als Nächstes“ auf Start und in Mein Tag liest aus der Triage', async () => {
    const next = await call<{ next: NextAction | null }>(users.member, '/start/als-naechstes');
    expect(next.body.next).toMatchObject({
      scope: 'global',
      item: { kind: 'action', detail: `Strategisch überfällig ${run}` },
      overdueDays: 2,
    });
    const scoped = await call<{ next: NextAction | null }>(
      users.member,
      `/start/als-naechstes?beziehung=${rels.normal}`,
    );
    expect(scoped.body.next).toMatchObject({
      scope: 'relationship',
      item: { detail: `Normal überfällig ${run}` },
    });
    const myDay = await call<MyDay>(users.member, '/start/mein-tag');
    expect(myDay.body.next?.item.detail).toBe(`Strategisch überfällig ${run}`);
    expect(myDay.body.todayItems.map((item) => item.detail)).not.toContain(
      `Strategisch überfällig ${run}`,
    );
  });

  it('„Morgen erinnern“ schiebt das Thema bis 07:00 des nächsten Tages; danach ist es wieder da', async () => {
    const before = await today(users.member);
    const id = before.next?.id as string;
    const snoozed = await call<{ snoozedUntil: string }>(
      users.member,
      `/heute/${id}/morgen`,
      'POST',
    );
    expect(snoozed.status).toBe(200);
    const berlin = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' });
    const tomorrow = new Date(`${berlin.format(new Date())}T12:00:00Z`);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    expect(snoozed.body.snoozedUntil).toBe(
      berlinTime(tomorrow.toISOString().slice(0, 10), 7).toISOString(),
    );
    const later = await today(users.member);
    expect(later.next?.title).toBe(`Groß in fünf Tagen ${run}`);
    expect(later.openFocus).toBe(before.openFocus - 1);
    // Fremde Themen und ungültige IDs: nicht gefunden
    expect((await call(users.other, `/heute/${id}/morgen`, 'POST')).status).toBe(404);
    expect((await call(users.member, '/heute/keine-id/morgen', 'POST')).status).toBe(400);
    // Die Zeit ist vorbei: Das Thema ist wieder offen und wieder „Als Nächstes“.
    await db.execute(
      sql`update focus_item set snoozed_until = now() - interval '1 minute' where id = ${id}`,
    );
    const back = await today(users.member);
    expect(back.next?.id).toBe(id);
    expect(back.openFocus).toBe(before.openFocus);
    const [row] = (
      await db.execute<{ state: string }>(sql`select state from focus_item where id = ${id}`)
    ).rows;
    expect(row?.state).toBe('open');
  });

  it('Ein erledigtes Ergebnis schließt sein Fokus-Thema; wieder geöffnet ist es wieder offen', async () => {
    const id = actions[`Groß in fünf Tagen ${run}`] as string;
    await db.execute(sql`update action set status = 'done', done_at = now() where id = ${id}`);
    const done = await today(users.member);
    expect(shown(done).map((topic) => topic.title)).not.toContain(`Groß in fünf Tagen ${run}`);
    expect(done.openFocus).toBe(6);
    expect(await stored(users.member)).toContainEqual({
      level: 'focus',
      kind: 'decision',
      state: 'decided',
      title: `Groß in fünf Tagen ${run}`,
    });
    await db.execute(sql`update action set status = 'open', done_at = null where id = ${id}`);
    expect((await today(users.member)).openFocus).toBe(7);
  });

  it('NAV-10: „Im Hintergrund“ nennt den laufenden Lauf der Person, sonst nichts', async () => {
    expect((await today(users.member)).background).toBeNull();
    const [agent] = await db
      .insert(schema.agent)
      .values({
        orgId: orgs.oem,
        key: `he1-${run}`,
        name: 'Termin-Briefing',
        description: 'Test',
        kind: 'system',
        status: 'active',
      })
      .returning({ id: schema.agent.id });
    const [version] = await db
      .insert(schema.agentVersion)
      .values({
        orgId: orgs.oem,
        agentId: agent?.id as string,
        version: 1,
        instructions: 'Test',
        tools: [],
        trigger: 'schedule',
        schedule: '*/15 * * * *',
        outputTarget: 'meeting_brief',
        reviewerRule: 'sro',
        modelClass: 'standard',
        budgetCents: 100,
        maxSteps: 10,
      })
      .returning({ id: schema.agentVersion.id });
    await db.insert(schema.agentRun).values({
      orgId: orgs.oem,
      agentVersionId: version?.id as string,
      actingUserId: users.member,
      startedBy: 'system:meeting-brief',
      trigger: 'schedule',
      contextRelationshipId: rels.strategic,
      status: 'running',
    });
    expect((await today(users.member)).background).toMatchObject({
      task: 'Termin-Briefing',
      counterpart: `HE1-Strategisch ${run}`,
    });
    expect((await today(users.other)).background).toBeNull();
    await db.execute(sql`update agent_run set status = 'done' where org_id = ${orgs.oem}`);
    expect((await today(users.member)).background).toBeNull();
  });

  it('TN-12: Ohne Zugriff auf eine Beziehung keine Zahl, keine Zeile und keine Karte', async () => {
    const member = await today(users.member);
    expect(shown(member).some((topic) => topic.relationshipId === rels.hidden)).toBe(false);
    const [count] = (
      await db.execute<{ n: number }>(
        sql`select count(*)::int as n from focus_item
            where user_id = ${users.member} and relationship_id = ${rels.hidden}`,
      )
    ).rows;
    expect(count?.n).toBe(0);
    const hidden = await call<{ next: NextAction | null }>(
      users.member,
      `/start/als-naechstes?beziehung=${rels.hidden}`,
    );
    expect(hidden.body.next).toBeNull();

    const other = await today(users.other);
    expect(other.next?.title).toBe(`Verborgen überfällig ${run}`);
    expect(other.openFocus).toBe(1);
    expect(await today(users.idle)).toMatchObject({ next: null, more: [], openFocus: 0 });

    // Verliert die Person den Zugriff, verschwinden die Themen der Beziehung beim nächsten Lauf.
    await db.execute(
      sql`delete from relationship_member where relationship_id = ${rels.normal} and user_id = ${users.member}`,
    );
    const without = await today(users.member);
    expect(shown(without).some((topic) => topic.relationshipId === rels.normal)).toBe(false);
    // Übrig: Strategisch überfällig, Groß und die Anfrage zum Teilen
    expect(without.openFocus).toBe(3);
    expect(without.review.count).toBe(0);
    const scoped = await call<{ next: NextAction | null }>(
      users.member,
      `/start/als-naechstes?beziehung=${rels.normal}`,
    );
    expect(scoped.body.next).toBeNull();
  });

  it('Der tägliche Lauf um 06:00 nach der Uhr je Mandant legt die Fokus-Themen an', async () => {
    const worker = testApp.app.get(TriageWorker);
    const demoDay = '2026-03-02';
    await db.insert(schema.action).values({
      relationshipId: rels.demo,
      ownerOrgId: orgs.demo,
      visibility: 'shared',
      title: `Demo fällig ${run}`,
      ownerSide: 'buyer',
      ownerUserId: users.demo,
      ownerName: 'Demo',
      dueDate: demoDay,
      sourceType: 'manual',
      createdBy: users.demo,
      createdByName: 'Demo',
    });
    const setClock = (at: Date) =>
      db.execute(
        sql`update organization set demo_now = ${at.toISOString()}::timestamptz where id = ${orgs.demo}`,
      );
    // 05:30 in Berlin: noch nicht
    await setClock(new Date(berlinTime(demoDay, 5).getTime() + 30 * 60_000));
    expect(await worker.runDue([orgs.demo])).toBe(0);
    expect(await stored(users.demo)).toEqual([]);
    // 06:30 in Berlin: Die Triage läuft für jede Person mit ihren Rechten.
    await setClock(new Date(berlinTime(demoDay, 6).getTime() + 30 * 60_000));
    expect(await worker.runDue([orgs.demo])).toBe(1);
    expect(await stored(users.demo)).toEqual([
      { level: 'focus', kind: 'decision', state: 'open', title: `Demo fällig ${run}` },
    ]);
    const [row] = (
      await db.execute<{ sentence: string }>(
        sql`select sentence from focus_item where user_id = ${users.demo}`,
      )
    ).rows;
    // Die Frist zählt nach der Demo-Uhr: heute fällig, nicht seit Monaten überfällig.
    expect(row?.sentence).toBe('Heute fällig.');
  });
});
