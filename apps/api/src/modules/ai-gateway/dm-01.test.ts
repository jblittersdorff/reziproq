import { randomUUID } from 'node:crypto';
import { type Database, schema, sql } from '@reziproq/db';
import { aiSettingsResponseSchema } from '@reziproq/shared';
import { generateText, type LanguageModel } from 'ai';
import { MockLanguageModelV4 } from 'ai/test';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { startTestApp } from '../../testing/test-app.js';
import { ModelGateway } from './model-gateway.js';
import { inputHash, withIds, withPlaceholders } from './recording.js';

// DM-01, KI-01 (K1-b.1), T1-DM1: Tests laufen mit fake; replay liefert bei gleicher Eingabe dieselbe
// Antwort, auch wenn die IDs nach „Zurücksetzen“ andere sind; nur Demo-Mandanten weichen von live
// ab und schalten den Modus um, und nur sie haben Aufzeichnungen.

const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;

describe('DM-01 Platzhalter und Hash der Eingabe', () => {
  const prompt = (id: string, text = 'Lage') => [
    { role: 'user' as const, content: [{ type: 'text' as const, text: `${text} zu ${id}` }] },
  ];

  it('gleiche Eingabe mit anderen IDs hat denselben Hash; anderer Text einen anderen', () => {
    const a = inputHash('pre_read', { prompt: prompt(randomUUID()) });
    const b = inputHash('pre_read', { prompt: prompt(randomUUID()) });
    const c = inputHash('pre_read', { prompt: prompt(randomUUID(), 'Risiken') });
    const d = inputHash('meeting_capture', { prompt: prompt(randomUUID()) });
    expect(a.hash).toBe(b.hash);
    expect(c.hash).not.toBe(a.hash);
    expect(d.hash).not.toBe(a.hash);
  });

  it('IDs der Eingabe werden zu Platzhaltern und kommen beim Abspielen als neue IDs zurück', () => {
    const [first, second, foreign] = [randomUUID(), randomUUID(), randomUUID()];
    const { ids } = withPlaceholders(`${first} und ${second}`);
    // In der Antwort nur bekannte IDs; eine fremde bleibt stehen
    const stored = withPlaceholders(`${second} vor ${first}, ${foreign}`, ids, false).text;
    expect(stored).toBe(`⟦id2⟧ vor ⟦id1⟧, ${foreign}`);
    const [next1, next2] = [randomUUID(), randomUUID()];
    const { ids: now } = withPlaceholders(`${next1} und ${next2}`);
    expect(withIds(stored, now)).toBe(`${next2} vor ${next1}, ${foreign}`);
  });
});

describe('DM-01 Gateway-Modi im Demo-Mandanten (T1-DM1)', () => {
  let app: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  let gateway: ModelGateway;
  const run = randomUUID().slice(0, 8);
  const orgs = { demo: randomUUID(), normal: randomUUID() };
  const users = {
    demoAdmin: `dm01-adm-${run}`,
    demoMember: `dm01-mit-${run}`,
    normalAdmin: `dm01-nadm-${run}`,
  };
  let answer: string;
  let modelCalls: number;

  const mock = () =>
    new MockLanguageModelV4({
      doGenerate: async (options) => {
        modelCalls += 1;
        const id = JSON.stringify(options.prompt).match(uuidPattern)?.[0] ?? 'ohne ID';
        return {
          content: [{ type: 'text', text: `${answer} zu ${id}` }],
          finishReason: { unified: 'stop', raw: undefined },
          usage: {
            inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
            outputTokens: { total: 5, text: 5, reasoning: 0 },
          },
          warnings: [],
        };
      },
    });
  /** Ein Aufruf wie in den Diensten: mit Modell generateText, ohne das feste Testmodell */
  const ask = (orgId: string, userId: string, text: string) =>
    gateway.call({ orgId, userId, feature: 'pre_read' }, async (model: LanguageModel | null) => {
      if (!model) return { value: 'Testmodell', usage: { inputTokens: 1, outputTokens: 1 } };
      const result = await generateText({ model, prompt: text, maxRetries: 0 });
      return {
        value: result.text,
        usage: {
          inputTokens: result.usage.inputTokens ?? 0,
          outputTokens: result.usage.outputTokens ?? 0,
        },
      };
    });
  const setMode = (mode: string) =>
    db.execute(sql`update organization set ai_mode = ${mode} where id = ${orgs.demo}`);
  const recordings = async () =>
    (
      await db.execute<{ feature: string; response: unknown }>(
        sql`select feature, response from model_call_recording where org_id = ${orgs.demo}`,
      )
    ).rows;
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

  beforeAll(async () => {
    app = await startTestApp();
    db = app.adminDb;
    gateway = app.app.get(ModelGateway);
    await db.insert(schema.organization).values([
      { id: orgs.demo, name: `DM01 Demo ${run}`, isDemo: true },
      { id: orgs.normal, name: `DM01 Kunde ${run}` },
    ]);
    await db.insert(schema.organizationFeature).values([
      { organizationId: orgs.demo, feature: 'buyer' },
      { organizationId: orgs.normal, feature: 'buyer' },
    ]);
    const person = (id: string, org: string, orgRole: 'admin' | 'member') => ({
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
        person(users.demoAdmin, orgs.demo, 'admin'),
        person(users.demoMember, orgs.demo, 'member'),
        person(users.normalAdmin, orgs.normal, 'admin'),
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
    await db.execute(sql`delete from org_setting where org_id in ${ids}`);
    await db.execute(sql`delete from app_user where organization_id in ${ids}`);
    await db.execute(sql`delete from organization_feature where organization_id in ${ids}`);
    await db.execute(sql`delete from organization where id in ${ids}`);
    await app.close();
  });

  it('Tests laufen mit fake: ohne Modell im Gateway nimmt der Aufrufer sein festes Testmodell', async () => {
    gateway.testModel = null;
    expect(await ask(orgs.normal, users.normalAdmin, `Lage zu ${randomUUID()}`)).toBe('Testmodell');
  });

  it('record ruft live auf und zeichnet auf; replay liefert dieselbe Antwort mit den neuen IDs', async () => {
    await setMode('record');
    const first = randomUUID();
    expect(await ask(orgs.demo, users.demoAdmin, `Lage zu ${first}`)).toBe(`Antwort A zu ${first}`);
    expect(modelCalls).toBe(1);
    const stored = await recordings();
    expect(stored).toHaveLength(1);
    expect(JSON.stringify(stored[0]?.response)).toContain('⟦id1⟧');
    expect(JSON.stringify(stored[0]?.response)).not.toContain(first);

    await setMode('replay');
    answer = 'Antwort B';
    const second = randomUUID();
    // Gleiche Eingabe, neue ID: aus der Aufzeichnung, ohne Modellaufruf
    expect(await ask(orgs.demo, users.demoAdmin, `Lage zu ${second}`)).toBe(
      `Antwort A zu ${second}`,
    );
    expect(await ask(orgs.demo, users.demoAdmin, `Lage zu ${second}`)).toBe(
      `Antwort A zu ${second}`,
    );
    expect(modelCalls).toBe(1);
    // Andere Eingabe: live
    expect(await ask(orgs.demo, users.demoAdmin, `Risiken zu ${second}`)).toBe(
      `Antwort B zu ${second}`,
    );
    expect(modelCalls).toBe(2);
    // Abgespielt kostet nichts
    const [cost] = (
      await db.execute<{ cost: number }>(
        sql`select cost_microcents::int as cost from model_call where org_id = ${orgs.demo}
            order by created_at desc, id desc limit 1 offset 1`,
      )
    ).rows;
    expect(Number(cost?.cost ?? -1)).toBe(0);
  });

  it('replay ohne Aufzeichnung und ohne Modell nimmt das Testmodell; fake immer das Testmodell', async () => {
    await setMode('replay');
    gateway.testModel = null;
    expect(await ask(orgs.demo, users.demoAdmin, `Neu zu ${randomUUID()}`)).toBe('Testmodell');
    gateway.testModel = mock();
    await setMode('fake');
    expect(await ask(orgs.demo, users.demoAdmin, `Lage zu ${randomUUID()}`)).toBe('Testmodell');
    expect(modelCalls).toBe(0);
    await setMode('live');
  });

  it('nur Demo-Mandanten weichen von live ab und haben Aufzeichnungen', async () => {
    await expect(
      db.execute(sql`update organization set ai_mode = 'replay' where id = ${orgs.normal}`),
    ).rejects.toMatchObject({ cause: { constraint: 'organization_demo_modus' } });
    // Ein normaler Mandant ruft live auf und zeichnet nichts auf
    expect(await ask(orgs.normal, users.normalAdmin, `Lage zu ${randomUUID()}`)).toMatch(
      /^Antwort A zu /,
    );
    const foreign = await db.execute(
      sql`select 1 from model_call_recording where org_id = ${orgs.normal}`,
    );
    expect(foreign.rows).toEqual([]);
  });

  it('Admins des Demo-Mandanten schalten den Modus um; anderswo gibt es das nicht (404)', async () => {
    const changed = await call(users.demoAdmin, 'PUT', '/einstellungen/ki/modus', {
      mode: 'replay',
    });
    expect(changed).toMatchObject({ status: 200, body: { mode: 'replay' } });
    const settings = aiSettingsResponseSchema.parse(
      (await call(users.demoAdmin, 'GET', '/einstellungen/ki')).body,
    );
    expect(settings.demo).toEqual({ mode: 'replay' });
    // Kein Demo-Mandant: 404, und die Einstellungen zeigen keinen Modus
    expect(
      (await call(users.normalAdmin, 'PUT', '/einstellungen/ki/modus', { mode: 'replay' })).status,
    ).toBe(404);
    expect(
      aiSettingsResponseSchema.parse(
        (await call(users.normalAdmin, 'GET', '/einstellungen/ki')).body,
      ).demo,
    ).toBeNull();
    // Mitglieder schalten nicht um; kein unbekannter Modus
    expect(
      (await call(users.demoMember, 'PUT', '/einstellungen/ki/modus', { mode: 'live' })).status,
    ).toBe(403);
    expect(
      (await call(users.demoAdmin, 'PUT', '/einstellungen/ki/modus', { mode: 'immer' })).status,
    ).toBe(400);
    await setMode('live');
  });
});
