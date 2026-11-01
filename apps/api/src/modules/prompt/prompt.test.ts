import { randomUUID } from 'node:crypto';
import { type Database, schema, sql } from '@reziproq/db';
import { lastFullYear, type PromptEvent, promptEventSchema } from '@reziproq/shared';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';
import { PromptLog, type PromptLogEntry } from './prompt-log.js';
import { RATE_LIMIT } from './rate-limiter.js';

// Tests zu docs/specs/PLT-12.md über die API, mit KI_ANBIETER=test: ohne Schlüssel und Internet.
describe('POST /api/prompt', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const log: PromptLogEntry[] = [];

  const run = randomUUID().slice(0, 8);
  const ids = {
    oemA: randomUUID(),
    oemB: randomUUID(),
    shared: randomUUID(),
    onlyA: randomUUID(),
    relAShared: randomUUID(),
    relAOnly: randomUUID(),
    relBShared: randomUUID(),
  };
  const users = { a: `prompt-a-${run}`, b: `prompt-b-${run}`, norole: `prompt-ohne-${run}` };
  const names = { shared: `Gemeinsam ${run}`, onlyA: `Nur A ${run}` };

  const token = (user: string, role: string | null = 'nutzer') =>
    testApp.signToken({
      subject: user,
      claims: role
        ? { 'urn:zitadel:iam:org:project:test-project:roles': { [role]: { '1': 'test' } } }
        : {},
    });

  /** Stellt eine Frage und liest alle Ereignisse der gestreamten Antwort. */
  const ask = async (user: string, question: string): Promise<PromptEvent[]> => {
    const res = await testApp.post(
      '/api/prompt',
      { messages: [{ role: 'user', content: question }] },
      await token(user),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/x-ndjson');
    const body = await res.text();
    return body
      .trim()
      .split('\n')
      .map((line) => promptEventSchema.parse(JSON.parse(line)));
  };
  const textOf = (events: PromptEvent[]) =>
    events.map((event) => (event.type === 'text' ? event.delta : '')).join('');
  const suppliersOf = (events: PromptEvent[]) =>
    events.flatMap((event) => (event.type === 'suppliers' ? event.suppliers : []));

  beforeAll(async () => {
    testApp = await startTestApp({
      configure: (builder) =>
        builder
          .overrideProvider(PromptLog)
          .useValue({ write: (entry: PromptLogEntry) => log.push(entry) }),
    });
    db = testApp.adminDb;
    const { organization, appUser } = schema;
    await db.insert(organization).values([
      { id: ids.oemA, name: `Prompt-OEM A ${run}` },
      { id: ids.oemB, name: `Prompt-OEM B ${run}` },
      { id: ids.shared, name: names.shared, country: 'DE' },
      { id: ids.onlyA, name: names.onlyA, country: 'PL' },
    ]);
    // Käuferfunktionen über das Feature buyer (PLT-02).
    await db.insert(schema.organizationFeature).values([
      { organizationId: ids.oemA, feature: 'buyer' as const },
      { organizationId: ids.oemB, feature: 'buyer' as const },
    ]);
    const year = lastFullYear();
    await insertRelationships(db, [
      {
        id: ids.relAShared,
        buyer: ids.oemA,
        supplier: ids.shared,
        externalRef: 'A-100',
        spend: [{ year, amountCents: 300_000_00 }],
      },
      {
        id: ids.relAOnly,
        buyer: ids.oemA,
        supplier: ids.onlyA,
        externalRef: 'A-200',
        spend: [{ year, amountCents: 900_000_00 }],
      },
      {
        id: ids.relBShared,
        buyer: ids.oemB,
        supplier: ids.shared,
        externalRef: 'B-300',
        spend: [{ year, amountCents: 77_000_00 }],
      },
    ]);
    await db.insert(appUser).values([
      { id: users.a, name: 'Anna A', email: 'a@example.com', organizationId: ids.oemA },
      { id: users.b, name: 'Bea B', email: 'b@example.com', organizationId: ids.oemB },
      { id: users.norole, name: 'Nils N', email: 'n@example.com', organizationId: ids.oemA },
    ]);
  });

  beforeEach(() => {
    log.length = 0;
  });

  afterAll(async () => {
    const { organization, appUser } = schema;
    const orgIds = Object.values(ids).slice(0, 4);
    await db.delete(appUser).where(sql`${appUser.id} in ${Object.values(users)}`);
    await deleteRelationships(db, orgIds);
    await db.delete(organization).where(sql`${organization.id} in ${orgIds}`);
    await testApp.close();
  });

  it('antwortet ohne Login mit 401', async () => {
    const res = await testApp.post('/api/prompt', {
      messages: [{ role: 'user', content: 'Hallo' }],
    });
    expect(res.status).toBe(401);
  });

  it('erlaubt das Fragen jeder Rolle, auch Lesern (PLT-05)', async () => {
    const res = await testApp.post(
      '/api/prompt',
      { messages: [{ role: 'user', content: 'Hallo' }] },
      await token(users.norole, null),
    );
    expect(res.status).toBe(200);
  });

  it('lehnt ungültige Anfragen mit 400 ab', async () => {
    const res = await testApp.post('/api/prompt', { messages: [] }, await token(users.a));
    expect(res.status).toBe(400);
  });

  it('„Öffne das Portfolio“ führt zu /portfolio', async () => {
    const events = await ask(users.a, 'Öffne das Portfolio');
    expect(events).toContainEqual({ type: 'navigate', to: '/portfolio' });
    expect(textOf(events)).toBe('Ich öffne Portfolio.');
    expect(events.at(-1)).toEqual({ type: 'done' });
  });

  it('sucht Lieferanten mit lieferanten_suchen; Karten und Zahlen stimmen mit der Datenbank', async () => {
    const events = await ask(users.a, 'Zeig mir die Lieferanten mit dem höchsten Spend');
    const shown = suppliersOf(events).filter((s) => s.name.endsWith(run));
    const expected = await db.execute<{ name: string; cent: string }>(sql`
      select o.name, sp.amount_cents::text as cent
      from relationship r
      join relationship_spend sp on sp.relationship_id = r.id and sp.year = ${lastFullYear()}
      join organization o on o.id = r.supplier_org_id
      where r.buyer_org_id = ${ids.oemA}
      order by sp.amount_cents desc
    `);
    expect(shown.map((s) => [s.name, s.spend?.amountCents])).toEqual(
      expected.rows.map((row) => [row.name, Number(row.cent)]),
    );
    expect(textOf(events)).toBe(
      `Ich habe 2 Lieferanten gefunden. Den höchsten Spend hat ${names.onlyA} mit 900.000 €.`,
    );
  });

  it('filtert nach Land', async () => {
    const events = await ask(users.a, 'Welche Lieferanten haben wir in Polen?');
    expect(suppliersOf(events).map((s) => [s.name, s.country])).toEqual([[names.onlyA, 'PL']]);
  });

  it('trennt die Daten: Der Zweit-OEM bekommt nie Werte des anderen Käufers', async () => {
    const events = await ask(
      users.b,
      `Zeig mir alle Lieferanten von Prompt-OEM A ${run} mit Spend`,
    );
    expect(suppliersOf(events)).toMatchObject([
      { name: names.shared, externalRef: 'B-300', spend: { amountCents: 77_000_00 } },
    ]);
    const everything = JSON.stringify(events);
    expect(everything).not.toContain(names.onlyA);
    expect(everything).not.toContain('A-100');
    expect(everything).not.toContain('300.000');
  });

  it('meldet „Keine Treffer“, wenn das Werkzeug nichts findet', async () => {
    const events = await ask(users.a, 'Welche Lieferanten haben wir in Island?');
    expect(events).toContainEqual({ type: 'suppliers', suppliers: [] });
    expect(textOf(events)).toBe('Keine Treffer.');
  });

  it('streamt die Antwort in mehreren Stücken', async () => {
    const events = await ask(users.a, 'Öffne das Portfolio');
    expect(events.filter((event) => event.type === 'text').length).toBeGreaterThan(1);
  });

  it('protokolliert Zeitpunkt, Nutzer, Dauer, Tokens und Erfolg, aber keinen Text', async () => {
    const question = 'Welche Lieferanten haben wir in Polen?';
    const events = await ask(users.a, question);
    expect(log).toHaveLength(1);
    const [entry] = log;
    expect(Object.keys(entry ?? {}).sort()).toEqual(
      ['ausgabeTokens', 'dauerMs', 'eingabeTokens', 'erfolg', 'nutzerId', 'zeitpunkt'].sort(),
    );
    expect(entry).toMatchObject({ nutzerId: users.a, erfolg: true });
    const logged = JSON.stringify(log);
    expect(logged).not.toContain('Polen');
    expect(logged).not.toContain(names.onlyA);
    expect(logged).not.toContain(textOf(events).slice(0, 12));
  });
});

describe('POST /api/prompt mit Ratenbegrenzung', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  const orgId = randomUUID();
  const limitUsers = [`limit-1-${orgId}`, `limit-2-${orgId}`];

  beforeAll(async () => {
    testApp = await startTestApp({
      configure: (builder) => builder.overrideProvider(RATE_LIMIT).useValue({ perMinute: 2 }),
    });
    // Ohne Organisation gäbe es 403 statt einer Antwort (PLT-02).
    const db = testApp.adminDb;
    await db.insert(schema.organization).values({ id: orgId, name: `Limit-OEM ${orgId}` });
    await db.insert(schema.organizationFeature).values({ organizationId: orgId, feature: 'buyer' });
    await db.insert(schema.appUser).values(
      limitUsers.map((id) => ({
        id,
        name: 'Limit',
        email: 'limit@example.com',
        organizationId: orgId,
      })),
    );
  });

  afterAll(async () => {
    const db = testApp.adminDb;
    await db.delete(schema.appUser).where(sql`${schema.appUser.id} in ${limitUsers}`);
    await db.delete(schema.organization).where(sql`${schema.organization.id} = ${orgId}`);
    await testApp.close();
  });

  it('begrenzt die Anfragen je Nutzer und Minute mit einer freundlichen Meldung', async () => {
    const claims = { 'urn:zitadel:iam:org:project:test-project:roles': { leser: { '1': 'test' } } };
    const ask = async (subject: string) =>
      testApp.post(
        '/api/prompt',
        { messages: [{ role: 'user', content: 'Hallo' }] },
        await testApp.signToken({ subject, claims }),
      );
    const [first = '', second = ''] = limitUsers;
    expect((await ask(first)).status).toBe(200);
    expect((await ask(first)).status).toBe(200);
    const third = await ask(first);
    expect(third.status).toBe(429);
    expect(await third.json()).toMatchObject({
      code: 'zu_viele_anfragen',
      message: 'Du hast gerade sehr viele Fragen gestellt. Warte eine Minute.',
    });
    // Andere Nutzer sind nicht betroffen.
    expect((await ask(second)).status).toBe(200);
  });
});
