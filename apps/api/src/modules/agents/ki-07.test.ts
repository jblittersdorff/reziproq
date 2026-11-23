import { randomUUID } from 'node:crypto';
import { type Database, eq, schema, sql } from '@reziproq/db';
import { agentRunDetailSchema, agentsResponseSchema, qbrPrepSchema } from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';
import { AgentRunner } from './agent-runner.js';
import { QbrPrepWorker } from './qbr-prep.worker.js';

// Tests zu docs/specs/KI-07.md: Tageslauf sieben Tage vor einem QBR, Entwürfe für Themen, Risiken
// und offene Punkte mit Quelle, Werte aus der Datenbank, Ersetzen je Termin, nichts für den Lieferanten.
describe('KI-07 QBR-Vorbereitung', () => {
  const suffix = randomUUID().slice(0, 8);
  const orgs = { buyer: randomUUID(), supplier: randomUUID() };
  const users = {
    admin: `ki07-adm-${suffix}`,
    sro: `ki07-sro-${suffix}`,
    supplier: `ki07-sup-${suffix}`,
  };
  const relationshipId = randomUUID();
  const meetingId = randomUUID();
  const jbpId = randomUUID();
  const today = new Date();
  const isoDay = (offset: number) => {
    const date = new Date(today);
    date.setUTCDate(date.getUTCDate() + offset);
    return date.toISOString().slice(0, 10);
  };
  const prepPath = `/suppliers/${relationshipId}/termine/${meetingId}/vorbereitung`;
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

  const prep = async (user = users.sro) =>
    qbrPrepSchema.parse((await call(user, 'GET', prepPath)).body);

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
        name,
        email: `${id}@example.com`,
        organizationId: name === 'supplier' ? orgs.supplier : orgs.buyer,
        orgRole: name === 'sro' ? ('member' as const) : ('admin' as const),
        rolesImportedAt: new Date(),
      })),
    );
    await insertRelationships(db, [
      { id: relationshipId, buyer: orgs.buyer, supplier: orgs.supplier },
    ]);
    await db
      .insert(schema.relationshipMember)
      .values({ relationshipId, orgId: orgs.buyer, userId: users.sro, teamRole: 'sro' });
    await db.insert(schema.meeting).values({
      id: meetingId,
      relationshipId,
      ownerOrgId: orgs.buyer,
      type: 'quarterly_review',
      title: 'QBR',
      startsAt: new Date(`${isoDay(7)}T08:00:00Z`),
      createdBy: users.sro,
      createdByName: 'Sara',
    });
    await db.insert(schema.jbp).values({
      id: jbpId,
      relationshipId,
      ownerOrgId: orgs.buyer,
      status: 'approved',
      createdBy: users.sro,
      createdByName: 'Sara',
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
      enteredByName: 'Sara',
    });
    const commitment = (title: string, dueOn: string, side: 'buyer' | 'supplier') => ({
      relationshipId,
      ownerOrgId: orgs.buyer,
      jbpId,
      side,
      title,
      ownerName: 'Sara',
      dueOn,
      createdBy: users.sro,
      createdByName: 'Sara',
    });
    await db
      .insert(schema.commitment)
      .values([
        commitment('Forecast teilen', isoDay(-3), 'buyer'),
        commitment('Kapazitätsplan liefern', isoDay(3), 'buyer'),
      ]);
    const list = agentsResponseSchema.parse((await call(users.admin, 'GET', '/ki/agenten')).body);
    agentId = list.agents[0]?.id ?? '';
    expect(
      (await call(users.admin, 'PUT', `/ki/agenten/${agentId}/aktivierung`, { enabled: true }))
        .status,
    ).toBe(200);
  });

  afterAll(async () => {
    const ids = Object.values(orgs);
    await db.execute(sql`delete from ai_draft where org_id in ${ids}`);
    await db.execute(sql`delete from action where relationship_id = ${relationshipId}`);
    await db.execute(sql`delete from meeting_agenda_item where meeting_id = ${meetingId}`);
    await db.execute(sql`delete from meeting where relationship_id = ${relationshipId}`);
    await db.execute(sql`delete from kpi_value where relationship_id = ${relationshipId}`);
    await db.execute(sql`delete from scorecard_kpi where relationship_id = ${relationshipId}`);
    await db.execute(sql`delete from scorecard where relationship_id = ${relationshipId}`);
    await db.execute(sql`delete from commitment where relationship_id = ${relationshipId}`);
    await db.execute(sql`delete from jbp where relationship_id = ${relationshipId}`);
    await db.execute(sql`delete from agent where org_id in ${ids}`);
    await db.execute(sql`delete from model_call where org_id in ${ids}`);
    await deleteRelationships(db, ids);
    await db.execute(sql`delete from org_setting where org_id in ${ids}`);
    await db.execute(sql`delete from outbox_event where org_id in ${ids}`);
    await db.execute(sql`delete from app_user where organization_id in ${ids}`);
    await db.execute(sql`delete from organization where id in ${ids}`);
    await app.close();
  });

  it('für einen QBR in sieben Tagen entsteht genau ein Lauf und eine Aufgabe für den SRO', async () => {
    const worker = app.app.get(QbrPrepWorker);
    expect(await worker.runDaily([orgs.buyer], today)).toBe(1);
    expect(await worker.runDaily([orgs.buyer], today)).toBe(0);
    const runs = await db
      .select({ actingUserId: schema.agentRun.actingUserId })
      .from(schema.agentRun)
      .where(
        sql`${schema.agentRun.contextId} = ${meetingId} and ${schema.agentRun.trigger} = 'schedule'`,
      );
    expect(runs).toEqual([{ actingUserId: users.sro }]);
    const tasks = await db
      .select()
      .from(schema.action)
      .where(sql`${schema.action.relationshipId} = ${relationshipId}`);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({
      title: 'QBR vorbereiten: Entwürfe prüfen',
      visibility: 'internal',
      ownerUserId: users.sro,
      sourceType: 'meeting',
      sourceId: meetingId,
    });
  });

  it('der Lauf legt Themen, Risiken und offene Punkte an, jede Aussage mit Quelle; Werte aus der Datenbank', async () => {
    const [run] = await db
      .select({ id: schema.agentRun.id })
      .from(schema.agentRun)
      .where(sql`${schema.agentRun.contextId} = ${meetingId}`);
    await process(run?.id as string);
    const data = await prep();
    for (const part of [data.topics, data.risks, data.openPoints]) {
      expect(part.draft?.claims?.length).toBeGreaterThan(0);
      expect(part.draft?.claims?.every((claim) => claim.sources.length > 0)).toBe(true);
    }
    expect(data.risks.draft?.content).toContain('„Liefertreue“ liegt bei 82 %, Ziel 95 %');
    expect(data.risks.draft?.content).toContain('Zusage „Forecast teilen“ (eure Seite)');
    expect(data.openPoints.draft?.content).toContain('Kapazitätsplan liefern');
    expect(data.topics.draft?.claims?.length).toBeGreaterThanOrEqual(2);
  });

  it('ein zweiter Lauf ersetzt den offenen Entwurf des ersten', async () => {
    const before = await prep();
    const started = await call(users.sro, 'POST', `/ki/agenten/${agentId}/starten`, {
      relationshipId,
      meetingId,
      isTest: false,
    });
    expect(started.status).toBe(201);
    await process(agentRunDetailSchema.parse(started.body).run.id);
    const after = await prep();
    expect(after.risks.draft?.id).not.toBe(before.risks.draft?.id);
    const [old] = await db
      .select({ status: schema.aiDraft.status, reason: schema.aiDraft.dismissReason })
      .from(schema.aiDraft)
      .where(eq(schema.aiDraft.id, before.risks.draft?.id as string));
    expect(old).toEqual({ status: 'discarded', reason: 'neuer Lauf' });
    const open = await db
      .select({ kind: schema.aiDraft.kind })
      .from(schema.aiDraft)
      .where(sql`${schema.aiDraft.objectId} = ${meetingId} and ${schema.aiDraft.status} = 'draft'
        and ${schema.aiDraft.kind} in ('qbr_topics', 'qbr_risks', 'qbr_open_points')`);
    expect(open.map((row) => row.kind).sort()).toEqual([
      'qbr_open_points',
      'qbr_risks',
      'qbr_topics',
    ]);
  });

  it('der Lieferant sieht weder Lauf noch Entwürfe; ein Thema geht nur ausdrücklich und nur als Titel in die Agenda', async () => {
    expect((await call(users.supplier, 'GET', prepPath)).status).toBe(403);
    expect(
      (
        await call(
          users.supplier,
          'GET',
          `/kunden/${relationshipId}/termine/${meetingId}/vorbereitung`,
        )
      ).status,
    ).toBe(404);
    const data = await prep();
    const topics = data.topics.draft;
    const claim = topics?.claims?.[0];
    // Ohne Übernahme keine Agenda
    expect(
      (await call(users.sro, 'POST', `${prepPath}/${topics?.id}/agenda`, { claimKey: claim?.key }))
        .status,
    ).toBe(409);
    expect((await call(users.sro, 'POST', `${prepPath}/${topics?.id}/uebernehmen`)).status).toBe(
      200,
    );
    const added = await call(users.sro, 'POST', `${prepPath}/${topics?.id}/agenda`, {
      claimKey: claim?.key,
    });
    expect(added.status).toBe(200);
    const items = await db
      .select({ title: schema.meetingAgendaItem.title })
      .from(schema.meetingAgendaItem)
      .where(eq(schema.meetingAgendaItem.meetingId, meetingId));
    expect(items).toHaveLength(1);
    expect(items[0]?.title).toBe(claim?.text.split(' — ')[0]);
    expect(items[0]?.title).not.toContain(' — ');
    const supplierRows = await db.execute<{ n: string }>(
      sql`select count(*)::text as n from ai_draft where org_id = ${orgs.supplier}`,
    );
    expect(supplierRows.rows[0]?.n).toBe('0');
  });
});
