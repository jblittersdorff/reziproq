import { randomUUID } from 'node:crypto';
import { type Database, schema, sql } from '@reziproq/db';
import { aiSettingsResponseSchema, aiUsageSchema, defaultAiSettings } from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { env } from '../../config/env.js';
import { startTestApp } from '../../testing/test-app.js';
import { BudgetExhaustedError, RegionRejectedError } from './gateway-errors.js';
import { ModelGateway } from './model-gateway.js';

// Tests zu docs/specs/KI-01.md: Gateway mit genau einer Zeile je Aufruf, EU-Pflicht, Monatsbudget,
// Verbrauch je Funktion, Trennung der Kunden und kein Zugang für den Lieferanten.
describe('KI-01 Modell-Gateway und Kontingent', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  let gateway: ModelGateway;
  const run = randomUUID().slice(0, 8);
  const orgs = { a: randomUUID(), b: randomUUID(), supplier: randomUUID() };
  const users = {
    adminA: `ki01-adm-a-${run}`,
    memberA: `ki01-mem-a-${run}`,
    adminB: `ki01-adm-b-${run}`,
    supplier: `ki01-sup-${run}`,
  };

  const call = async (user: string, method: string, url: string, body?: unknown) => {
    const response = await fetch(`${testApp.baseUrl}/api${url}`, {
      method,
      headers: {
        authorization: `Bearer ${await testApp.signToken({ subject: user })}`,
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: (await response.json().catch(() => null)) as unknown };
  };
  const rowsOf = (orgId: string) =>
    db.select().from(schema.modelCall).where(sql`${schema.modelCall.orgId} = ${orgId}`);
  const usage = async (user: string) =>
    aiUsageSchema.parse((await call(user, 'GET', '/ki/kontingent')).body);
  const fakeWork =
    (input = 1_000, output = 200) =>
    async (model: unknown) => {
      expect(model).toBeNull();
      return { value: 'Antwort', usage: { inputTokens: input, outputTokens: output } };
    };

  beforeAll(async () => {
    testApp = await startTestApp();
    db = testApp.adminDb;
    gateway = testApp.app.get(ModelGateway);
    await db.insert(schema.organization).values([
      { id: orgs.a, name: `KI01-A ${run}` },
      { id: orgs.b, name: `KI01-B ${run}` },
      { id: orgs.supplier, name: `KI01-Lieferant ${run}` },
    ]);
    await db.insert(schema.organizationFeature).values([
      { organizationId: orgs.a, feature: 'buyer' },
      { organizationId: orgs.b, feature: 'buyer' },
    ]);
    const person = (id: string, organizationId: string, orgRole: 'admin' | 'member') => ({
      id,
      name: id,
      email: `${id}@example.com`,
      organizationId,
      orgRole,
      rolesImportedAt: new Date(),
    });
    await db
      .insert(schema.appUser)
      .values([
        person(users.adminA, orgs.a, 'admin'),
        person(users.memberA, orgs.a, 'member'),
        person(users.adminB, orgs.b, 'admin'),
        person(users.supplier, orgs.supplier, 'admin'),
      ]);
  });

  afterAll(async () => {
    const orgIds = Object.values(orgs);
    await db.execute(sql`delete from outbox_event where org_id in ${orgIds}`);
    await db.execute(sql`delete from model_call where org_id in ${orgIds}`);
    await db.execute(sql`delete from org_setting where org_id in ${orgIds}`);
    await db.execute(sql`delete from app_user where organization_id in ${orgIds}`);
    await db.execute(sql`delete from organization_feature where organization_id in ${orgIds}`);
    await db.execute(sql`delete from organization where id in ${orgIds}`);
    await testApp.close();
  });

  it('jeder Modellaufruf erzeugt genau eine Zeile mit Kosten und Region; fake ohne Netzwerk', async () => {
    const before = (await rowsOf(orgs.a)).length;
    const value = await gateway.call(
      { orgId: orgs.a, userId: users.memberA, feature: 'feedback_themes' },
      fakeWork(1_000, 200),
    );
    expect(value).toBe('Antwort');
    const rows = await rowsOf(orgs.a);
    expect(rows).toHaveLength(before + 1);
    expect(rows.at(-1)).toMatchObject({
      feature: 'feedback_themes',
      modelClass: 'small',
      provider: 'fake',
      modelId: 'fake-small',
      region: 'eu-local',
      outcome: 'ok',
      inputTokens: 1_000,
      outputTokens: 200,
      // Haiku-Preis: 10 bzw. 50 Mikrocent je Token
      costMicrocents: 1_000 * 10 + 200 * 50,
    });
  });

  it('auch ein fehlgeschlagener Aufruf ist genau eine Zeile, ohne Kosten', async () => {
    const before = (await rowsOf(orgs.a)).length;
    await expect(
      gateway.call({ orgId: orgs.a, userId: users.memberA, feature: 'pre_read' }, async () => {
        throw new Error('Modell nicht erreichbar');
      }),
    ).rejects.toThrow('Modell nicht erreichbar');
    const rows = await rowsOf(orgs.a);
    expect(rows).toHaveLength(before + 1);
    expect(rows.at(-1)).toMatchObject({ outcome: 'failed', costMicrocents: 0 });
  });

  it('ein Aufruf außerhalb der EU wird abgelehnt und protokolliert', async () => {
    const provider = env.AI_PROVIDER;
    let called = false;
    (env as { AI_PROVIDER: string }).AI_PROVIDER = 'anthropic';
    try {
      await expect(
        gateway.call({ orgId: orgs.a, userId: users.memberA, feature: 'prompt' }, async () => {
          called = true;
          return { value: 'x', usage: { inputTokens: 1, outputTokens: 1 } };
        }),
      ).rejects.toBeInstanceOf(RegionRejectedError);
    } finally {
      (env as { AI_PROVIDER: string }).AI_PROVIDER = provider;
    }
    expect(called).toBe(false);
    expect((await rowsOf(orgs.a)).at(-1)).toMatchObject({
      provider: 'anthropic',
      region: 'us',
      outcome: 'rejected_region',
      costMicrocents: 0,
    });
  });

  it('ist das Monatsbudget erreicht, wird ein neuer Aufruf abgelehnt', async () => {
    const settings = { ...defaultAiSettings, budgetMonthCents: 1 };
    expect((await call(users.adminA, 'PUT', '/einstellungen/ki', settings)).status).toBe(200);
    // 1 Cent = 1.000.000 Mikrocent; der vorherige Aufruf hat 20.000 verbraucht
    await gateway.call(
      { orgId: orgs.a, userId: users.memberA, feature: 'market_analysis' },
      fakeWork(2_000, 500),
    );
    let called = false;
    await expect(
      gateway.call({ orgId: orgs.a, userId: users.memberA, feature: 'prompt' }, async () => {
        called = true;
        return { value: 'x', usage: { inputTokens: 1, outputTokens: 1 } };
      }),
    ).rejects.toBeInstanceOf(BudgetExhaustedError);
    expect(called).toBe(false);
    expect((await rowsOf(orgs.a)).at(-1)).toMatchObject({ outcome: 'rejected_budget' });
    expect((await call(users.adminA, 'PUT', '/einstellungen/ki', defaultAiSettings)).status).toBe(
      200,
    );
  });

  it('zeigt Admins ab 80 Prozent eine Aufgabe in Mein Tag', async () => {
    const settings = { ...defaultAiSettings, budgetMonthCents: 10 };
    expect((await call(users.adminA, 'PUT', '/einstellungen/ki', settings)).status).toBe(200);
    try {
      await gateway.call(
        { orgId: orgs.a, userId: users.memberA, feature: 'market_analysis' },
        fakeWork(0, 4_000),
      );
      const admin = await call(users.adminA, 'GET', '/start/due');
      expect(admin.status).toBe(200);
      expect(admin.body).toMatchObject({
        items: expect.arrayContaining([
          expect.objectContaining({ kind: 'ai_budget', href: '/einstellungen/ki' }),
        ]),
      });
      const member = await call(users.memberA, 'GET', '/start/due');
      expect(member.status).toBe(200);
      expect(member.body).not.toMatchObject({
        items: expect.arrayContaining([expect.objectContaining({ kind: 'ai_budget' })]),
      });
    } finally {
      await call(users.adminA, 'PUT', '/einstellungen/ki', defaultAiSettings);
    }
  });

  it('der Verbrauch je Funktion stimmt mit der Summe der Zeilen überein', async () => {
    const data = await usage(users.adminA);
    const rows = await rowsOf(orgs.a);
    const sum = (feature: string) =>
      rows.filter((row) => row.feature === feature).reduce((s, row) => s + row.costMicrocents, 0);
    for (const entry of data.byFeature ?? []) {
      expect(entry.costCents).toBe(Math.ceil(sum(entry.feature) / 1_000_000));
      expect(entry.calls).toBe(
        rows.filter((row) => row.feature === entry.feature && row.outcome === 'ok').length,
      );
    }
    expect(data.byFeature?.map((entry) => entry.feature).sort()).toEqual(
      [...new Set(rows.map((row) => row.feature))].sort(),
    );
    expect(data.calls).toBe(rows.filter((row) => row.outcome === 'ok').length);
    expect(data.budgetMonthCents).toBe(15_000);
    // Nutzer ohne Adminrolle sehen nur das Kontingent, nicht die Aufteilung
    const member = await usage(users.memberA);
    expect(member.byFeature).toBeNull();
    expect(member.usedCents).toBe(data.usedCents);
  });

  it('Kunde A sieht keinen Verbrauch von Kunde B', async () => {
    const data = await usage(users.adminB);
    expect(data).toMatchObject({ calls: 0, usedCents: 0, byFeature: [] });
    const settings = aiSettingsResponseSchema.parse(
      (await call(users.adminB, 'GET', '/einstellungen/ki')).body,
    );
    expect(settings.settings).toEqual(defaultAiSettings);
  });

  it('nur Admins ändern die Einstellungen; die Verarbeitung in der EU ist immer an', async () => {
    expect((await call(users.memberA, 'PUT', '/einstellungen/ki', defaultAiSettings)).status).toBe(
      403,
    );
    const changed = { ...defaultAiSettings, publicResearch: true, maxSteps: 40 };
    const saved = aiSettingsResponseSchema.parse(
      (await call(users.adminA, 'PUT', '/einstellungen/ki', changed)).body,
    );
    expect(saved).toMatchObject({ euOnly: true, settings: { publicResearch: true, maxSteps: 40 } });
    expect(
      (await call(users.adminA, 'PUT', '/einstellungen/ki', { ...changed, euOnly: false })).status,
    ).toBe(200);
    expect(
      aiSettingsResponseSchema.parse((await call(users.adminA, 'GET', '/einstellungen/ki')).body)
        .euOnly,
    ).toBe(true);
  });

  it('der Test-Lieferant sieht weder Einstellungen noch Verbrauch', async () => {
    expect((await call(users.supplier, 'GET', '/einstellungen/ki')).status).toBe(403);
    expect((await call(users.supplier, 'GET', '/ki/kontingent')).status).toBe(403);
    expect((await call(users.supplier, 'PUT', '/einstellungen/ki', defaultAiSettings)).status).toBe(
      403,
    );
  });
});
