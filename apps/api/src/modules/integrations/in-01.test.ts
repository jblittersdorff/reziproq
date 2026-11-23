import { randomUUID } from 'node:crypto';
import { type Database, schema, sql, withTenant } from '@reziproq/db';
import {
  type Integrations,
  integrationsSchema,
  myConnectionsSchema,
  startSchema,
} from '@reziproq/shared';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';
import { connectors } from './connectors.js';
import { FakeProvider, type ProviderItem } from './fake-provider.js';
import { IntegrationQueue } from './integration-queue.js';
import { IntegrationsService, signatureHeader, signPayload } from './integrations.service.js';

// Tests zu docs/specs/IN-01.md: verbinden, abgleichen und trennen mit dem Anbieter fake, keine
// Zugangsdaten im Klartext, Webhooks nur mit Signatur, idempotente Abgleiche, Fehler je Element,
// Trennen mitten im Job, Schreiben nur über Domänendienste, Trennung der Kunden, nichts für den
// Lieferanten. Alles ohne Netzwerk.
describe('IN-01 Integrationsschicht', () => {
  const run = randomUUID().slice(0, 8);
  const orgs = { a: randomUUID(), b: randomUUID(), supplier: randomUUID(), second: randomUUID() };
  const users = {
    admin: `in01-adm-${run}`,
    member: `in01-mem-${run}`,
    viewer: `in01-view-${run}`,
    adminB: `in01-admb-${run}`,
    supplier: `in01-sup-${run}`,
  };
  const rel = { first: randomUUID(), second: randomUUID(), b: randomUUID() };
  let app: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  let service: IntegrationsService;
  let fake: FakeProvider;
  let queue: IntegrationQueue;
  const output: string[] = [];
  const bodies: string[] = [];

  async function call(user: string, method: string, path: string, body?: unknown) {
    const response = await fetch(`${app.baseUrl}/api${path}`, {
      method,
      headers: {
        authorization: `Bearer ${await app.signToken({ subject: user })}`,
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const text = await response.text();
    bodies.push(text);
    return { status: response.status, body: (text ? JSON.parse(text) : null) as unknown };
  }
  const overview = async (user = users.admin) =>
    integrationsSchema.parse((await call(user, 'GET', '/einstellungen/anbindungen')).body);
  const connectionOf = (value: Integrations, key: string) =>
    value.connectors.find((entry) => entry.key === key)?.connection ?? null;
  async function connect(key: string, user = users.admin) {
    const response = await call(user, 'POST', `/einstellungen/anbindungen/${key}/verbinden`, {});
    expect(response.status).toBe(200);
    const id = connectionOf(integrationsSchema.parse(response.body), key)?.id;
    if (!id) throw new Error(`${key} nicht verbunden`);
    return id;
  }
  async function sync(id: string, user = users.admin) {
    const response = await call(user, 'POST', `/einstellungen/anbindungen/${id}/abgleichen`);
    expect(response.status).toBe(202);
    await queue.drain();
  }
  const notes = async () =>
    (
      await db.execute<{ id: string; text: string; author_user_id: string }>(
        sql`select id, text, author_user_id from note where org_id = ${orgs.a} order by created_at`,
      )
    ).rows;
  const lastJob = async (connectionId: string) => {
    const [job] = await db
      .select()
      .from(schema.syncJob)
      .where(sql`${schema.syncJob.connectionId} = ${connectionId}`)
      .orderBy(sql`${schema.syncJob.createdAt} desc, ${schema.syncJob.id} desc`)
      .limit(1);
    return job;
  };
  const note = (externalId: string, relationshipId: string | null, text = externalId) =>
    ({ externalId, kind: 'note', relationshipId, text }) satisfies ProviderItem;

  beforeAll(async () => {
    app = await startTestApp();
    db = app.adminDb;
    service = app.app.get(IntegrationsService);
    fake = app.app.get(FakeProvider);
    queue = app.app.get(IntegrationQueue);
    for (const stream of [process.stdout, process.stderr]) {
      const write = stream.write.bind(stream);
      vi.spyOn(stream, 'write').mockImplementation(((chunk: unknown, ...rest: never[]) => {
        output.push(String(chunk));
        return write(chunk as string, ...rest);
      }) as typeof stream.write);
    }
    await db.insert(schema.organization).values([
      { id: orgs.a, name: `IN01 OEM A ${run}` },
      { id: orgs.b, name: `IN01 OEM B ${run}` },
      { id: orgs.supplier, name: `IN01 Rheintal ${run}` },
      { id: orgs.second, name: `IN01 Silesia ${run}` },
    ]);
    await db.insert(schema.organizationFeature).values([
      { organizationId: orgs.a, feature: 'buyer' },
      { organizationId: orgs.b, feature: 'buyer' },
    ]);
    await db.insert(schema.appUser).values(
      Object.entries(users).map(([key, id]) => ({
        id,
        name: key,
        email: `${id}@example.com`,
        organizationId: key === 'adminB' ? orgs.b : key === 'supplier' ? orgs.supplier : orgs.a,
        orgRole:
          key === 'viewer'
            ? ('viewer' as const)
            : key === 'member'
              ? ('member' as const)
              : ('admin' as const),
        rolesImportedAt: new Date(),
      })),
    );
    await insertRelationships(db, [
      { id: rel.first, buyer: orgs.a, supplier: orgs.supplier },
      { id: rel.second, buyer: orgs.a, supplier: orgs.second },
      { id: rel.b, buyer: orgs.b, supplier: orgs.supplier },
    ]);
  });

  afterEach(() => {
    fake.nextItems = null;
    fake.beforeItem = null;
    fake.failRefresh = false;
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    const ids = [orgs.a, orgs.b];
    await db.execute(sql`delete from connection where org_id in ${ids}`);
    await db.execute(sql`delete from note where org_id in ${ids}`);
    await deleteRelationships(db, ids);
    await db.execute(sql`delete from outbox_event where org_id in ${ids}`);
    await db.execute(sql`delete from app_user where id in ${Object.values(users)}`);
    await db.execute(sql`delete from organization where id in ${Object.values(orgs)}`);
    await app.close();
  });

  it('mit dem Anbieter fake lässt sich jede Anbindung der Stufe 1 verbinden, abgleichen und trennen', async () => {
    const stage1 = connectors.filter((entry) => entry.stage === 1);
    expect(stage1.map((entry) => entry.key).sort()).toEqual(
      ['files', 'google_workspace', 'import_api', 'inbound_mail', 'microsoft365'].sort(),
    );
    for (const connector of stage1) {
      const id = await connect(connector.key);
      const connected = connectionOf(await overview(), connector.key);
      expect(connected).toMatchObject({ status: 'active', parts: [...connector.defaultParts] });
      expect(connected?.hookPath !== null).toBe(connector.webhook);
      await sync(id);
      expect(await lastJob(id)).toMatchObject({ status: 'done' });
      const after = connectionOf(await overview(), connector.key);
      expect(after?.lastJob?.status).toBe('done');
      expect(
        (await call(users.admin, 'POST', `/einstellungen/anbindungen/${id}/trennen`)).status,
      ).toBe(200);
      expect(connectionOf(await overview(), connector.key)).toBeNull();
    }
    // Stufe 2 bleibt ausgegraut
    expect(
      (await call(users.admin, 'POST', '/einstellungen/anbindungen/slack/verbinden', {})).status,
    ).toBe(400);
    // Persönliche Verbindung im Profil
    const mine = await call(users.member, 'POST', '/profil/verbindungen/microsoft365/verbinden');
    expect(mine.status).toBe(200);
    const parsed = myConnectionsSchema.parse(mine.body);
    expect(parsed.available).toEqual(['microsoft365', 'google_workspace']);
    const own = parsed.connections[0]?.connection;
    expect(own).toMatchObject({ scope: 'user', status: 'active' });
    // Andere Personen trennen sie nicht, die Person selbst schon
    expect(
      (await call(users.viewer, 'POST', `/profil/verbindungen/${own?.id}/trennen`)).status,
    ).toBe(403);
    const removed = await call(users.member, 'POST', `/profil/verbindungen/${own?.id}/trennen`);
    expect(myConnectionsSchema.parse(removed.body).connections).toEqual([]);
    // Die Beispiele aus dem Anbieter fake sind Notizen, entstanden über den Domänendienst
    expect((await notes()).length).toBeGreaterThan(0);
  }, 30_000);

  it('ein Zugangstoken steht nie im Klartext in der Datenbank, in Logs oder in Antworten', async () => {
    const id = await connect('microsoft365');
    await sync(id);
    await service.refreshDue(orgs.a, new Date(Date.now() + 2 * 60 * 60 * 1000));
    const stored = await db.execute<{ dump: string }>(sql`
      select coalesce(string_agg(t::text, ' '), '') as dump from (
        select row_to_json(s)::text as t from connection_secret s where org_id = ${orgs.a}
        union all select row_to_json(c)::text from connection c where org_id = ${orgs.a}
        union all select row_to_json(e)::text from sync_event e where org_id = ${orgs.a}
        union all select row_to_json(j)::text from sync_job j where org_id = ${orgs.a}
      ) x`);
    const dump = stored.rows[0]?.dump ?? '';
    expect(dump).toContain('"ciphertext":"v1.');
    expect(fake.issued.length).toBeGreaterThan(1);
    for (const token of fake.issued) {
      expect(dump).not.toContain(token);
      expect(output.join('')).not.toContain(token);
      expect(bodies.join('')).not.toContain(token);
    }
    // Die Schicht selbst kann entschlüsseln: das jüngste Token ist das aus dem Erneuern
    const [secret] = await db
      .execute<{ ciphertext: string; key_ref: string }>(
        sql`select ciphertext, key_ref from connection_secret where connection_id = ${id} and kind = 'oauth'`,
      )
      .then((result) => result.rows);
    expect(service.box.open(secret?.ciphertext ?? '', secret?.key_ref ?? '')).toBe(
      fake.issued.at(-1),
    );
    await call(users.admin, 'POST', `/einstellungen/anbindungen/${id}/trennen`);
  });

  it('ein Webhook mit falscher Signatur wird abgelehnt und als rejected protokolliert, ohne dass Daten gelesen werden', async () => {
    const id = await connect('inbound_mail');
    const hookPath = connectionOf(await overview(), 'inbound_mail')?.hookPath ?? '';
    const before = await notes();
    const payload = JSON.stringify({ items: [note('hook-1', rel.first, 'Mail per Webhook')] });
    const send = (signature: string, path = hookPath) =>
      fetch(`${app.baseUrl}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', [signatureHeader]: signature },
        body: payload,
      });
    expect((await send('sha256=falsch')).status).toBe(401);
    expect((await send('sha256=falsch', '/api/anbindungen/eingang/unbekannt')).status).toBe(401);
    await queue.drain();
    const events = await db.execute<{ status: string; reason: string; external_id: string | null }>(
      sql`select status, reason, external_id from sync_event where connection_id = ${id} and kind = 'webhook'`,
    );
    expect(events.rows).toEqual([
      { status: 'rejected', reason: 'signatur_falsch', external_id: null },
    ]);
    expect(await lastJob(id)).toBeUndefined();
    expect(await notes()).toEqual(before);
    // Mit richtiger Signatur: sofort angenommen, im Job verarbeitet
    const [secret] = (
      await db.execute<{ ciphertext: string; key_ref: string }>(sql`
        select s.ciphertext, s.key_ref from inbound_hook h join connection_secret s on s.id = h.secret_ref
        where h.connection_id = ${id}`)
    ).rows;
    const plain = service.box.open(secret?.ciphertext ?? '', secret?.key_ref ?? '') ?? '';
    expect((await send(signPayload(plain, payload))).status).toBe(202);
    await queue.drain();
    expect((await notes()).map((entry) => entry.text)).toContain('Mail per Webhook');
    await call(users.admin, 'POST', `/einstellungen/anbindungen/${id}/trennen`);
  });

  it('ein Abgleich, der zweimal dasselbe Element bekommt, legt es nur einmal an', async () => {
    const id = await connect('google_workspace');
    const items = [note('dup-1', rel.first, `Doppelt ${run}`)];
    fake.nextItems = items;
    await sync(id);
    fake.nextItems = items;
    await sync(id);
    expect((await notes()).filter((entry) => entry.text === `Doppelt ${run}`)).toHaveLength(1);
    const events = await db.execute<{ status: string; reason: string | null }>(
      sql`select status, reason from sync_event where connection_id = ${id} and external_id = 'dup-1' order by created_at`,
    );
    expect(events.rows).toEqual([
      { status: 'applied', reason: null },
      { status: 'ignored', reason: 'schon_uebernommen' },
    ]);
    await call(users.admin, 'POST', `/einstellungen/anbindungen/${id}/trennen`);
  });

  it('ein fehlerhaftes Element stoppt den Job nicht; die anderen werden übernommen', async () => {
    const id = await connect('google_workspace');
    fake.nextItems = [
      note('ok-1', rel.first, `Gut 1 ${run}`),
      note('bad-1', null),
      note('ok-2', rel.second, `Gut 2 ${run}`),
    ];
    await sync(id);
    expect(await lastJob(id)).toMatchObject({
      status: 'done',
      itemsIn: 3,
      itemsOk: 2,
      itemsFailed: 1,
    });
    const texts = (await notes()).map((entry) => entry.text);
    expect(texts).toEqual(expect.arrayContaining([`Gut 1 ${run}`, `Gut 2 ${run}`]));
    const view = await overview();
    expect(view.issue).toEqual({
      kind: 'failed_items',
      connectorKey: 'google_workspace',
      count: 1,
    });
    expect(
      view.events.some((event) => event.status === 'failed' && event.reason === 'beziehung_fehlt'),
    ).toBe(true);
    await call(users.admin, 'POST', `/einstellungen/anbindungen/${id}/trennen`);
  });

  it('Trennen löscht die Zugangsdaten sofort; ein laufender Job endet nach dem aktuellen Element', async () => {
    const id = await connect('microsoft365');
    fake.nextItems = [
      note('run-1', rel.first, `Lauf 1 ${run}`),
      note('run-2', rel.first, `Lauf 2 ${run}`),
      note('run-3', rel.first, `Lauf 3 ${run}`),
    ];
    let secretsAfter = -1;
    fake.beforeItem = async (index) => {
      if (index !== 1) return;
      const response = await call(users.admin, 'POST', `/einstellungen/anbindungen/${id}/trennen`);
      expect(response.status).toBe(200);
      const left = await db.execute<{ count: number }>(
        sql`select count(*)::int as count from connection_secret where connection_id = ${id}`,
      );
      secretsAfter = left.rows[0]?.count ?? -1;
    };
    await sync(id);
    expect(secretsAfter).toBe(0);
    expect(await lastJob(id)).toMatchObject({ status: 'failed', error: 'getrennt', itemsIn: 1 });
    const texts = (await notes()).map((entry) => entry.text);
    expect(texts).toContain(`Lauf 1 ${run}`);
    expect(texts).not.toContain(`Lauf 2 ${run}`);
    // Was entstanden ist, bleibt; der Anbieter hat den Widerruf bekommen
    expect(fake.revoked.length).toBeGreaterThan(0);
    const hooks = await db.execute(sql`select 1 from inbound_hook where connection_id = ${id}`);
    expect(hooks.rows).toEqual([]);
  });

  it('Daten aus einer Anbindung entstehen nur über Domänendienste; eine Person ohne Zugriff legt nichts an', async () => {
    // Die Leserin verbindet ihren Kalender; sie darf keine Notizen schreiben
    const mine = myConnectionsSchema.parse(
      (await call(users.viewer, 'POST', '/profil/verbindungen/microsoft365/verbinden')).body,
    );
    const id = mine.connections[0]?.connection.id ?? '';
    const before = (await notes()).length;
    fake.nextItems = [note('viewer-1', rel.first, `Leserin ${run}`)];
    const sent = await call(users.viewer, 'POST', `/einstellungen/anbindungen/${id}/abgleichen`);
    expect(sent.status).toBe(403);
    // Der Job selbst prüft can() mit den Rechten der verbindenden Person
    const jobId = await withTenant(
      db,
      { userId: users.viewer, organizationId: orgs.a },
      async (tx) => {
        const [job] = await tx
          .insert(schema.syncJob)
          .values({ orgId: orgs.a, connectionId: id, kind: 'sync' })
          .returning({ id: schema.syncJob.id });
        return job?.id ?? '';
      },
    );
    await service.runJob({ orgId: orgs.a, jobId });
    expect((await notes()).length).toBe(before);
    const event = await db.execute<{ status: string; reason: string }>(
      sql`select status, reason from sync_event where connection_id = ${id} and external_id = 'viewer-1'`,
    );
    expect(event.rows).toEqual([{ status: 'failed', reason: 'keine_berechtigung' }]);
    // Ein Mitglied darf schreiben, aber nicht in eine Beziehung eines anderen Kunden
    const memberId =
      myConnectionsSchema.parse(
        (await call(users.member, 'POST', '/profil/verbindungen/google_workspace/verbinden')).body,
      ).connections[0]?.connection.id ?? '';
    fake.nextItems = [note('foreign-1', rel.b, `Fremd ${run}`)];
    const memberJob = await withTenant(
      db,
      { userId: users.member, organizationId: orgs.a },
      async (tx) => {
        const [job] = await tx
          .insert(schema.syncJob)
          .values({ orgId: orgs.a, connectionId: memberId, kind: 'sync' })
          .returning({ id: schema.syncJob.id });
        return job?.id ?? '';
      },
    );
    await service.runJob({ orgId: orgs.a, jobId: memberJob });
    const foreign = await db.execute(sql`select 1 from note where text = ${`Fremd ${run}`}`);
    expect(foreign.rows).toEqual([]);
    await call(users.viewer, 'POST', `/profil/verbindungen/${id}/trennen`);
    await call(users.member, 'POST', `/profil/verbindungen/${memberId}/trennen`);
  });

  it('scheitert das Erneuern, wechselt die Verbindung auf Fehler und die Person bekommt eine Aufgabe', async () => {
    const id = await connect('microsoft365');
    fake.failRefresh = true;
    await service.refreshDue(orgs.a, new Date(Date.now() + 2 * 60 * 60 * 1000));
    const view = await overview();
    expect(connectionOf(view, 'microsoft365')?.status).toBe('error');
    expect(view.issue).toMatchObject({ kind: 'error', connectorKey: 'microsoft365' });
    const start = startSchema.parse((await call(users.admin, 'GET', '/start')).body);
    expect(start.due.items).toContainEqual(
      expect.objectContaining({
        kind: 'connection_renew',
        detail: 'microsoft365',
        href: '/einstellungen/anbindungen',
      }),
    );
    // Mitglieder sehen die Aufgabe der Organisation nicht
    const member = startSchema.parse((await call(users.member, 'GET', '/start')).body);
    expect(member.due.items.some((item) => item.kind === 'connection_renew')).toBe(false);
    await call(users.admin, 'POST', `/einstellungen/anbindungen/${id}/trennen`);
  });

  it('Kunde A sieht keine Verbindung, kein Ereignis und keinen Job von Kunde B', async () => {
    const idA = await connect('google_workspace');
    await sync(idA);
    const viewB = await overview(users.adminB);
    expect(viewB.connectors.every((entry) => entry.connection === null)).toBe(true);
    expect(viewB.events).toEqual([]);
    expect(
      (await call(users.adminB, 'POST', `/einstellungen/anbindungen/${idA}/trennen`)).status,
    ).toBe(404);
    expect(
      (await call(users.adminB, 'POST', `/einstellungen/anbindungen/${idA}/abgleichen`)).status,
    ).toBe(404);
    const seen = await withTenant(
      db,
      { userId: users.adminB, organizationId: orgs.b },
      async (tx) => ({
        connections: await tx.select().from(schema.connection),
        secrets: await tx.select().from(schema.connectionSecret),
        jobs: await tx.select().from(schema.syncJob),
        events: await tx.select().from(schema.syncEvent),
        hooks: await tx.select().from(schema.inboundHook),
      }),
    );
    expect(seen).toEqual({ connections: [], secrets: [], jobs: [], events: [], hooks: [] });
    // Mitglieder von A sehen die Seite nicht
    expect((await call(users.member, 'GET', '/einstellungen/anbindungen')).status).toBe(403);
    await call(users.admin, 'POST', `/einstellungen/anbindungen/${idA}/trennen`);
  });

  it('der Test-Lieferant sieht nichts davon', async () => {
    const id = await connect('inbound_mail');
    expect((await call(users.supplier, 'GET', '/einstellungen/anbindungen')).status).toBe(403);
    expect((await call(users.supplier, 'GET', '/profil/verbindungen')).status).toBe(403);
    expect(
      (await call(users.supplier, 'POST', '/profil/verbindungen/microsoft365/verbinden')).status,
    ).toBe(403);
    const seen = await withTenant(
      db,
      { userId: users.supplier, organizationId: orgs.supplier, customerOrganizationId: orgs.a },
      async (tx) => [
        ...(await tx.select().from(schema.connection)),
        ...(await tx.select().from(schema.connectionSecret)),
        ...(await tx.select().from(schema.syncJob)),
        ...(await tx.select().from(schema.syncEvent)),
        ...(await tx.select().from(schema.inboundHook)),
      ],
    );
    expect(seen).toEqual([]);
    await call(users.admin, 'POST', `/einstellungen/anbindungen/${id}/trennen`);
  });
});
