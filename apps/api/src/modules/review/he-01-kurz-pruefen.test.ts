import { randomUUID } from 'node:crypto';
import { type Database, schema, sql } from '@reziproq/db';
import { type ReviewStack, reviewStackSchema, type TodayAll } from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';

// HE-01 Kurz prüfen (K1-e.2) über die API: der Stapel der Entwürfe, Übernehmen über den Dienst des
// Moduls mit Herkunft reziproq am Objekt (T1-HE3), Verwerfen nur mit Grund, Später, und nichts, was
// an das Gegenüber geht (die Agenda ist eine Freigabe im Fokus).
describe('HE-01 Kurz prüfen (K1-e.2)', () => {
  let app: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const run = randomUUID().slice(0, 8);
  const orgs = { buyer: randomUUID(), supplier: randomUUID() };
  const users = { sro: `k1e2-sro-${run}`, other: `k1e2-other-${run}` };
  const relationshipId = randomUUID();
  const meetingId = randomUUID();
  const runId = randomUUID();
  const drafts = {
    action: randomUUID(),
    decision: randomUUID(),
    question: randomUUID(),
    qbr: randomUUID(),
    agenda: randomUUID(),
  };
  const inboundId = randomUUID();
  const inDays = (days: number) => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  };

  async function call<T>(user: string, method: string, path: string, body?: unknown) {
    const response = await fetch(`${app.baseUrl}/api${path}`, {
      method,
      headers: {
        authorization: `Bearer ${await app.signToken({ subject: user })}`,
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: (await response.json().catch(() => null)) as T };
  }
  const stack = async (user = users.sro) => {
    const response = await call<ReviewStack>(user, 'GET', '/kurz-pruefen');
    expect(response.status).toBe(200);
    return reviewStackSchema.parse(response.body);
  };
  const itemFor = async (draftId: string) => {
    const [row] = (
      await db.execute<{ id: string }>(
        sql`select id from focus_item where source_id = ${draftId} and user_id = ${users.sro}`,
      )
    ).rows;
    return row?.id ?? '';
  };
  const capture = (kind: string, title: string, extra: Record<string, unknown> = {}) =>
    JSON.stringify({
      kind,
      title,
      visibility: 'internal',
      quote: title,
      side: null,
      owner: null,
      ownerUnclear: true,
      dueOn: null,
      dateUnclear: true,
      addressee: null,
      commitmentId: null,
      commitmentTitle: null,
      proposal: null,
      goalKey: null,
      goalStatus: null,
      reason: null,
      createdId: null,
      ...extra,
    });

  beforeAll(async () => {
    app = await startTestApp();
    db = app.adminDb;
    await db.insert(schema.organization).values([
      { id: orgs.buyer, name: `K1E2 OEM ${run}` },
      { id: orgs.supplier, name: `K1E2 Lieferant ${run}` },
    ]);
    await db
      .insert(schema.organizationFeature)
      .values({ organizationId: orgs.buyer, feature: 'buyer' });
    await db.insert(schema.appUser).values(
      [
        [users.sro, 'Sara Ost'],
        [users.other, 'Jonas Feld'],
      ].map(([id, name]) => ({
        id: id as string,
        name: name as string,
        email: `${id}@example.com`,
        organizationId: orgs.buyer,
        orgRole: 'member' as const,
        rolesImportedAt: new Date(),
      })),
    );
    await insertRelationships(db, [
      { id: relationshipId, buyer: orgs.buyer, supplier: orgs.supplier },
    ]);
    await db.insert(schema.relationshipMember).values([
      { relationshipId, orgId: orgs.buyer, userId: users.sro, teamRole: 'sro' },
      { relationshipId, orgId: orgs.buyer, userId: users.other, teamRole: 'member' },
    ]);
    await db.insert(schema.meeting).values({
      id: meetingId,
      relationshipId,
      ownerOrgId: orgs.buyer,
      type: 'quarterly_review',
      title: `QBR ${run}`,
      startsAt: new Date(Date.now() - 26 * 3_600_000),
      createdBy: users.sro,
      createdByName: 'Sara Ost',
    });
    await db.insert(schema.meetingParticipant).values({
      meetingId,
      relationshipId,
      ownerOrgId: orgs.buyer,
      name: 'Sara Ost',
      position: 1,
    });
    const draft = (id: string, kind: string, content: string, title: string) => ({
      id,
      orgId: orgs.buyer,
      relationshipId,
      kind: kind as 'capture_action',
      objectType: 'meeting',
      objectId: meetingId,
      content,
      claims: [{ key: '1', text: title }],
      runId,
      model: 'reziproq',
      createdBy: users.sro,
      reviewSeconds: 30,
    });
    await db.insert(schema.aiDraft).values([
      draft(
        drafts.action,
        'capture_action',
        capture('action', `Prognose teilen ${run}`, {
          owner: 'Sara Ost',
          ownerUnclear: false,
          dueOn: inDays(20),
          dateUnclear: false,
        }),
        `Prognose teilen ${run}`,
      ),
      draft(
        drafts.decision,
        'capture_decision',
        capture('decision', `Pilot prüfen ${run}`),
        `Pilot prüfen ${run}`,
      ),
      draft(
        drafts.question,
        'capture_question',
        capture('open_question', `Woher kommt das Laminat ${run}`),
        `Woher kommt das Laminat ${run}`,
      ),
      draft(drafts.qbr, 'qbr_topics', `Kapazität 2027 ${run}`, `Kapazität 2027 ${run}`),
      draft(
        drafts.agenda,
        'brief_agenda',
        JSON.stringify({ items: [] }),
        `Agenda mit 7 Punkten ${run}`,
      ),
    ]);
    await db.insert(schema.aiSource).values({
      orgId: orgs.buyer,
      draftId: drafts.action,
      claimKey: '1',
      objectType: 'meeting',
      objectId: meetingId,
      targetType: 'meeting',
      targetId: meetingId,
      kind: 'own_data',
      title: `Notizen QBR ${run}`,
    });
    await db.insert(schema.inboundItem).values({
      id: inboundId,
      orgId: orgs.buyer,
      source: 'inbound_mail',
      subject: `Abstimmung Muster ${run}`,
      details: {
        method: 'REQUEST',
        startsAt: `${inDays(9)}T09:00:00.000Z`,
        endsAt: `${inDays(9)}T10:00:00.000Z`,
        location: null,
        onlineMeetingUrl: null,
        organizerEmail: null,
        organizerName: null,
        attendees: [],
      },
      suggestedRelationshipIds: [relationshipId],
      suggestionKind: 'supplier',
      suggestionReason: 'Domain des Lieferanten',
      suggestedType: 'other',
      status: 'needs_review',
      ownerUserId: users.sro,
      assigneeUserId: users.sro,
    });
  });

  afterAll(async () => {
    const ids = Object.values(orgs);
    await db.execute(sql`delete from ai_source where org_id in ${ids}`);
    await db.execute(sql`delete from ai_draft where org_id in ${ids}`);
    await db.execute(sql`delete from focus_item where org_id in ${ids}`);
    await db.execute(sql`delete from inbound_item where org_id in ${ids}`);
    await db.execute(sql`delete from commitment where relationship_id = ${relationshipId}`);
    await db.execute(sql`delete from task where relationship_id = ${relationshipId}`);
    await db.execute(sql`delete from meeting where relationship_id = ${relationshipId}`);
    await deleteRelationships(db, ids);
    await db.execute(sql`delete from audit_log where org_id in ${ids}`).catch(() => undefined);
    await db.execute(sql`delete from outbox_event where org_id in ${ids}`);
    await db.execute(sql`delete from app_user where organization_id in ${ids}`);
    await db.execute(sql`delete from organization_feature where organization_id in ${ids}`);
    await db.execute(sql`delete from organization where id in ${ids}`);
    await app.close();
  });

  it('Der Stapel: Entwürfe mit Aussagen, Quellen und Kontext; die Agenda nie, sie ist eine Freigabe im Fokus', async () => {
    const view = await stack();
    const titles = view.items.map((item) => item.title);
    expect(titles).toEqual(
      expect.arrayContaining([
        `Prognose teilen ${run}`,
        `Pilot prüfen ${run}`,
        `Woher kommt das Laminat ${run}`,
        `Kapazität 2027 ${run}`,
        `Termin zuordnen: Abstimmung Muster ${run}`,
      ]),
    );
    expect(titles.join(' ')).not.toContain('Agenda');
    const action = view.items.find((item) => item.title === `Prognose teilen ${run}`);
    expect(action).toMatchObject({
      source: 'ai_draft',
      kind: 'capture_action',
      subject: `QBR ${run}`,
      counterpart: `K1E2 Lieferant ${run}`,
      lines: [`Prognose teilen ${run}`],
      sources: [`Notizen QBR ${run}`],
      adjust: 'title',
      text: `Prognose teilen ${run}`,
      canAccept: true,
    });
    const inbound = view.items.find((item) => item.source === 'inbound');
    expect(inbound).toMatchObject({
      canAccept: true,
      inbound: {
        suggestionKind: 'supplier',
        suggestions: [{ relationshipId, name: `K1E2 Lieferant ${run}` }],
        reason: 'Domain des Lieferanten',
      },
    });
    // Minuten: vier Entwürfe à 30 s und eine Zuordnung à 20 s
    expect(view.minutes).toBe(3);
    const all = await call<TodayAll>(users.sro, 'GET', '/heute/alles');
    const agenda = all.body.forYou.find((topic) => topic.title === `Agenda mit 7 Punkten ${run}`);
    expect(agenda).toMatchObject({ kind: 'approval', art: 'freigabe' });
    expect(all.body.assign[0]).toMatchObject({ inReview: true });
    expect(all.body.assign[0]?.href).toMatch(/^\/kurz-pruefen\?entwurf=/);
  });

  it('T1-HE3: Übernehmen setzt den Entwurf auf übernommen und schreibt das Objekt mit Herkunft reziproq und der Person', async () => {
    const id = await itemFor(drafts.action);
    const response = await call(users.sro, 'POST', `/kurz-pruefen/${id}`, {
      decision: 'uebernehmen',
    });
    expect(response).toMatchObject({ status: 200, body: { state: 'accepted' } });
    const [draft] = (
      await db.execute<{ status: string; decided_by: string }>(
        sql`select status, decided_by from ai_draft where id = ${drafts.action}`,
      )
    ).rows;
    expect(draft).toEqual({ status: 'accepted', decided_by: users.sro });
    const [action] = (
      await db.execute<{ origin: string; origin_user_id: string; origin_run_id: string }>(
        sql`select origin, origin_user_id, origin_run_id from (
              select relationship_id, title, origin, origin_user_id, origin_run_id from commitment
              union all
              select relationship_id, title, origin, origin_user_id, origin_run_id from task) w
            where relationship_id = ${relationshipId} and title = ${`Prognose teilen ${run}`}`,
      )
    ).rows;
    expect(action).toEqual({ origin: 'reziproq', origin_user_id: users.sro, origin_run_id: runId });
    const [focus] = (
      await db.execute<{ state: string }>(sql`select state from focus_item where id = ${id}`)
    ).rows;
    expect(focus?.state).toBe('decided');
    expect((await stack()).items.map((item) => item.id)).not.toContain(id);
  });

  it('T1-HE3: Verwerfen verlangt einen Grund und merkt ihn sich', async () => {
    const id = await itemFor(drafts.question);
    expect(
      (await call(users.sro, 'POST', `/kurz-pruefen/${id}`, { decision: 'verwerfen' })).status,
    ).toBe(400);
    expect(
      (await call(users.sro, 'POST', `/kurz-pruefen/${id}`, { decision: 'verwerfen', reason: ' ' }))
        .status,
    ).toBe(400);
    const response = await call(users.sro, 'POST', `/kurz-pruefen/${id}`, {
      decision: 'verwerfen',
      reason: 'Frage ist geklärt',
    });
    expect(response).toMatchObject({ status: 200, body: { state: 'discarded' } });
    const [draft] = (
      await db.execute<{ status: string; dismiss_reason: string }>(
        sql`select status, dismiss_reason from ai_draft where id = ${drafts.question}`,
      )
    ).rows;
    expect(draft).toEqual({ status: 'discarded', dismiss_reason: 'Frage ist geklärt' });
  });

  it('Anpassen ändert den Titel und übernimmt; ein Entwurf ohne eigenen Dienst wird nur übernommen', async () => {
    const decision = await itemFor(drafts.decision);
    expect(
      await call(users.sro, 'POST', `/kurz-pruefen/${decision}`, {
        decision: 'uebernehmen',
        text: `Pilot Konsignationslager prüfen ${run}`,
      }),
    ).toMatchObject({ status: 200, body: { state: 'accepted' } });
    const [row] = (
      await db.execute<{ status: string; content: string; edited: boolean }>(
        sql`select status, content, edited from ai_draft where id = ${drafts.decision}`,
      )
    ).rows;
    expect(row?.status).toBe('accepted');
    expect(JSON.parse(row?.content ?? '{}').title).toBe(`Pilot Konsignationslager prüfen ${run}`);
    const qbr = await itemFor(drafts.qbr);
    expect(
      await call(users.sro, 'POST', `/kurz-pruefen/${qbr}`, { decision: 'uebernehmen' }),
    ).toMatchObject({ status: 200, body: { state: 'accepted' } });
  });

  it('Später stellt den Entwurf bis zum nächsten Morgen zurück', async () => {
    const view = await stack();
    const inbound = view.items.find((item) => item.source === 'inbound');
    expect(
      await call(users.sro, 'POST', `/kurz-pruefen/${inbound?.id}`, { decision: 'spaeter' }),
    ).toMatchObject({ status: 200, body: { state: 'snoozed' } });
    expect((await stack()).items.map((item) => item.id)).not.toContain(inbound?.id);
    const [focus] = (
      await db.execute<{ state: string; until: string }>(
        sql`select state, snoozed_until::text as until from focus_item where id = ${inbound?.id ?? ''}`,
      )
    ).rows;
    expect(focus?.state).toBe('snoozed');
    await db.execute(
      sql`update focus_item set state = 'open', snoozed_until = null where id = ${inbound?.id ?? ''}`,
    );
  });

  it('Eine Zuordnung mit klarem Vorschlag wird beim Übernehmen gespeichert', async () => {
    const inbound = (await stack()).items.find((item) => item.source === 'inbound');
    expect(
      await call(users.sro, 'POST', `/kurz-pruefen/${inbound?.id}`, { decision: 'uebernehmen' }),
    ).toMatchObject({ status: 200, body: { state: 'accepted' } });
    const [row] = (
      await db.execute<{ status: string }>(
        sql`select status from inbound_item where id = ${inboundId}`,
      )
    ).rows;
    expect(row?.status).toBe('assigned');
  });

  it('Eine Freigabe und fremde Einträge lassen sich hier nicht entscheiden', async () => {
    const agenda = await itemFor(drafts.agenda);
    expect(
      (await call(users.sro, 'POST', `/kurz-pruefen/${agenda}`, { decision: 'uebernehmen' }))
        .status,
    ).toBe(404);
    expect(
      (await call(users.other, 'POST', `/kurz-pruefen/${agenda}`, { decision: 'spaeter' })).status,
    ).toBe(404);
    const [draft] = (
      await db.execute<{ status: string }>(
        sql`select status from ai_draft where id = ${drafts.agenda}`,
      )
    ).rows;
    expect(draft?.status).toBe('draft');
  });
});
