import { randomUUID } from 'node:crypto';
import { type Database, eq, schema, sql, withTenant } from '@reziproq/db';
import {
  agentRunDetailSchema,
  customAgentDetailSchema,
  customAgentListSchema,
  customAgentOptionsSchema,
  customAgentRunResultsSchema,
  customAgentSchema,
  dueListSchema,
  type SaveCustomAgent,
} from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';
import { createBuyerDraft } from '../ai-drafts/evidence.js';
import type { AuthContext } from '../auth/auth.guard.js';
import { AgentRunner } from './agent-runner.js';
import {
  CustomAgentsService,
  lastOccurrence,
  ratesPeopleByPattern,
} from './custom-agents.service.js';
import { CustomAgentTools } from './custom-tools.js';

// Tests zu docs/specs/KI-09.md mit Anbieter fake: aktiv nur nach Testlauf, Werkzeuge nach Rechten,
// Zeitplan erst nach Freigabe, keine Personenbewertung, Zugriff des Besitzers, Versionen,
// Mandantentrennung, nichts für den Lieferanten.
describe('KI-09 Eigene Agenten', () => {
  const run = randomUUID().slice(0, 8);
  const orgs = {
    a: randomUUID(),
    b: randomUUID(),
    supplier: randomUUID(),
    supplier2: randomUUID(),
  };
  const users = {
    admin: `ki09-adm-${run}`,
    anna: `ki09-anna-${run}`,
    ben: `ki09-ben-${run}`,
    other: `ki09-other-${run}`,
    supplier: `ki09-sup-${run}`,
  };
  const rel = { one: randomUUID(), two: randomUUID() };
  let app: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  let runner: AgentRunner;
  let service: CustomAgentsService;

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
  const config = (input: Partial<SaveCustomAgent> = {}): SaveCustomAgent => ({
    name: 'Zusagen im Blick',
    instructions: 'Fasse je Lieferant die offenen Zusagen und überfälligen Maßnahmen zusammen.',
    tools: ['supplier_master', 'commitments', 'actions'],
    trigger: { kind: 'manual' },
    scope: { kind: 'focus' },
    output: 'task',
    reviewer: 'me',
    budgetCents: 100,
    ...input,
  });
  async function create(user: string, input: Partial<SaveCustomAgent> = {}) {
    const response = await call(user, 'POST', '/ki/eigene-agenten', config(input));
    expect(response.status).toBe(201);
    return customAgentSchema.parse(response.body);
  }
  async function process(runId: string) {
    const [row] = await db.select().from(schema.agentRun).where(eq(schema.agentRun.id, runId));
    if (!row?.jobTicket) throw new Error('Laufauftrag fehlt');
    await runner.process({
      orgId: row.orgId,
      userId: row.actingUserId,
      runId,
      ticket: row.jobTicket,
    });
    // Hat der Worker der Test-App den Auftrag zuerst genommen, endet process() sofort; dann auf
    // das Ende des Laufs warten, statt die Ergebnisse eines laufenden Laufs zu lesen.
    for (let attempt = 0; attempt < 150; attempt++) {
      const [current] = await db
        .select({ status: schema.agentRun.status })
        .from(schema.agentRun)
        .where(eq(schema.agentRun.id, runId));
      if (current && !['queued', 'running'].includes(current.status)) return;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`Lauf ${runId} endet nicht`);
  }
  async function startRun(user: string, agentId: string, isTest: boolean) {
    const response = await call(user, 'POST', `/ki/eigene-agenten/${agentId}/starten`, { isTest });
    expect(response.status).toBe(200);
    const { runId } = response.body as { runId: string };
    await process(runId);
    return runId;
  }

  beforeAll(async () => {
    app = await startTestApp();
    db = app.adminDb;
    runner = app.app.get(AgentRunner);
    service = app.app.get(CustomAgentsService);
    await db.insert(schema.organization).values([
      { id: orgs.a, name: `Kunde A ${run}` },
      { id: orgs.b, name: `Kunde B ${run}` },
      { id: orgs.supplier, name: `KI09 Rheintal ${run}` },
      { id: orgs.supplier2, name: `KI09 Silesia ${run}` },
    ]);
    await db.insert(schema.organizationFeature).values([
      { organizationId: orgs.a, feature: 'buyer' },
      { organizationId: orgs.b, feature: 'buyer' },
    ]);
    await db.insert(schema.appUser).values([
      ...(['admin', 'anna', 'ben'] as const).map((key) => ({
        id: users[key],
        name: key,
        email: `${key}-${run}@oem.example`,
        organizationId: orgs.a,
        orgRole: key === 'admin' ? ('admin' as const) : ('member' as const),
        rolesImportedAt: new Date(),
      })),
      {
        id: users.other,
        name: 'other',
        email: `other-${run}@b.example`,
        organizationId: orgs.b,
        orgRole: 'admin' as const,
        rolesImportedAt: new Date(),
      },
      {
        id: users.supplier,
        name: 'Lieferant',
        email: `kam-${run}@lieferant.example`,
        organizationId: orgs.supplier,
        orgRole: 'admin' as const,
        rolesImportedAt: new Date(),
      },
    ]);
    await insertRelationships(db, [
      { id: rel.one, buyer: orgs.a, supplier: orgs.supplier },
      { id: rel.two, buyer: orgs.a, supplier: orgs.supplier2 },
    ]);
    await db.insert(schema.relationshipSide).values([
      { relationshipId: rel.one, orgId: orgs.a, isFocus: true },
      { relationshipId: rel.two, orgId: orgs.a, isFocus: true },
    ]);
    await db.insert(schema.relationshipMember).values([
      { relationshipId: rel.one, orgId: orgs.a, userId: users.anna, teamRole: 'sro' },
      { relationshipId: rel.two, orgId: orgs.a, userId: users.anna, teamRole: 'sro' },
    ]);
  });

  afterAll(async () => {
    const ids = [orgs.a, orgs.b];
    await db.execute(sql`delete from ai_source where org_id in ${ids}`);
    await db.execute(sql`delete from ai_draft where org_id in ${ids}`);
    await db.execute(sql`delete from action where relationship_id in ${Object.values(rel)}`);
    await db.execute(sql`delete from model_call where org_id in ${ids}`).catch(() => undefined);
    await db.execute(sql`delete from agent where org_id in ${ids}`);
    await db.execute(sql`delete from relationship_member where org_id = ${orgs.a}`);
    await deleteRelationships(db, ids);
    await db.execute(sql`delete from org_setting where org_id in ${ids}`);
    await db.execute(sql`delete from app_user where id in ${Object.values(users)}`);
    await db.execute(sql`delete from organization where id in ${Object.values(orgs)}`);
    await app.close();
  });

  it('ein Agent ohne erfolgreichen Testlauf der aktuellen Version lässt sich nicht aktivieren', async () => {
    const agent = await create(users.anna);
    expect(agent).toMatchObject({
      status: 'draft',
      version: 1,
      testPassed: false,
      blockedReason: null,
    });
    expect(
      (await call(users.anna, 'POST', `/ki/eigene-agenten/${agent.id}/aktivieren`)).body,
    ).toMatchObject({
      code: 'testlauf_fehlt',
    });
    const testRun = await startRun(users.anna, agent.id, true);
    const results = customAgentRunResultsSchema.parse(
      (await call(users.anna, 'GET', `/ki/eigene-agenten/laeufe/${testRun}/ergebnisse`)).body,
    );
    expect(results.results).toHaveLength(2);
    expect(results.canAccept).toBe(false);
    // Der Testlauf legt keine Entwürfe an
    expect(
      (await db.execute(sql`select 1 from ai_draft where run_id = ${testRun}`)).rows,
    ).toHaveLength(0);
    const active = customAgentSchema.parse(
      (await call(users.anna, 'POST', `/ki/eigene-agenten/${agent.id}/aktivieren`)).body,
    );
    expect(active).toMatchObject({ status: 'active', testPassed: true });
    // Ein echter Lauf legt je Lieferant einen Entwurf an; Übernehmen wird eine interne Maßnahme
    const realRun = await startRun(users.anna, agent.id, false);
    const real = customAgentRunResultsSchema.parse(
      (await call(users.anna, 'GET', `/ki/eigene-agenten/laeufe/${realRun}/ergebnisse`)).body,
    );
    expect(real.results.map((entry) => entry.status)).toEqual(['draft', 'draft']);
    const first = real.results[0];
    expect(
      (await call(users.anna, 'POST', `/ki/eigene-agenten/entwuerfe/${first?.draftId}/uebernehmen`))
        .status,
    ).toBe(204);
    const actions = await db.execute<{ visibility: string; owner_user_id: string }>(
      sql`select visibility, owner_user_id from action where relationship_id = ${first?.relationshipId}`,
    );
    expect(actions.rows).toEqual([{ visibility: 'internal', owner_user_id: users.anna }]);
    await db.execute(sql`delete from action where relationship_id in (${rel.one}, ${rel.two})`);
    // Zwei vollständige Läufe nacheinander: im Gesamtlauf mit allen Dateien parallel länger als 5 s
  }, 30_000);

  it('die Werkzeugauswahl zeigt nur Datenbereiche, die der Nutzer sehen darf', async () => {
    const options = customAgentOptionsSchema.parse(
      (await call(users.anna, 'GET', '/ki/eigene-agenten/optionen')).body,
    );
    expect(options.tools).toContain('commitments');
    expect(options.maxBudgetCents).toBeGreaterThan(0);
    const tools = app.app.get(CustomAgentTools);
    const withoutRole = {
      userId: users.ben,
      orgRole: null,
      isControlling: false,
      isOperator: false,
    } as unknown as AuthContext;
    expect(tools.allowed(withoutRole)).toEqual([]);
    // Unbekanntes Werkzeug wird abgelehnt
    expect(
      (await call(users.anna, 'POST', '/ki/eigene-agenten', { ...config(), tools: ['gehaelter'] }))
        .status,
    ).toBe(400);
  });

  it('ein Agent mit Zeitplan geht bei eingeschalteter Freigabe an den Admin und läuft erst nach der Freigabe', async () => {
    const agent = await create(users.anna, {
      name: 'Montagsbericht',
      trigger: { kind: 'schedule', schedule: { every: 'week', weekday: 1, time: '08:00' } },
    });
    await startRun(users.anna, agent.id, true);
    const pending = customAgentSchema.parse(
      (await call(users.anna, 'POST', `/ki/eigene-agenten/${agent.id}/aktivieren`)).body,
    );
    expect(pending).toMatchObject({ status: 'pending_approval', needsApproval: true });
    // Admin bekommt eine Aufgabe
    const due = dueListSchema.parse((await call(users.admin, 'GET', '/start/due')).body);
    expect(due.items.find((item) => item.kind === 'agent_approval')?.detail).toBe('Montagsbericht');
    // Vor der Freigabe läuft nichts
    service.clock = () => new Date('2026-11-23T08:30:00Z');
    const runsOf = async () =>
      (
        await db.execute(sql`select 1 from agent_run r join agent_version v on v.id = r.agent_version_id
          where v.agent_id = ${agent.id} and r.trigger = 'schedule'`)
      ).rows.length;
    await service.tick(orgs.a);
    expect(await runsOf()).toBe(0);
    expect(
      (
        await call(users.anna, 'POST', `/ki/eigene-agenten/${agent.id}/pruefung`, {
          decision: 'approve',
        })
      ).status,
    ).toBe(403);
    const approved = customAgentSchema.parse(
      (
        await call(users.admin, 'POST', `/ki/eigene-agenten/${agent.id}/pruefung`, {
          decision: 'approve',
        })
      ).body,
    );
    expect(approved.status).toBe('active');
    await service.tick(orgs.a);
    expect(await runsOf()).toBe(1);
    // Einmal je Termin des Zeitplans
    await service.tick(orgs.a);
    expect(await runsOf()).toBe(1);
    service.clock = () => new Date();
    expect(
      lastOccurrence(
        { every: 'week', weekday: 1, time: '08:00' },
        new Date('2026-11-25T12:00:00Z'),
      ).toISOString(),
    ).toBe('2026-11-23T07:00:00.000Z');
  });

  it('„Bewerte, welcher Einkäufer seine Lieferanten am schlechtesten betreut“ wird nicht aktiviert und nennt den Grund', async () => {
    expect(
      ratesPeopleByPattern('Bewerte, welcher Einkäufer seine Lieferanten am schlechtesten betreut'),
    ).toBe(true);
    expect(ratesPeopleByPattern('Fasse je Lieferant die offenen Zusagen zusammen.')).toBe(false);
    const agent = await create(users.anna, {
      name: 'Personenranking',
      instructions: 'Bewerte, welcher Einkäufer seine Lieferanten am schlechtesten betreut.',
    });
    expect(agent.blockedReason).toMatch(/Bewertung einzelner Personen/);
    expect(
      (await call(users.anna, 'POST', `/ki/eigene-agenten/${agent.id}/starten`, { isTest: true }))
        .body,
    ).toMatchObject({
      code: 'personenbewertung',
    });
    expect(
      (await call(users.anna, 'POST', `/ki/eigene-agenten/${agent.id}/aktivieren`)).body,
    ).toMatchObject({
      code: 'personenbewertung',
    });
  });

  it('verliert der Besitzer den Zugriff auf eine Beziehung, liefert der Agent für sie keine Daten; ohne jeden Zugriff pausiert er', async () => {
    const agent = await create(users.anna, { name: 'Fokus' });
    await startRun(users.anna, agent.id, true);
    await call(users.anna, 'POST', `/ki/eigene-agenten/${agent.id}/aktivieren`);
    await db.execute(
      sql`delete from relationship_member where relationship_id = ${rel.two} and user_id = ${users.anna}`,
    );
    const one = await startRun(users.anna, agent.id, false);
    const results = customAgentRunResultsSchema.parse(
      (await call(users.anna, 'GET', `/ki/eigene-agenten/laeufe/${one}/ergebnisse`)).body,
    );
    expect(results.results.map((entry) => entry.relationshipId)).toEqual([rel.one]);
    await db.execute(
      sql`delete from relationship_member where relationship_id = ${rel.one} and user_id = ${users.anna}`,
    );
    await startRun(users.anna, agent.id, false);
    const paused = customAgentDetailSchema.parse(
      (await call(users.anna, 'GET', `/ki/eigene-agenten/${agent.id}`)).body,
    );
    expect(paused).toMatchObject({ status: 'paused', pausedReason: 'kein_zugriff' });
    await db.insert(schema.relationshipMember).values([
      { relationshipId: rel.one, orgId: orgs.a, userId: users.anna, teamRole: 'sro' },
      { relationshipId: rel.two, orgId: orgs.a, userId: users.anna, teamRole: 'sro' },
    ]);
  });

  it('Fremdstart: Schnittmenge der Rechte; der Umfang gilt für den Besitzer, ohne Treffer keine Pause', async () => {
    const agent = await create(users.anna, { name: 'Fremdstart' });
    await startRun(users.anna, agent.id, true);
    await call(users.anna, 'POST', `/ki/eigene-agenten/${agent.id}/aktivieren`);
    // Ben ist in keinem Team: Annas Fokuslieferanten, gelesen unter Bens Session
    const runId = await startRun(users.ben, agent.id, false);
    const results = customAgentRunResultsSchema.parse(
      (await call(users.ben, 'GET', `/ki/eigene-agenten/laeufe/${runId}/ergebnisse`)).body,
    );
    expect(results.results.map((entry) => entry.relationshipId).sort()).toEqual(
      [rel.one, rel.two].sort(),
    );
    // Hat der Besitzer keinen Fokuslieferanten mehr, liefert der Fremdstart nichts, pausiert aber nicht
    await db.execute(sql`delete from relationship_member where user_id = ${users.anna}`);
    try {
      const empty = await startRun(users.ben, agent.id, false);
      const detail = customAgentDetailSchema.parse(
        (await call(users.admin, 'GET', `/ki/eigene-agenten/${agent.id}`)).body,
      );
      expect(detail.status).toBe('active');
      expect(detail.runs.find((entry) => entry.id === empty)?.status).toBe('failed');
    } finally {
      await db.insert(schema.relationshipMember).values([
        { relationshipId: rel.one, orgId: orgs.a, userId: users.anna, teamRole: 'sro' },
        { relationshipId: rel.two, orgId: orgs.a, userId: users.anna, teamRole: 'sro' },
      ]);
    }
  });

  it('eine Änderung erzeugt Version 2; frühere Läufe zeigen weiter Version 1', async () => {
    const agent = await create(users.anna, { name: 'Versionen' });
    const first = await startRun(users.anna, agent.id, true);
    const updated = customAgentSchema.parse(
      (
        await call(
          users.anna,
          'PUT',
          `/ki/eigene-agenten/${agent.id}`,
          config({ name: 'Versionen', output: 'note' }),
        )
      ).body,
    );
    expect(updated).toMatchObject({ version: 2, status: 'draft', testPassed: false });
    const detail = agentRunDetailSchema.parse(
      (await call(users.anna, 'GET', `/ki/agenten/laeufe/${first}`)).body,
    );
    expect(detail.run.version).toBe(1);
    expect(detail.steps.map((step) => step.key)).toEqual(['plan', 'read', 'model', 'draft']);
    // Ben (nicht Besitzer) darf nicht ändern
    expect((await call(users.ben, 'PUT', `/ki/eigene-agenten/${agent.id}`, config())).status).toBe(
      403,
    );
  });

  it('ein eigener Agent von Kunde A ist für Kunde B unsichtbar', async () => {
    const agent = await create(users.anna, { name: 'Nur A' });
    expect((await call(users.other, 'GET', `/ki/eigene-agenten/${agent.id}`)).status).toBe(404);
    const list = customAgentListSchema.parse(
      (await call(users.other, 'GET', '/ki/eigene-agenten')).body,
    );
    expect(list.agents.map((entry) => entry.name)).not.toContain('Nur A');
    const rows = await withTenant(db, { userId: users.other, organizationId: orgs.b }, (tx) =>
      tx.execute(sql`select 1 from agent where id = ${agent.id}`),
    );
    expect(rows.rows).toHaveLength(0);
  });

  it('der Test-Lieferant sieht keinen eigenen Agenten', async () => {
    expect((await call(users.supplier, 'GET', '/ki/eigene-agenten')).status).toBe(403);
    const [any] = (
      await db.execute<{ id: string }>(
        sql`select id from agent where org_id = ${orgs.a} and kind = 'custom' limit 1`,
      )
    ).rows;
    expect((await call(users.supplier, 'GET', `/ki/eigene-agenten/${any?.id}`)).status).toBe(403);
  });
  // KI-03 (Käuferentwürfe und Quellen) am Beispiel der Ergebnisse eigener Agenten
  it('KI-03: ein Entwurf mit einer Aussage ohne Quelle wird abgelehnt', async () => {
    await expect(
      withTenant(db, { userId: users.anna, organizationId: orgs.a }, (tx) =>
        createBuyerDraft(
          tx,
          {
            orgId: orgs.a,
            relationshipId: rel.one,
            kind: 'agent_result',
            objectType: 'agent_run',
            objectId: randomUUID(),
            content: '{}',
            model: 'test',
            createdBy: users.anna,
          },
          [{ text: 'Behauptung ohne Beleg', sources: [] }],
        ),
      ),
    ).rejects.toMatchObject({ status: 422 });
  });

  it('KI-03: Übernehmen nur mit Recht, mit Person und Zeit; ein offener Entwurf ändert nichts', async () => {
    const agent = await create(users.anna, { name: 'Entwürfe', output: 'action' });
    await startRun(users.anna, agent.id, true);
    await call(users.anna, 'POST', `/ki/eigene-agenten/${agent.id}/aktivieren`);
    const runId = await startRun(users.anna, agent.id, false);
    const results = customAgentRunResultsSchema.parse(
      (await call(users.anna, 'GET', `/ki/eigene-agenten/laeufe/${runId}/ergebnisse`)).body,
    );
    const [first, second] = results.results;
    if (!first?.draftId || !second?.draftId) throw new Error('Entwürfe fehlen');
    const actions = async () =>
      (
        await db.execute<{ n: number }>(
          sql`select count(*)::int as n from action where relationship_id = ${first.relationshipId}`,
        )
      ).rows[0]?.n ?? 0;
    // Offener Entwurf: keine Maßnahme, kein geänderter Ablaufschritt
    expect(await actions()).toBe(0);
    // Ben ist nicht Prüfer: kein Übernehmen, nichts geschrieben
    expect(
      (await call(users.ben, 'POST', `/ki/eigene-agenten/entwuerfe/${first.draftId}/uebernehmen`))
        .status,
    ).toBe(403);
    expect(await actions()).toBe(0);
    const accept = await call(
      users.anna,
      'POST',
      `/ki/eigene-agenten/entwuerfe/${first.draftId}/uebernehmen`,
    );
    expect(accept.status).toBeLessThan(300);
    expect(await actions()).toBe(1);
    // Ein zweiter Klick übernimmt nicht doppelt
    expect(
      (await call(users.anna, 'POST', `/ki/eigene-agenten/entwuerfe/${first.draftId}/uebernehmen`))
        .status,
    ).toBe(404);
    expect(await actions()).toBe(1);
    await call(users.anna, 'POST', `/ki/eigene-agenten/entwuerfe/${second.draftId}/verwerfen`);
    const decided = await db
      .select()
      .from(schema.aiDraft)
      .where(sql`${schema.aiDraft.id} in ${[first.draftId, second.draftId]}`);
    for (const row of decided) {
      expect(row.decidedBy).toBe(users.anna);
      expect(row.decidedAt).not.toBeNull();
    }
    expect(decided.map((row) => row.status).sort()).toEqual(['accepted', 'discarded']);
    // Die Maßnahme verweist nicht auf den privaten Entwurf (kein Fremdschlüssel geteilt → privat)
    const [created] = (
      await db.execute<{ source_type: string; source_id: string | null }>(
        sql`select source_type, source_id from action where relationship_id = ${first.relationshipId}`,
      )
    ).rows;
    expect(created).toEqual({ source_type: 'manual', source_id: null });
    const references = await db.execute(sql`
      select 1 from pg_constraint c join pg_class t on t.oid = c.confrelid
      where c.contype = 'f' and t.relname = 'ai_draft'
        and c.conrelid::regclass::text in ('action', 'note', 'commitment', 'initiative')`);
    expect(references.rows).toHaveLength(0);
    // Der Test-Lieferant sieht den Entwurf nicht, auch nicht über die Datenbank-Session
    const supplierRows = await withTenant(
      db,
      { userId: users.supplier, organizationId: orgs.supplier },
      (tx) => tx.execute(sql`select 1 from ai_draft where id = ${second.draftId}`),
    );
    expect(supplierRows.rows).toHaveLength(0);
    expect(
      (await call(users.supplier, 'GET', `/ki/eigene-agenten/laeufe/${runId}/ergebnisse`)).status,
    ).toBe(403);
  });
});
