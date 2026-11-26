import { randomUUID } from 'node:crypto';
import { type Database, schema, sql } from '@reziproq/db';
import { type PromptEvent, promptEventSchema } from '@reziproq/shared';
import { simulateReadableStream } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startTestApp } from '../../testing/test-app.js';
import { ModelGateway } from '../ai-gateway/model-gateway.js';
import { PromptLog } from './prompt-log.js';

// DM-01 (K1-b.6): Frag Reziproq folgt dem Modus des Demo-Mandanten. record zeichnet die gestreamte
// Antwort auf; replay spielt sie ohne Modellaufruf und ohne Tokens wieder ab, auch mit neuen IDs;
// ohne Aufzeichnung und ohne Modell antwortet das Testmodell. Mandanten ohne Demo bleiben live.

const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;
const testModelAnswer =
  'Ich beantworte Fragen zu deinen Lieferanten und öffne Bereiche von Reziproq.';

describe('DM-01 Frag Reziproq im Demo-Mandanten (K1-b.6)', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  let gateway: ModelGateway;
  const run = randomUUID().slice(0, 8);
  const orgs = { demo: randomUUID(), normal: randomUUID() };
  const users = { demo: `dm01f-demo-${run}`, normal: `dm01f-kunde-${run}` };
  let answer: string;
  let modelCalls: number;

  /** Streamt „<answer> zu <ID aus der letzten Frage>“ und zählt die Aufrufe */
  const mock = () =>
    new MockLanguageModelV4({
      doStream: async (options) => {
        modelCalls += 1;
        const question = options.prompt.filter((message) => message.role === 'user').at(-1);
        const id = JSON.stringify(question ?? '').match(uuidPattern)?.[0] ?? 'ohne ID';
        return {
          stream: simulateReadableStream({
            chunks: [
              { type: 'stream-start' as const, warnings: [] },
              { type: 'text-start' as const, id: 't1' },
              { type: 'text-delta' as const, id: 't1', delta: `${answer} ` },
              { type: 'text-delta' as const, id: 't1', delta: `zu ${id}` },
              { type: 'text-end' as const, id: 't1' },
              {
                type: 'finish' as const,
                finishReason: { unified: 'stop' as const, raw: undefined },
                usage: {
                  inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
                  outputTokens: { total: 5, text: 5, reasoning: 0 },
                },
              },
            ],
          }),
        };
      },
    });

  const token = (user: string) =>
    testApp.signToken({
      subject: user,
      claims: { 'urn:zitadel:iam:org:project:test-project:roles': { nutzer: { '1': 'test' } } },
    });
  /** Stellt eine Frage und liest den gestreamten Text */
  const ask = async (user: string, question: string) => {
    const res = await testApp.post(
      '/api/prompt',
      { messages: [{ role: 'user', content: question }] },
      await token(user),
    );
    expect(res.status).toBe(200);
    const events: PromptEvent[] = (await res.text())
      .trim()
      .split('\n')
      .map((line) => promptEventSchema.parse(JSON.parse(line)));
    expect(events.at(-1)).toEqual({ type: 'done' });
    return events.map((event) => (event.type === 'text' ? event.delta : '')).join('');
  };
  const setMode = (mode: string) =>
    db.execute(sql`update organization set ai_mode = ${mode} where id = ${orgs.demo}`);
  const recordings = async (orgId: string) =>
    (
      await db.execute<{ response: unknown }>(
        sql`select response from model_call_recording where org_id = ${orgId} and feature = 'prompt'`,
      )
    ).rows;

  beforeAll(async () => {
    testApp = await startTestApp({
      configure: (builder) => builder.overrideProvider(PromptLog).useValue({ write: () => {} }),
    });
    db = testApp.adminDb;
    gateway = testApp.app.get(ModelGateway);
    await db.insert(schema.organization).values([
      { id: orgs.demo, name: `DM01F Demo ${run}`, isDemo: true },
      { id: orgs.normal, name: `DM01F Kunde ${run}` },
    ]);
    await db.insert(schema.organizationFeature).values([
      { organizationId: orgs.demo, feature: 'buyer' },
      { organizationId: orgs.normal, feature: 'buyer' },
    ]);
    await db.insert(schema.appUser).values([
      {
        id: users.demo,
        name: 'Dana Demo',
        email: `${users.demo}@example.com`,
        organizationId: orgs.demo,
      },
      {
        id: users.normal,
        name: 'Kai Kunde',
        email: `${users.normal}@example.com`,
        organizationId: orgs.normal,
      },
    ]);
  });

  beforeEach(() => {
    answer = 'Antwort A';
    modelCalls = 0;
    gateway.testModel = mock();
  });

  afterAll(async () => {
    gateway.testModel = null;
    const ids = Object.values(orgs);
    await db.execute(sql`delete from model_call_recording where org_id in ${ids}`);
    await db.execute(sql`delete from model_call where org_id in ${ids}`);
    await db.execute(sql`delete from app_user where organization_id in ${ids}`);
    await db.execute(sql`delete from organization_feature where organization_id in ${ids}`);
    await db.execute(sql`delete from organization where id in ${ids}`);
    await testApp.close();
  });

  it('record zeichnet die gestreamte Antwort auf; replay spielt sie ohne Modellaufruf ab, auch mit neuen IDs', async () => {
    await setMode('record');
    const first = randomUUID();
    expect(await ask(users.demo, `Lage zu ${first}`)).toBe(`Antwort A zu ${first}`);
    expect(modelCalls).toBe(1);
    const stored = await recordings(orgs.demo);
    expect(stored).toHaveLength(1);
    expect(JSON.stringify(stored[0]?.response)).toContain('⟦id');
    expect(JSON.stringify(stored[0]?.response)).not.toContain(first);

    await setMode('replay');
    answer = 'Antwort B';
    const second = randomUUID();
    // Gleiche Frage mit neuer ID: aus der Aufzeichnung, ohne Modellaufruf
    expect(await ask(users.demo, `Lage zu ${second}`)).toBe(`Antwort A zu ${second}`);
    expect(modelCalls).toBe(1);
    // Andere Frage: live
    expect(await ask(users.demo, `Risiken zu ${second}`)).toBe(`Antwort B zu ${second}`);
    expect(modelCalls).toBe(2);
    // Abgespielt: keine Tokens, keine Kosten; aufgezeichnet und live mit Tokens
    const calls = (
      await db.execute<{ input: number; cost: number }>(sql`
        select input_tokens::int as input, cost_microcents::int as cost from model_call
        where org_id = ${orgs.demo} and feature = 'prompt' and outcome = 'ok'
        order by created_at, id`)
    ).rows;
    expect(calls.map((call) => Number(call.input))).toEqual([10, 0, 10]);
    expect(Number(calls[1]?.cost ?? -1)).toBe(0);
    await setMode('live');
  });

  it('replay ohne Aufzeichnung und ohne Modell: das Testmodell; fake: immer das Testmodell', async () => {
    await setMode('replay');
    gateway.testModel = null;
    expect(await ask(users.demo, `Neu zu ${randomUUID()}`)).toBe(testModelAnswer);
    gateway.testModel = mock();
    await setMode('fake');
    expect(await ask(users.demo, `Lage zu ${randomUUID()}`)).toBe(testModelAnswer);
    expect(modelCalls).toBe(0);
    await setMode('live');
  });

  it('ohne Demo: live über das Modell, keine Aufzeichnung', async () => {
    const id = randomUUID();
    expect(await ask(users.normal, `Lage zu ${id}`)).toBe(`Antwort A zu ${id}`);
    expect(modelCalls).toBe(1);
    expect(await recordings(orgs.normal)).toEqual([]);
  });
});
