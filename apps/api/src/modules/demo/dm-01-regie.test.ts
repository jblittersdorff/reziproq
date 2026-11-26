import { randomUUID } from 'node:crypto';
import { type Database, schema, sql } from '@reziproq/db';
import { businessTimeHeader, demoRegieSchema } from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';

// DM-01 (K1-g.1): Demo-Regie über die API. T1-DM2: außerhalb des Demo-Mandanten 404. T1-DM5: Die Uhr
// rückt nur vorwärts und führt unterwegs die fälligen Läufe in zeitlicher Reihenfolge aus, für alle
// Organisationen der Demo. T1-DM3: Zurücksetzen lädt den Stand „start“. Alles steht im Protokoll.
describe('DM-01 Demo-Regie über die API (K1-g.1)', () => {
  let app: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const run = randomUUID().slice(0, 8);
  const orgs = { demo: randomUUID(), supplier: randomUUID(), kunde: randomUUID() };
  const users = { demo: `dm01r-demo-${run}`, kunde: `dm01r-kunde-${run}` };
  const relationshipId = randomUUID();
  const start = new Date('2026-11-23T06:30:00.000Z');

  async function call(user: string, method: string, path: string, body?: unknown) {
    const response = await fetch(`${app.baseUrl}/api${path}`, {
      method,
      headers: {
        authorization: `Bearer ${await app.signToken({ subject: user })}`,
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    return {
      status: response.status,
      headers: response.headers,
      body: (await response.json().catch(() => null)) as unknown,
    };
  }
  const clocks = async () =>
    (
      await db.execute<{ demo_now: Date }>(
        sql`select demo_now from organization where id in ${[orgs.demo, orgs.supplier]}`,
      )
    ).rows.map((row) => new Date(row.demo_now).toISOString());

  beforeAll(async () => {
    app = await startTestApp();
    db = app.adminDb;
    await db.insert(schema.organization).values([
      { id: orgs.demo, name: `DM01R Demo ${run}`, isDemo: true, demoNow: start },
      { id: orgs.supplier, name: `DM01R Lieferant ${run}`, isDemo: true, demoNow: start },
      { id: orgs.kunde, name: `DM01R Kunde ${run}` },
    ]);
    await db.insert(schema.organizationFeature).values([
      { organizationId: orgs.demo, feature: 'buyer' },
      { organizationId: orgs.kunde, feature: 'buyer' },
    ]);
    const person = (id: string, organizationId: string) => ({
      id,
      name: id,
      email: `${id}@example.com`,
      organizationId,
      orgRole: 'member' as const,
      rolesImportedAt: new Date(),
    });
    await db
      .insert(schema.appUser)
      .values([person(users.demo, orgs.demo), person(users.kunde, orgs.kunde)]);
    await insertRelationships(db, [
      { id: relationshipId, buyer: orgs.demo, supplier: orgs.supplier },
    ]);
    // Der Seed hält „start“ fest; hier für die kleine Demo dieses Tests
    await db.execute(sql`select app_demo_schnappschuss(${orgs.demo}::uuid, 'start')`);
  });

  afterAll(async () => {
    // Was die Läufe angelegt haben, räumt die Funktion der Regie auf
    await db.execute(sql`select app_demo_leeren(${orgs.demo}::uuid)`);
    const ids = Object.values(orgs);
    await db.execute(sql`delete from demo_event where org_id in ${ids}`);
    await db.execute(sql`delete from demo_snapshot where org_id in ${ids}`);
    await deleteRelationships(db, ids);
    await db.execute(sql`delete from app_user where organization_id in ${ids}`);
    await db.execute(sql`delete from organization_feature where organization_id in ${ids}`);
    await db.execute(sql`delete from organization where id in ${ids}`);
    await app.close();
  });

  it('T1-DM2: außerhalb des Demo-Mandanten gibt es die Regie nicht (404)', async () => {
    expect((await call(users.kunde, 'GET', '/demo/regie')).status).toBe(404);
    expect(
      (await call(users.kunde, 'POST', '/demo/regie/zeit', { aktion: 'neuer_tag' })).status,
    ).toBe(404);
    expect((await call(users.kunde, 'POST', '/demo/regie/zuruecksetzen')).status).toBe(404);
  });

  it('zeigt Demo-Uhr und Modus', async () => {
    const state = await call(users.demo, 'GET', '/demo/regie');
    expect(state.status).toBe(200);
    expect(demoRegieSchema.parse(state.body)).toEqual({
      demoNow: start.toISOString(),
      mode: 'live',
      runs: [],
    });
  });

  it('T1-DM5: Neuer Tag, eine Stunde weiter und Auf Datum springen, mit den fälligen Läufen', async () => {
    const day = await call(users.demo, 'POST', '/demo/regie/zeit', { aktion: 'neuer_tag' });
    expect(day.status).toBe(200);
    expect(demoRegieSchema.parse(day.body)).toMatchObject({
      demoNow: '2026-11-24T05:00:00.000Z',
      runs: [
        { key: 'briefing', at: '2026-11-24T05:00:00.000Z' },
        { key: 'triage', at: '2026-11-24T05:00:00.000Z' },
      ],
    });
    // Die Antwort nennt die neue Demo-Uhr; alle Organisationen der Demo gehen mit
    expect(day.headers.get(businessTimeHeader)).toBe('2026-11-24T05:00:00.000Z');
    expect(await clocks()).toEqual(['2026-11-24T05:00:00.000Z', '2026-11-24T05:00:00.000Z']);

    const hour = demoRegieSchema.parse(
      (await call(users.demo, 'POST', '/demo/regie/zeit', { aktion: 'stunde' })).body,
    );
    expect(hour).toMatchObject({
      demoNow: '2026-11-24T06:00:00.000Z',
      runs: [{ key: 'briefing', at: '2026-11-24T06:00:00.000Z' }],
    });

    const jump = demoRegieSchema.parse(
      (await call(users.demo, 'POST', '/demo/regie/zeit', { aktion: 'datum', datum: '2026-12-03' }))
        .body,
    );
    expect(jump.demoNow).toBe('2026-12-03T06:30:00.000Z');
    const at = jump.runs.map((entry) => Date.parse(entry.at));
    expect(at).toEqual([...at].sort((a, b) => a - b));
    expect(jump.runs.filter((entry) => entry.key === 'wertfinder')).toEqual([
      { key: 'wertfinder', at: '2026-12-01T04:00:00.000Z' },
    ]);
    expect(jump.runs.filter((entry) => entry.key === 'triage')).toHaveLength(9);
    expect(jump.runs.filter((entry) => entry.key === 'hinweise')).toHaveLength(10);

    // Nur vorwärts
    expect(
      await call(users.demo, 'POST', '/demo/regie/zeit', { aktion: 'datum', datum: '2026-11-30' }),
    ).toMatchObject({ status: 400, body: { code: 'nur_vorwaerts' } });
  });

  it('T1-DM3: Zurücksetzen lädt „start“; jede Aktion steht im Protokoll', async () => {
    const reset = await call(users.demo, 'POST', '/demo/regie/zuruecksetzen');
    expect(reset.status).toBe(200);
    expect(demoRegieSchema.parse(reset.body).demoNow).toBe(start.toISOString());
    expect(reset.headers.get(businessTimeHeader)).toBe(start.toISOString());
    expect(await clocks()).toEqual([start.toISOString(), start.toISOString()]);
    const events = (
      await db.execute<{ kind: string; actor_user_id: string }>(
        sql`select kind, actor_user_id from demo_event where org_id = ${orgs.demo} order by id`,
      )
    ).rows;
    expect(events).toEqual(
      ['zeit.neuer_tag', 'zeit.stunde', 'zeit.datum', 'zuruecksetzen'].map((kind) => ({
        kind,
        actor_user_id: users.demo,
      })),
    );
  });
});
