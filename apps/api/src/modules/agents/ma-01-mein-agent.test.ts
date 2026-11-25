import { randomUUID } from 'node:crypto';
import { type Database, schema, sql } from '@reziproq/db';
import { type MyAgent, myAgentSchema, myAgentTaskSchema } from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';
import { ModelGateway } from '../ai-gateway/model-gateway.js';

// MA-01 Mein Agent (K1-f) über die API: je Aufgabe, die es gibt, die eigene Stufe mit Übernahmequote
// der letzten acht Wochen. Wählbar ist nur, was erlaubt ist, heute wirkt und unter der Obergrenze
// der Organisation liegt (T1-MA3). Leser sehen, ändern aber nichts; Lieferanten sehen nichts. Eine
// ausgeschaltete Aufgabe ruft kein Modell auf (T1-MA4).
describe('MA-01 Mein Agent', () => {
  let app: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const run = randomUUID().slice(0, 8);
  const orgs = { buyer: randomUUID(), supplier: randomUUID() };
  const relationshipId = randomUUID();
  const users = {
    admin: `ma01-adm-${run}`,
    anna: `ma01-anna-${run}`,
    bert: `ma01-bert-${run}`,
    leser: `ma01-leser-${run}`,
    supplier: `ma01-sup-${run}`,
  };

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
  const view = async (user: string): Promise<MyAgent> => {
    const response = await call(user, 'GET', '/mein-agent');
    expect(response.status).toBe(200);
    return myAgentSchema.parse(response.body);
  };
  const setOrgWorkers = (value: object) =>
    db.execute(sql`
      insert into org_setting (org_id, key, value, updated_by)
      values (${orgs.buyer}, 'ai_workers', ${JSON.stringify(value)}::jsonb, ${users.admin})
      on conflict (org_id, key) do update set value = excluded.value`);

  beforeAll(async () => {
    app = await startTestApp();
    db = app.adminDb;
    await db.insert(schema.organization).values([
      { id: orgs.buyer, name: `MA01 Käufer ${run}` },
      { id: orgs.supplier, name: `MA01 Lieferant ${run}` },
    ]);
    await db
      .insert(schema.organizationFeature)
      .values({ organizationId: orgs.buyer, feature: 'buyer' });
    const person = (id: string, orgRole: 'admin' | 'member' | 'viewer', org = orgs.buyer) => ({
      id,
      name: id,
      email: `${id}@example.com`,
      organizationId: org,
      orgRole,
      rolesImportedAt: new Date(),
    });
    await db
      .insert(schema.appUser)
      .values([
        person(users.admin, 'admin'),
        person(users.anna, 'member'),
        person(users.bert, 'member'),
        person(users.leser, 'viewer'),
        person(users.supplier, 'admin', orgs.supplier),
      ]);
    await insertRelationships(db, [
      { id: relationshipId, buyer: orgs.buyer, supplier: orgs.supplier },
    ]);
    // Entwürfe des Termin-Briefings, die Anna entschieden hat: einer unverändert übernommen, einer
    // angepasst, einer verworfen; einer liegt vor mehr als acht Wochen und zählt nicht. Ein
    // Entwurf der Ergebnisse nach dem Termin ist übernommen. Bert hat nichts entschieden.
    const draft = (
      kind: 'brief_goals' | 'brief_risks' | 'capture_action',
      status: 'accepted' | 'discarded',
      edited: boolean,
      daysAgo: number,
    ) => ({
      orgId: orgs.buyer,
      relationshipId,
      kind,
      objectType: 'meeting',
      objectId: randomUUID(),
      content: 'Inhalt',
      model: 'reziproq',
      status,
      edited,
      createdBy: users.anna,
      createdAt: new Date(Date.now() - (daysAgo + 1) * 86_400_000),
      decidedBy: users.anna,
      decidedAt: new Date(Date.now() - daysAgo * 86_400_000),
    });
    await db
      .insert(schema.aiDraft)
      .values([
        draft('brief_goals', 'accepted', false, 3),
        draft('brief_goals', 'accepted', true, 10),
        draft('brief_risks', 'discarded', false, 20),
        draft('brief_risks', 'accepted', false, 70),
        draft('capture_action', 'accepted', false, 1),
      ]);
  });

  afterAll(async () => {
    const ids = Object.values(orgs);
    await db.execute(sql`delete from ai_draft where org_id in ${ids}`);
    await db.execute(sql`delete from worker_setting where org_id in ${ids}`);
    await db.execute(sql`delete from model_call where org_id in ${ids}`);
    await db.execute(sql`delete from org_setting where org_id in ${ids}`);
    await deleteRelationships(db, ids);
    await db.execute(sql`delete from app_user where organization_id in ${ids}`);
    await db.execute(sql`delete from organization_feature where organization_id in ${ids}`);
    await db.execute(sql`delete from organization where id in ${ids}`);
    await app.close();
  });

  it('zeigt jede Aufgabe, die es gibt, mit Stufe, wählbaren Stufen und Übernahmequote der letzten acht Wochen', async () => {
    const agent = await view(users.anna);
    expect(agent.tasks.map((task) => task.key)).toEqual([
      'inbox',
      'meeting_brief',
      'meeting_capture',
      'import_assign',
      'early_warning',
      'value_finder',
      'market_signals',
    ]);
    const byKey = new Map(agent.tasks.map((task) => [task.key, task]));
    expect(byKey.get('inbox')).toMatchObject({
      level: 'do',
      chosen: null,
      enabled: true,
      selectable: ['suggest', 'prepare', 'do'],
      allowedLevels: ['suggest', 'prepare', 'do'],
    });
    // Das Termin-Briefing schaltet ein Admin ein; bis dahin arbeitet Reziproq dort nicht
    expect(byKey.get('meeting_brief')).toMatchObject({
      enabled: false,
      level: null,
      selectable: ['prepare'],
      allowedLevels: ['suggest', 'prepare'],
      adoption: { unchanged: 1, decided: 3 },
    });
    expect(byKey.get('meeting_capture')?.adoption).toEqual({ unchanged: 1, decided: 1 });
    expect(byKey.get('early_warning')?.adoption).toBeNull();
    // Über alle Aufgaben, mit dem Postfach (hier ohne Zuordnungen)
    expect(agent.adoption).toEqual({ unchanged: 2, decided: 4 });
    expect(agent.week.done).toBe(0);
    expect(agent).toMatchObject({ canEdit: true, canManage: false });
    // Die Quote gehört der Person: Bert hat nichts entschieden
    expect((await view(users.bert)).adoption).toEqual({ unchanged: 0, decided: 0 });
  });

  it('die eigene Stufe gilt nur für die Person selbst', async () => {
    const changed = await call(users.anna, 'PUT', '/mein-agent/inbox', { level: 'prepare' });
    expect(changed.status).toBe(200);
    expect(myAgentTaskSchema.parse(changed.body)).toMatchObject({
      key: 'inbox',
      chosen: 'prepare',
      level: 'prepare',
    });
    expect((await view(users.anna)).tasks.find((task) => task.key === 'inbox')?.level).toBe(
      'prepare',
    );
    expect((await view(users.bert)).tasks.find((task) => task.key === 'inbox')?.level).toBe('do');
  });

  it('T1-MA3: eine nicht erlaubte oder noch nicht wirksame Stufe lässt sich nicht wählen', async () => {
    // Termin-Briefing erlaubt kein Erledigen; Vorschlagen ist erlaubt, wirkt aber noch nicht
    for (const level of ['do', 'suggest']) {
      const refused = await call(users.anna, 'PUT', '/mein-agent/meeting_brief', { level });
      expect(refused, level).toMatchObject({ status: 400, body: { code: 'stufe_nicht_waehlbar' } });
    }
    // Keine Stufe außerhalb der drei; Aufgaben, die es noch nicht gibt, und unbekannte nicht
    expect((await call(users.anna, 'PUT', '/mein-agent/inbox', { level: 'sofort' })).status).toBe(
      400,
    );
    expect(
      (await call(users.anna, 'PUT', '/mein-agent/commitment_followup', { level: 'do' })).status,
    ).toBe(404);
    expect((await call(users.anna, 'PUT', '/mein-agent/unbekannt', { level: 'do' })).status).toBe(
      404,
    );
  });

  it('T1-MA3: die Obergrenze der Organisation senkt die Stufe und begrenzt die Wahl', async () => {
    await setOrgWorkers({ inbox: { cap: 'prepare' } });
    try {
      const refused = await call(users.bert, 'PUT', '/mein-agent/inbox', { level: 'do' });
      expect(refused).toMatchObject({ status: 400, body: { code: 'stufe_nicht_waehlbar' } });
      const inbox = (await view(users.bert)).tasks.find((task) => task.key === 'inbox');
      expect(inbox).toMatchObject({
        cap: 'prepare',
        level: 'prepare',
        selectable: ['suggest', 'prepare'],
      });
    } finally {
      await db.execute(
        sql`delete from org_setting where org_id = ${orgs.buyer} and key = 'ai_workers'`,
      );
    }
  });

  it('Leser sehen ihre Stufen, ändern aber nichts; Lieferanten sehen Mein Agent nicht', async () => {
    const agent = await view(users.leser);
    expect(agent).toMatchObject({ canEdit: false, canManage: false });
    expect((await call(users.leser, 'PUT', '/mein-agent/inbox', { level: 'prepare' })).status).toBe(
      403,
    );
    expect((await view(users.admin)).canManage).toBe(true);
    expect((await call(users.supplier, 'GET', '/mein-agent')).status).toBe(403);
  });

  it('T1-MA4: Gehört eine Modellfunktion zu einer ausgeschalteten Aufgabe, gibt es keinen Aufruf', async () => {
    const gateway = app.app.get(ModelGateway);
    const calls = async () =>
      Number(
        (
          await db.execute<{ count: number }>(
            sql`select count(*)::int as count from model_call where org_id = ${orgs.buyer}`,
          )
        ).rows[0]?.count ?? 0,
      );
    await setOrgWorkers({ market_signals: { enabled: false } });
    try {
      const before = await calls();
      let called = false;
      await expect(
        gateway.call(
          { orgId: orgs.buyer, userId: users.anna, feature: 'market_analysis' },
          async () => {
            called = true;
            return { value: 'x', usage: { inputTokens: 1, outputTokens: 1 } };
          },
        ),
      ).rejects.toMatchObject({ response: { code: 'ki_aufgabe_aus', aufgabe: 'market_signals' } });
      expect(called).toBe(false);
      expect(await calls()).toBe(before);
      // Andere Aufgaben und Funktionen ohne Aufgabe laufen weiter
      const value = await gateway.call(
        { orgId: orgs.buyer, userId: users.anna, feature: 'prompt' },
        async () => ({ value: 'ok', usage: { inputTokens: 1, outputTokens: 1 } }),
      );
      expect(value).toBe('ok');
    } finally {
      await db.execute(
        sql`delete from org_setting where org_id = ${orgs.buyer} and key = 'ai_workers'`,
      );
    }
  });
});
