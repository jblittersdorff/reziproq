import { randomUUID } from 'node:crypto';
import { type Database, eq, schema, sql } from '@reziproq/db';
import {
  agendaMinutes,
  agentRunDetailSchema,
  agentsResponseSchema,
  type BriefContent,
  type BriefPart,
  briefContentSchemas,
  briefParts,
  hasBindingCommitment,
  meetingBriefSchema,
  meetingDetailSchema,
  replaceAgendaBlock,
} from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';
import { AgentRunner } from './agent-runner.js';
import { MeetingBriefWorker } from './meeting-brief.worker.js';

// Tests zu docs/specs/KI-07.md (Termin-Briefing): Vorlauf je Termintyp, acht Teile mit Quelle,
// Ziele mit „Erreicht, wenn …“, Agenda mit Zeiten und Teilnehmern, Fragen an das Team, Prüfsumme,
// geteilte Agenda ohne interne Texte, nichts für den Lieferanten.
describe('KI-07 Termin-Briefing', () => {
  const suffix = randomUUID().slice(0, 8);
  const orgs = { buyer: randomUUID(), supplier: randomUUID() };
  const users = {
    admin: `ki07-adm-${suffix}`,
    sro: `ki07-sro-${suffix}`,
    colleague: `ki07-col-${suffix}`,
    supplier: `ki07-sup-${suffix}`,
  };
  const relationshipId = randomUUID();
  const meetings = {
    jbp: randomUUID(),
    negotiation: randomUUID(),
    later: randomUUID(),
    outlook: randomUUID(),
  };
  const jbpId = randomUUID();
  const today = new Date();
  const isoDay = (offset: number) => {
    const date = new Date(today);
    date.setUTCDate(date.getUTCDate() + offset);
    return date.toISOString().slice(0, 10);
  };
  const briefPath = (meetingId = meetings.jbp) =>
    `/suppliers/${relationshipId}/termine/${meetingId}/briefing`;
  let app: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  let agentId: string;

  async function call(user: string, method: string, path: string, body?: unknown) {
    const response = await fetch(`${app.baseUrl}/api${path}`, {
      method,
      headers: {
        authorization: `Bearer ${await app.signToken({ subject: user })}`,
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: (await response.json().catch(() => null)) as unknown };
  }

  async function process(runId: string) {
    const [run] = await db.select().from(schema.agentRun).where(eq(schema.agentRun.id, runId));
    if (!run?.jobTicket) throw new Error('Laufauftrag fehlt');
    await app.app.get(AgentRunner).process({
      orgId: run.orgId,
      userId: run.actingUserId,
      runId,
      ticket: run.jobTicket,
    });
  }

  const brief = async (user = users.sro, meetingId = meetings.jbp) =>
    meetingBriefSchema.parse((await call(user, 'GET', briefPath(meetingId))).body);
  const data = <P extends BriefPart>(value: Awaited<ReturnType<typeof brief>>, part: P) => {
    const entry = value.parts[part].draft ?? value.parts[part].accepted;
    return briefContentSchemas[part].parse(entry?.data) as BriefContent[P];
  };
  const runsOf = (meetingId: string) =>
    db
      .select({ id: schema.agentRun.id, actingUserId: schema.agentRun.actingUserId })
      .from(schema.agentRun)
      .where(eq(schema.agentRun.contextId, meetingId));

  beforeAll(async () => {
    app = await startTestApp();
    db = app.adminDb;
    await db.insert(schema.organization).values([
      { id: orgs.buyer, name: `KI07 OEM ${suffix}` },
      { id: orgs.supplier, name: `KI07 Lieferant ${suffix}` },
    ]);
    await db
      .insert(schema.organizationFeature)
      .values({ organizationId: orgs.buyer, feature: 'buyer' });
    await db.insert(schema.appUser).values(
      Object.entries(users).map(([name, id]) => ({
        id,
        name: name === 'colleague' ? 'Jonas Feld' : name === 'sro' ? 'Sara Ost' : name,
        email: `${id}@example.com`,
        organizationId: name === 'supplier' ? orgs.supplier : orgs.buyer,
        orgRole: name === 'admin' || name === 'supplier' ? ('admin' as const) : ('member' as const),
        rolesImportedAt: new Date(),
      })),
    );
    await insertRelationships(db, [
      { id: relationshipId, buyer: orgs.buyer, supplier: orgs.supplier },
    ]);
    await db.insert(schema.relationshipMember).values([
      { relationshipId, orgId: orgs.buyer, userId: users.sro, teamRole: 'sro' },
      { relationshipId, orgId: orgs.buyer, userId: users.colleague, teamRole: 'member' },
    ]);
    await db.insert(schema.relationshipSpend).values([
      { relationshipId, year: today.getUTCFullYear() - 1, amountCents: 400_000_000 },
      { relationshipId, year: today.getUTCFullYear() - 2, amountCents: 360_000_000 },
    ]);
    const meeting = (
      id: string,
      type: 'jbp' | 'negotiation',
      offset: number,
      durationMinutes = 120,
    ) => ({
      id,
      relationshipId,
      ownerOrgId: orgs.buyer,
      type,
      title: type === 'jbp' ? 'JBP' : 'Verhandlung',
      startsAt: new Date(`${isoDay(offset)}T08:00:00Z`),
      durationMinutes,
      createdBy: users.sro,
      createdByName: 'Sara Ost',
    });
    await db
      .insert(schema.meeting)
      .values([
        meeting(meetings.jbp, 'jbp', 7),
        meeting(meetings.negotiation, 'negotiation', 3, 60),
        meeting(meetings.later, 'negotiation', 5, 60),
        meeting(meetings.outlook, 'jbp', 4, 90),
      ]);
    const participant = (name: string, ownerOrgId: string, position: number) => ({
      meetingId: meetings.jbp,
      relationshipId,
      ownerOrgId,
      name,
      position,
    });
    await db
      .insert(schema.meetingParticipant)
      .values([
        participant('Sara Ost', orgs.buyer, 1),
        participant('Jonas Feld', orgs.buyer, 2),
        participant('Tom Weber', orgs.supplier, 1),
      ]);
    await db.insert(schema.jbp).values({
      id: jbpId,
      relationshipId,
      ownerOrgId: orgs.buyer,
      status: 'approved',
      createdBy: users.sro,
      createdByName: 'Sara Ost',
    });
    await db.insert(schema.jbpTopic).values({
      relationshipId,
      ownerOrgId: orgs.supplier,
      jbpId,
      side: 'supplier',
      title: 'Planbarkeit der Abrufe',
      priority: 1,
      createdBy: users.supplier,
      createdByName: 'Tom Weber',
    });
    // Kennzahl hinter Plan: 300 Tage seit Anlage, Ziel in 60 Tagen, Fortschritt erst 13 %
    const scorecardId = randomUUID();
    await db
      .insert(schema.scorecard)
      .values({ id: scorecardId, relationshipId, ownerOrgId: orgs.buyer, jbpId });
    const kpiId = randomUUID();
    const created = new Date(today);
    created.setUTCDate(created.getUTCDate() - 300);
    await db.insert(schema.scorecardKpi).values({
      id: kpiId,
      relationshipId,
      ownerOrgId: orgs.buyer,
      scorecardId,
      name: 'Liefertreue',
      unit: '%',
      direction: 'higher',
      baseline: '80',
      target: '95',
      targetDate: isoDay(60),
      ownerSide: 'supplier',
      ownerName: 'Kim',
      benefitFor: 'both',
      createdAt: created,
    });
    await db.insert(schema.kpiValue).values({
      relationshipId,
      ownerOrgId: orgs.buyer,
      kpiId,
      period: `${isoDay(-20).slice(0, 7)}-01`,
      value: '82',
      source: 'manual',
      enteredBy: users.sro,
      enteredByName: 'Sara Ost',
    });
    const commitment = (
      title: string,
      dueOn: string,
      side: 'buyer' | 'supplier',
      ownerUserId: string | null = null,
    ) => ({
      relationshipId,
      ownerOrgId: orgs.buyer,
      jbpId,
      side,
      title,
      ownerUserId,
      ownerName: ownerUserId ? 'Jonas Feld' : 'Kim',
      dueOn,
      createdBy: users.sro,
      createdByName: 'Sara Ost',
    });
    await db
      .insert(schema.commitment)
      .values([
        commitment('Forecast teilen', isoDay(-3), 'buyer', users.colleague),
        commitment('Kapazitätsplan liefern', isoDay(-20), 'supplier'),
      ]);
    const list = agentsResponseSchema.parse((await call(users.admin, 'GET', '/ki/agenten')).body);
    agentId = list.agents[0]?.id ?? '';
    expect(list.agents[0]?.key).toBe('meeting_brief');
    expect(
      (await call(users.admin, 'PUT', `/ki/agenten/${agentId}/aktivierung`, { enabled: true }))
        .status,
    ).toBe(200);
  });

  afterAll(async () => {
    const ids = Object.values(orgs);
    await db.execute(sql`delete from ai_draft where org_id in ${ids}`);
    await db.execute(sql`delete from comment where relationship_id = ${relationshipId}`);
    await db.execute(sql`delete from commitment where relationship_id = ${relationshipId}`);
    await db.execute(sql`delete from task where relationship_id = ${relationshipId}`);
    await db.execute(sql`delete from meeting where relationship_id = ${relationshipId}`);
    await db.execute(sql`delete from kpi_value where relationship_id = ${relationshipId}`);
    await db.execute(sql`delete from scorecard_kpi where relationship_id = ${relationshipId}`);
    await db.execute(sql`delete from scorecard where relationship_id = ${relationshipId}`);
    await db.execute(sql`delete from commitment where relationship_id = ${relationshipId}`);
    await db.execute(sql`delete from jbp_topic where relationship_id = ${relationshipId}`);
    await db.execute(sql`delete from jbp where relationship_id = ${relationshipId}`);
    await db.execute(sql`delete from relationship_spend where relationship_id = ${relationshipId}`);
    await db.execute(sql`delete from agent where org_id in ${ids}`);
    await db.execute(sql`delete from model_call where org_id in ${ids}`);
    await deleteRelationships(db, ids);
    await db.execute(sql`delete from org_setting where org_id in ${ids}`);
    await db.execute(sql`delete from outbox_event where org_id in ${ids}`);
    await db.execute(sql`delete from app_user where organization_id in ${ids}`);
    await db.execute(sql`delete from organization where id in ${ids}`);
    await app.close();
  });

  it('JBP in sieben Tagen und Verhandlung in drei Tagen: je genau ein Lauf und eine Aufgabe für den SRO; ein Termin in vier Tagen startet sofort', async () => {
    const worker = app.app.get(MeetingBriefWorker);
    // MA-01 T1-MA4 (K1-f): In den KI-Einstellungen ausgeschaltet entsteht kein Lauf
    const briefOn = (enabled: boolean) =>
      db.execute(sql`
        update org_setting set value = jsonb_build_object('meeting_brief',
          jsonb_build_object('enabled', ${enabled}::boolean))
        where org_id = ${orgs.buyer} and key = 'ai_workers'`);
    await briefOn(false);
    expect(await worker.runDue([orgs.buyer], today)).toBe(0);
    expect(await runsOf(meetings.jbp)).toEqual([]);
    await briefOn(true);
    expect(await worker.runDue([orgs.buyer], today)).toBe(3);
    expect(await worker.runDue([orgs.buyer], today)).toBe(0);
    expect(await runsOf(meetings.jbp)).toEqual([
      expect.objectContaining({ actingUserId: users.sro }),
    ]);
    expect(await runsOf(meetings.negotiation)).toHaveLength(1);
    expect(await runsOf(meetings.outlook)).toHaveLength(1);
    // Verhandlung in fünf Tagen liegt außerhalb ihres Vorlaufs von drei Tagen
    expect(await runsOf(meetings.later)).toHaveLength(0);
    // ZQ-01 (K2-a.3): interne Aufgaben des Briefings, früher interne Maßnahmen
    const tasks = await db
      .select()
      .from(schema.task)
      .where(sql`${schema.task.relationshipId} = ${relationshipId}`);
    const titles = tasks.map((task) => task.title).sort();
    expect(titles).toEqual([
      'JBP vorbereiten: Briefing prüfen',
      'JBP vorbereiten: Briefing prüfen',
      'Verhandlung vorbereiten: Briefing prüfen',
    ]);
    expect(tasks.every((task) => task.ownerUserId === users.sro)).toBe(true);
    // Aufgaben sind immer intern (ZQ-01); es gibt sie nur in der Tabelle task
  });

  it('mit Testdaten entstehen alle acht Teile, jede Aussage mit Quelle; Kennzahl hinter Plan als Risiko', async () => {
    const [run] = await runsOf(meetings.jbp);
    await process(run?.id as string);
    const value = await brief();
    for (const part of briefParts) {
      const draft = value.parts[part].draft;
      expect(draft, part).not.toBeNull();
      expect(draft?.claims?.length, part).toBeGreaterThan(0);
      expect(
        draft?.claims?.every((claim) => claim.sources.length > 0),
        part,
      ).toBe(true);
    }
    expect(data(value, 'risks').risks.map((risk) => risk.text)).toContain(
      '„Liefertreue“ liegt bei 82 %, Ziel 95 %.',
    );
    expect(data(value, 'openPoints').points.map((point) => point.title)).toEqual([
      'Kapazitätsplan liefern',
      'Forecast teilen',
    ]);
    expect(value.freshness.unchanged).toBe(true);
  });

  it('jedes Ziel hat „Erreicht, wenn …“ und einen Verweis; die Agenda füllt die Dauer genau, nur Teilnehmer führen, jedes Ziel hat einen Punkt', async () => {
    const value = await brief();
    const goals = data(value, 'goals').goals;
    expect(goals.length).toBeGreaterThanOrEqual(2);
    expect(goals.length).toBeLessThanOrEqual(4);
    for (const goal of goals) {
      expect(goal.reachedWhen.length).toBeGreaterThan(10);
      expect(goal.ref.objectId).toBeTruthy();
    }
    const agenda = data(value, 'agenda');
    expect(agendaMinutes(agenda.items)).toBe(120);
    // Startzeiten: 08:00 UTC ist 09:00 oder 10:00 in Berlin; danach lückenlos
    const toMinutes = (time: string) => {
      const [h = 0, m = 0] = time.split(':').map(Number);
      return h * 60 + m;
    };
    agenda.items.forEach((item, index) => {
      const next = agenda.items[index + 1];
      if (next) expect(toMinutes(next.start) - toMinutes(item.start)).toBe(item.minutes);
    });
    expect(agenda.items[0]?.kind).toBe('welcome');
    expect(agenda.items.at(-1)?.title).toBe('Zusagen und nächste Schritte');
    expect(agenda.items.some((item) => item.kind === 'break')).toBe(true);
    const participants = ['Sara Ost', 'Jonas Feld', 'Tom Weber'];
    expect(
      agenda.items.every((item) => item.leads.every((lead) => participants.includes(lead))),
    ).toBe(true);
    for (const goal of goals) {
      expect(agenda.items.some((item) => item.goalKey === goal.key)).toBe(true);
    }
    expect(
      agenda.items.filter((item) => item.kind === 'topic').every((item) => item.goalKey !== null),
    ).toBe(true);
  });

  it('Antwortvorschläge enthalten keine Mengen-, Preis- oder Terminzusage', async () => {
    const value = await brief();
    const answers = data(value, 'expectedQuestions').questions.map((question) => question.answer);
    expect(answers.length).toBeGreaterThan(0);
    expect(answers.some(hasBindingCommitment)).toBe(false);
    // Testfälle der Prüfung selbst
    expect(hasBindingCommitment('Wir liefern 5.000 Stück pro Monat.')).toBe(true);
    expect(hasBindingCommitment('Der Preis sinkt um 3 %.')).toBe(true);
    expect(hasBindingCommitment('Lieferung bis 15.12. zugesagt.')).toBe(true);
    expect(hasBindingCommitment('Wir prüfen das gemeinsam nach dem Termin.')).toBe(false);
  });

  it('„Senden“ macht aus einer internen Frage eine Aufgabe beim Adressaten; die Antwort steht im nächsten Lauf als Quelle', async () => {
    const value = await brief();
    const question = data(value, 'internalQuestions').questions.find((entry) =>
      entry.text.includes('Forecast teilen'),
    );
    expect(question?.addressee).toEqual({ userId: users.colleague, name: 'Jonas Feld' });
    const sent = await call(users.sro, 'POST', `${briefPath()}/fragen/${question?.key}/senden`);
    expect(sent.status).toBe(200);
    const after = meetingBriefSchema.parse(sent.body);
    const actionId = data(after, 'internalQuestions').questions.find(
      (entry) => entry.key === question?.key,
    )?.actionId;
    // Die Frage ist eine Aufgabe (immer intern), die Antwort ein Kommentar daran
    const [task] = await db
      .select()
      .from(schema.task)
      .where(eq(schema.task.id, actionId as string));
    expect(task).toMatchObject({ ownerUserId: users.colleague });
    await db.insert(schema.comment).values({
      relationshipId,
      ownerOrgId: orgs.buyer,
      visibility: 'internal',
      objectType: 'task',
      objectId: actionId as string,
      authorId: users.colleague,
      authorName: 'Jonas Feld',
      body: 'Forecast geht am Freitag raus.',
    });
    // Die Antwort ist eine neue Eingabe: Der Lauf von Hand startet.
    const started = await call(users.sro, 'POST', `/ki/agenten/${agentId}/starten`, {
      relationshipId,
      meetingId: meetings.jbp,
      isTest: false,
    });
    expect(started.status).toBe(201);
    await process(agentRunDetailSchema.parse(started.body).run.id);
    const next = await brief();
    const answered = data(next, 'internalQuestions').questions.find((entry) =>
      entry.text.includes('Forecast teilen'),
    );
    expect(answered).toMatchObject({ actionId, answer: 'Forecast geht am Freitag raus.' });
    expect(
      next.parts.internalQuestions.draft?.claims?.some((claim) =>
        claim.text.includes('Antwort: Forecast geht am Freitag raus.'),
      ),
    ).toBe(true);
  });

  it('ohne Änderung der Eingaben startet kein neuer Lauf; ein zweiter Lauf ersetzt nur offene Entwürfe', async () => {
    const before = await brief();
    expect(before.freshness.unchanged).toBe(true);
    const again = await call(users.sro, 'POST', `/ki/agenten/${agentId}/starten`, {
      relationshipId,
      meetingId: meetings.jbp,
      isTest: false,
    });
    expect(again.status).toBe(409);
    expect((again.body as { code: string }).code).toBe('briefing_aktuell');
    // Ziele übernehmen, dann ändert sich eine Eingabe: neuer Lauf, die übernommenen Ziele bleiben
    const goals = before.parts.goals.draft;
    expect((await call(users.sro, 'POST', `${briefPath()}/${goals?.id}/uebernehmen`)).status).toBe(
      200,
    );
    await db.insert(schema.commitment).values({
      relationshipId,
      ownerOrgId: orgs.buyer,
      jbpId,
      side: 'supplier',
      title: 'Muster liefern',
      ownerName: 'Kim',
      dueOn: isoDay(2),
      createdBy: users.sro,
      createdByName: 'Sara Ost',
    });
    const changed = await brief();
    expect(changed.freshness.unchanged).toBe(false);
    const started = await call(users.sro, 'POST', `/ki/agenten/${agentId}/starten`, {
      relationshipId,
      meetingId: meetings.jbp,
      isTest: false,
    });
    expect(started.status).toBe(201);
    await process(agentRunDetailSchema.parse(started.body).run.id);
    const after = await brief();
    expect(after.parts.goals.accepted?.id).toBe(goals?.id);
    expect(after.parts.risks.draft?.id).not.toBe(before.parts.risks.draft?.id);
    const [old] = await db
      .select({ status: schema.aiDraft.status, reason: schema.aiDraft.dismissReason })
      .from(schema.aiDraft)
      .where(eq(schema.aiDraft.id, before.parts.risks.draft?.id as string));
    expect(old).toEqual({ status: 'discarded', reason: 'neuer Lauf' });
  });

  it('die geteilte Agenda enthält keinen Text aus Zielen, internen Fragen oder Antwortvorschlägen; der Lieferant sieht nur sie', async () => {
    const value = await brief();
    const agenda = value.parts.agenda.draft;
    expect((await call(users.sro, 'POST', `${briefPath()}/${agenda?.id}/uebernehmen`)).status).toBe(
      200,
    );
    const shared = meetingDetailSchema.parse(
      (await call(users.supplier, 'GET', `/kunden/${relationshipId}/termine/${meetings.jbp}`)).body,
    );
    const text = shared.agenda.map((item) => `${item.title} ${item.detail ?? ''}`).join('\n');
    expect(shared.agenda.length).toBe(data(value, 'agenda').items.length);
    expect(text).toContain('Zusagen und nächste Schritte');
    const secrets = [
      ...data(value, 'goals').goals.flatMap((goal) => [goal.title, goal.reachedWhen]),
      ...data(value, 'internalQuestions').questions.map((question) => question.text),
      ...data(value, 'expectedQuestions').questions.flatMap((question) => [
        question.text,
        question.answer,
      ]),
    ];
    for (const secret of secrets) expect(text).not.toContain(secret);
    // Fragen an den Lieferanten wandern zum passenden Agendapunkt
    const questions = data(value, 'supplierQuestions').questions.filter((entry) => entry.goalKey);
    expect(questions.some((question) => text.includes(question.text))).toBe(true);
    // Der Lieferant sieht das Briefing nie
    expect((await call(users.supplier, 'GET', briefPath())).status).toBe(403);
    expect(
      (
        await call(
          users.supplier,
          'GET',
          `/kunden/${relationshipId}/termine/${meetings.jbp}/briefing`,
        )
      ).status,
    ).toBe(404);
    const supplierRows = await db.execute<{ n: string }>(
      sql`select count(*)::text as n from ai_draft where org_id = ${orgs.supplier}`,
    );
    expect(supplierRows.rows[0]?.n).toBe('0');
  });

  it('„In Outlook-Einladung einfügen“ ändert nur den Agendablock der Beschreibung', () => {
    const first = replaceAgendaBlock('Hallo zusammen,\nbitte Unterlagen mitbringen.', '10:00 A');
    expect(first).toContain('Hallo zusammen,\nbitte Unterlagen mitbringen.');
    expect(first).toContain('10:00 A');
    const second = replaceAgendaBlock(`${first}\n\nViele Grüße`, '10:00 B');
    expect(second).toContain('10:00 B');
    expect(second).not.toContain('10:00 A');
    expect(second.startsWith('Hallo zusammen,\nbitte Unterlagen mitbringen.')).toBe(true);
    expect(second.endsWith('Viele Grüße')).toBe(true);
  });

  it('Admins ändern den Vorlauf je Termintyp; andere nicht', async () => {
    expect(
      (await call(users.sro, 'PUT', '/einstellungen/termin-briefing', { leadDays: { jbp: 10 } }))
        .status,
    ).toBe(403);
    const saved = await call(users.admin, 'PUT', '/einstellungen/termin-briefing', {
      leadDays: { jbp: 10, other: 2 },
    });
    expect(saved.status).toBe(200);
    expect(saved.body).toMatchObject({
      leadDays: { jbp: 10, other: 2, negotiation: 3, escalation: 0, quarterly_review: 7 },
    });
  });
});
