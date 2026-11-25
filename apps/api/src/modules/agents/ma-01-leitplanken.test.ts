import { randomUUID } from 'node:crypto';
import { type Database, schema, sql, type TenantSession, withTenant } from '@reziproq/db';
import {
  reviewStackSchema,
  shareTool,
  todayAllSchema,
  type WorkerTool,
  workers,
} from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';
import { issueConfirmToken } from '../spaces/share-guard.js';
import { workerVersion } from '../today/erledigt.js';
import { type DraftRow, fromDraft } from '../today/triage.js';
import { bindingStepTitle, runTool } from './binding-guard.js';

// MA-01 Leitplanken (K1-f.2), G-5, T1-MA2: Jedes Werkzeug mit binding = true bricht ohne Token eines
// Menschen ab und legt einen Entwurf an, ein Test je Werkzeug der Registry. Mit dem Token der
// Person für genau dieses Werkzeug und Objekt läuft es genau einmal; jedes andere Token gilt nicht.

const bindingTools: WorkerTool[] = [
  ...new Map(
    [...workers.flatMap((worker) => worker.tools), shareTool]
      .filter((tool) => tool.binding)
      .map((tool) => [tool.key, tool] as const),
  ).values(),
];
const ownerOf = (tool: WorkerTool) =>
  workers.find((worker) => worker.tools.some((entry) => entry.key === tool.key))?.key ?? 'inbox';

describe('MA-01 Leitplanken: bindende Werkzeuge nur mit dem Token eines Menschen', () => {
  let app: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const run = randomUUID().slice(0, 8);
  const orgs = { buyer: randomUUID(), supplier: randomUUID() };
  const relationshipId = randomUUID();
  const users = { anna: `ma01g-anna-${run}`, bert: `ma01g-bert-${run}` };
  const anna: TenantSession = { userId: users.anna, organizationId: orgs.buyer };
  const bert: TenantSession = { userId: users.bert, organizationId: orgs.buyer };

  /** Ein laufender Lauf der Aufgabe, zu der das Werkzeug gehört, im Namen von Anna */
  const startRun = (workerKey: string) =>
    withTenant(db, anna, async (tx) => {
      const versionId = await workerVersion(tx, orgs.buyer, workerKey);
      const [row] = await tx
        .insert(schema.agentRun)
        .values({
          orgId: orgs.buyer,
          agentVersionId: versionId,
          actingUserId: users.anna,
          startedBy: users.anna,
          trigger: 'event',
          status: 'running',
        })
        .returning({ id: schema.agentRun.id });
      return row?.id as string;
    });
  const toolCall = (tool: WorkerTool, runId: string, objectId: string, token: string | null) => ({
    orgId: orgs.buyer,
    userId: users.anna,
    runId,
    relationshipId,
    tool,
    objectType: 'commitment',
    objectId,
    summary: `Probe ${tool.key} ${run}`,
    token,
  });
  const issue = (
    session: TenantSession,
    purpose: string,
    objectId: string,
    now?: Date,
  ): Promise<string> =>
    withTenant(db, session, (tx) =>
      issueConfirmToken(tx, {
        orgId: orgs.buyer,
        userId: session.userId,
        purpose,
        objectType: 'commitment',
        objectId,
        ...(now ? { now } : {}),
      }),
    );
  const runOf = async (runId: string) =>
    (await db.execute<{ status: string }>(sql`select status from agent_run where id = ${runId}`))
      .rows[0];
  const stepsOf = async (runId: string) =>
    (
      await db.execute<{ title: string; tool_key: string | null; status: string }>(
        sql`select title, tool_key, status from agent_step where run_id = ${runId} order by seq`,
      )
    ).rows;
  const draftsOf = async (objectId: string) =>
    (
      await db.execute<{ kind: string; subject: string; run_id: string; created_by: string }>(
        sql`select kind, subject, run_id::text, created_by from ai_draft where object_id = ${objectId}`,
      )
    ).rows;

  async function call(user: string, path: string) {
    const response = await fetch(`${app.baseUrl}/api${path}`, {
      headers: { authorization: `Bearer ${await app.signToken({ subject: user })}` },
    });
    expect(response.status).toBe(200);
    return (await response.json()) as unknown;
  }

  beforeAll(async () => {
    app = await startTestApp();
    db = app.adminDb;
    await db.insert(schema.organization).values([
      { id: orgs.buyer, name: `MA01G Käufer ${run}` },
      { id: orgs.supplier, name: `MA01G Lieferant ${run}` },
    ]);
    await db
      .insert(schema.organizationFeature)
      .values({ organizationId: orgs.buyer, feature: 'buyer' });
    await db.insert(schema.appUser).values(
      Object.values(users).map((id) => ({
        id,
        name: id,
        email: `${id}@example.com`,
        organizationId: orgs.buyer,
        orgRole: 'member' as const,
        rolesImportedAt: new Date(),
      })),
    );
    await insertRelationships(db, [
      { id: relationshipId, buyer: orgs.buyer, supplier: orgs.supplier },
    ]);
    await db
      .insert(schema.relationshipMember)
      .values({ relationshipId, orgId: orgs.buyer, userId: users.anna, teamRole: 'sro' });
  });

  afterAll(async () => {
    const ids = Object.values(orgs);
    await db.execute(sql`delete from ai_draft where org_id in ${ids}`);
    await db.execute(sql`delete from focus_item where org_id in ${ids}`);
    await db.execute(sql`delete from confirm_token where org_id in ${ids}`);
    await db.execute(sql`delete from agent_step where org_id in ${ids}`);
    await db.execute(sql`delete from agent_run where org_id in ${ids}`);
    await db.execute(sql`delete from agent_version where org_id in ${ids}`);
    await db.execute(sql`delete from agent where org_id in ${ids}`);
    await deleteRelationships(db, ids);
    await db.execute(sql`delete from app_user where organization_id in ${ids}`);
    await db.execute(sql`delete from organization_feature where organization_id in ${ids}`);
    await db.execute(sql`delete from organization where id in ${ids}`);
    await app.close();
  });

  it('die Registry kennt die bindenden Werkzeuge aus „Nie automatisch“', () => {
    expect(bindingTools.map((tool) => tool.key).sort()).toEqual(
      [
        'agenda.release',
        'commitment.create_buyer',
        'deal.confirm',
        'deal.send',
        'deck.share',
        'feedback.release',
        'mail.send',
        'protocol.share',
        'rule.freeze_baseline',
        'segment.decide',
        'share.to_shared',
        'strategy.release',
        'value.confirm',
        'value.release',
        'value_report.send',
      ].sort(),
    );
  });

  it.each(bindingTools.map((tool) => [tool.key, tool] as const))(
    'T1-MA2 %s: ohne Token bricht der Lauf ab und legt einen Entwurf an',
    async (key, tool) => {
      const runId = await startRun(ownerOf(tool));
      const objectId = randomUUID();
      let performed = false;
      const outcome = await withTenant(db, { ...anna, runId }, (tx) =>
        runTool(tx, toolCall(tool, runId, objectId, null), async () => {
          performed = true;
        }),
      );
      expect(outcome.status, key).toBe('draft');
      expect(performed, key).toBe(false);
      expect(await draftsOf(objectId)).toEqual([
        { kind: 'binding_request', subject: key, run_id: runId, created_by: users.anna },
      ]);
      expect(await runOf(runId)).toEqual({ status: 'cancelled' });
      expect(await stepsOf(runId)).toEqual([
        { title: bindingStepTitle, tool_key: key, status: 'failed' },
      ]);
    },
  );

  it('mit dem Token der Person für genau dieses Werkzeug und Objekt läuft es genau einmal', async () => {
    const tool = bindingTools.find((entry) => entry.key === 'commitment.create_buyer');
    if (!tool) throw new Error('Werkzeug fehlt');
    const objectId = randomUUID();
    const token = await issue(anna, tool.key, objectId);
    const runId = await startRun('inbox');
    let performed = 0;
    const perform = async () => {
      performed += 1;
      return 'zugesagt';
    };
    const first = await withTenant(db, { ...anna, runId }, (tx) =>
      runTool(tx, toolCall(tool, runId, objectId, token), perform),
    );
    expect(first).toEqual({ status: 'done', value: 'zugesagt' });
    expect(performed).toBe(1);
    expect(await runOf(runId)).toEqual({ status: 'running' });
    // Verbraucht: ein zweites Mal gilt dasselbe Token nicht
    const again = await withTenant(db, { ...anna, runId }, (tx) =>
      runTool(tx, toolCall(tool, runId, objectId, token), perform),
    );
    expect(again.status).toBe('draft');
    expect(performed).toBe(1);
  });

  it('scheitert das Werkzeug selbst, bleibt das Token unverbraucht', async () => {
    const tool = bindingTools.find((entry) => entry.key === 'mail.send');
    if (!tool) throw new Error('Werkzeug fehlt');
    const objectId = randomUUID();
    const token = await issue(anna, tool.key, objectId);
    const runId = await startRun('inbox');
    await expect(
      withTenant(db, { ...anna, runId }, (tx) =>
        runTool(tx, toolCall(tool, runId, objectId, token), async () => {
          throw new Error('Versand gescheitert');
        }),
      ),
    ).rejects.toThrow('Versand gescheitert');
    const retried = await withTenant(db, { ...anna, runId }, (tx) =>
      runTool(tx, toolCall(tool, runId, objectId, token), async () => 'gesendet'),
    );
    expect(retried).toEqual({ status: 'done', value: 'gesendet' });
  });

  it('kein Token gilt für eine andere Person, ein anderes Objekt, ein anderes Werkzeug oder nach Ablauf', async () => {
    const tool = bindingTools.find((entry) => entry.key === 'value.release');
    if (!tool) throw new Error('Werkzeug fehlt');
    const objectId = randomUUID();
    const tokens = {
      // Bert hat bestätigt, der Lauf handelt für Anna
      otherPerson: await issue(bert, tool.key, objectId),
      otherObject: await issue(anna, tool.key, randomUUID()),
      otherTool: await issue(anna, 'value.confirm', objectId),
      // vor einer Stunde ausgestellt, 15 Minuten gültig
      expired: await issue(anna, tool.key, objectId, new Date(Date.now() - 3_600_000)),
      none: randomUUID(),
    };
    for (const [name, token] of Object.entries(tokens)) {
      const runId = await startRun('value_booking');
      let performed = false;
      const outcome = await withTenant(db, { ...anna, runId }, (tx) =>
        runTool(tx, toolCall(tool, runId, objectId, token), async () => {
          performed = true;
        }),
      );
      expect(outcome.status, name).toBe('draft');
      expect(performed, name).toBe(false);
    }
  });

  it('ein Werkzeug ohne Bindung läuft ohne Token', async () => {
    const tool = workers.flatMap((worker) => worker.tools).find((entry) => !entry.binding);
    if (!tool) throw new Error('Werkzeug fehlt');
    const runId = await startRun('inbox');
    const outcome = await withTenant(db, { ...anna, runId }, (tx) =>
      runTool(tx, toolCall(tool, runId, randomUUID(), null), async () => 'erledigt'),
    );
    expect(outcome).toEqual({ status: 'done', value: 'erledigt' });
  });

  it('der Entwurf ist im Fokus eine Freigabe oder Entscheidung, nie in Kurz prüfen; er führt ins Warum des Laufs', async () => {
    const tool = bindingTools.find((entry) => entry.key === 'agenda.release');
    if (!tool) throw new Error('Werkzeug fehlt');
    const runId = await startRun('meeting_brief');
    const objectId = randomUUID();
    const title = `Agenda freigeben ${run}`;
    await withTenant(db, { ...anna, runId }, (tx) =>
      runTool(
        tx,
        { ...toolCall(tool, runId, objectId, null), summary: title },
        async () => undefined,
      ),
    );
    const all = todayAllSchema.parse(await call(users.anna, '/heute/alles'));
    const topic = all.forYou.find((entry) => entry.title === title);
    expect(topic).toMatchObject({ level: 'focus', kind: 'approval', href: `/warum/${runId}` });
    const stack = reviewStackSchema.parse(await call(users.anna, '/kurz-pruefen'));
    expect(stack.items.some((item) => item.title === title)).toBe(false);
  });

  it('intern bindend ist eine Entscheidung, gegenüber dem Lieferanten eine Freigabe', () => {
    const draft = (subject: string): DraftRow => ({
      id: randomUUID(),
      kind: 'binding_request',
      objectType: 'initiative',
      objectId: randomUUID(),
      relationshipId: null,
      subject,
      content: 'Wirkung freigeben',
      claims: null,
      reviewSeconds: null,
      counterpart: null,
      href: null,
    });
    expect(fromDraft(draft('value.release'), 'de')).toMatchObject({
      level: 'focus',
      kind: 'decision',
      title: 'Wirkung freigeben',
    });
    expect(fromDraft(draft('deal.send'), 'de')).toMatchObject({ level: 'focus', kind: 'approval' });
  });
});
