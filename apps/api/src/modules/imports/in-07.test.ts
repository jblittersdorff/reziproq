import { randomUUID } from 'node:crypto';
import { type Database, schema, sql } from '@reziproq/db';
import {
  type ApiBatchResponse,
  apiBatchResponseSchema,
  apiKeysSchema,
  createdApiKeySchema,
} from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';
import { ImportApiQueue } from './import-api.queue.js';

// Tests zu docs/specs/IN-07.md: Lieferung mit Schlüssel bis zur Übernahme auf den Cent, gleiche
// idempotency_key, Objektarten je Schlüssel, Widerruf, Fehler je Zeile und Feld, Ersetzen je
// Monat, Prüfung blockiert nicht, Ratenbegrenzung, Trennung der Kunden, nichts für den Lieferanten.
describe('IN-07 Import-API', () => {
  const run = randomUUID().slice(0, 8);
  const orgs = { a: randomUUID(), b: randomUUID(), s1: randomUUID(), s2: randomUUID() };
  const users = {
    admin: `in07-adm-${run}`,
    member: `in07-mem-${run}`,
    adminB: `in07-admb-${run}`,
    supplier: `in07-sup-${run}`,
  };
  const rel = { s1: randomUUID(), s2: randomUUID(), b: randomUUID() };
  const group = randomUUID();
  const year = new Date().getUTCFullYear();
  const numbers = { s1: `S1-${run}`, s2: `S2-${run}` };
  let app: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  let queue: ImportApiQueue;

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
  async function v1(key: string, method: string, path: string, body?: unknown) {
    const response = await fetch(`${app.baseUrl}/api/v1${path}`, {
      method,
      headers: {
        authorization: `Bearer ${key}`,
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    return {
      status: response.status,
      retryAfter: response.headers.get('retry-after'),
      body: (await response.json().catch(() => null)) as unknown,
    };
  }
  async function createKey(scopes: string[], user = users.admin) {
    const response = await call(user, 'POST', '/einstellungen/anbindungen/schluessel', {
      name: `ERP-Middleware ${run}`,
      scopes,
    });
    expect(response.status).toBe(201);
    return createdApiKeySchema.parse(response.body).secret;
  }
  /** Liefern, Job abwarten, Stand lesen */
  async function deliver(key: string, body: Record<string, unknown>) {
    const sent = await v1(key, 'POST', '/batches', body);
    expect(sent.status).toBe(202);
    await queue.drain();
    const first = apiBatchResponseSchema.parse(sent.body);
    const state = await v1(key, 'GET', `/batches/${first.batch_id}`);
    expect(state.status).toBe(200);
    return { first, state: apiBatchResponseSchema.parse(state.body) };
  }
  const spendRow = (supplier: string, period: string, amount: string) => ({
    supplier_external_number: supplier,
    period,
    amount,
    currency: 'EUR',
    material_group: 'Z-LP',
  });
  async function yearly(relationshipId: string, y: number) {
    const rows = await db.execute<{ cents: string | null }>(sql`
      select sum(amount_cents)::text as cents from relationship_spend
      where relationship_id = ${relationshipId} and year = ${y} and kind = 'actual'`);
    return Number(rows.rows[0]?.cents ?? 0);
  }
  let key: string;

  beforeAll(async () => {
    app = await startTestApp();
    db = app.adminDb;
    queue = app.app.get(ImportApiQueue);
    await db.insert(schema.organization).values([
      { id: orgs.a, name: `IN07 OEM A ${run}` },
      { id: orgs.b, name: `IN07 OEM B ${run}` },
      { id: orgs.s1, name: `IN07 Rheintal ${run}` },
      { id: orgs.s2, name: `IN07 Silesia ${run}` },
    ]);
    await db.insert(schema.organizationFeature).values([
      { organizationId: orgs.a, feature: 'buyer' },
      { organizationId: orgs.b, feature: 'buyer' },
    ]);
    await db.insert(schema.appUser).values(
      Object.entries(users).map(([name, id]) => ({
        id,
        name,
        email: `${id}@example.com`,
        organizationId: name === 'adminB' ? orgs.b : name === 'supplier' ? orgs.s1 : orgs.a,
        orgRole: name === 'member' ? ('member' as const) : ('admin' as const),
        rolesImportedAt: new Date(),
      })),
    );
    await insertRelationships(db, [
      { id: rel.s1, buyer: orgs.a, supplier: orgs.s1, externalRef: numbers.s1 },
      { id: rel.s2, buyer: orgs.a, supplier: orgs.s2, externalRef: numbers.s2 },
      { id: rel.b, buyer: orgs.b, supplier: orgs.s1 },
    ]);
    await db.insert(schema.materialGroup).values({
      id: group,
      orgId: orgs.a,
      name: 'Leiterplatten',
      code: `LP-${run}`,
    });
    await db.insert(schema.categoryRule).values({
      orgId: orgs.a,
      materialGroupId: group,
      field: 'material_group',
      pattern: 'Z-LP',
      createdBy: users.admin,
    });
    key = await createKey(['supplier', 'spend']);
  });

  afterAll(async () => {
    const ids = [orgs.a, orgs.b];
    await db.execute(sql`delete from spend_period where org_id in ${ids}`);
    await db.execute(sql`delete from import_batch where org_id in ${ids}`);
    await db.execute(sql`delete from api_key where org_id in ${ids}`);
    await db.execute(sql`delete from connection where org_id in ${ids}`);
    await db.execute(sql`delete from supplier_alias where org_id in ${ids}`);
    await db.execute(sql`delete from category_rule where org_id in ${ids}`);
    await db.execute(sql`delete from model_call where org_id in ${ids}`);
    await db.execute(
      sql`delete from relationship_spend where relationship_id in ${Object.values(rel)}`,
    );
    await db.execute(
      sql`delete from relationship_material_group where relationship_id in ${Object.values(rel)}`,
    );
    await db.execute(sql`delete from material_group where org_id in ${ids}`);
    await deleteRelationships(db, ids);
    await db.execute(sql`delete from outbox_event where org_id in ${ids}`);
    await db.execute(sql`delete from app_user where id in ${Object.values(users)}`);
    await db.execute(sql`delete from organization where id in ${Object.values(orgs)}`);
    await app.close();
  });

  it('Schlüssel: einmal im Klartext, sonst nur Anfang und Hash; nur Admins', async () => {
    const list = apiKeysSchema.parse(
      (await call(users.admin, 'GET', '/einstellungen/anbindungen/schluessel')).body,
    );
    expect(list.keys[0]).toMatchObject({ scopes: ['supplier', 'spend'], revokedAt: null });
    expect(JSON.stringify(list)).not.toContain(key);
    expect(key.startsWith(list.keys[0]?.prefix ?? '-')).toBe(true);
    const stored = await db.execute<{ hash: string }>(
      sql`select hash from api_key where org_id = ${orgs.a}`,
    );
    expect(stored.rows.every((row) => row.hash !== key && /^[0-9a-f]{64}$/.test(row.hash))).toBe(
      true,
    );
    expect((await call(users.member, 'GET', '/einstellungen/anbindungen/schluessel')).status).toBe(
      403,
    );
    expect(
      (
        await call(users.member, 'POST', '/einstellungen/anbindungen/schluessel', {
          name: 'x',
          scopes: ['spend'],
        })
      ).status,
    ).toBe(403);
    const spec = await fetch(`${app.baseUrl}/api/v1/openapi.json`);
    expect(((await spec.json()) as { openapi: string }).openapi).toBe('3.1.0');
  });

  it('eine Lieferung mit gültigem Schlüssel und 100 Zeilen Spend wird übernommen; die Summe stimmt auf den Cent', async () => {
    const y = year - 3;
    const rows = Array.from({ length: 100 }, (_, index) =>
      spendRow(
        numbers.s1,
        `${y}-${String((index % 12) + 1).padStart(2, '0')}`,
        `${1000 + index}.${String(index % 100).padStart(2, '0')}`,
      ),
    );
    const expected = rows.reduce((sum, row) => sum + Math.round(Number(row.amount) * 100), 0);
    const { first, state } = await deliver(key, {
      object_type: 'spend',
      idempotency_key: `cent-${run}`,
      rows,
    });
    expect(first.status).toBe('processing');
    expect(state).toMatchObject({
      status: 'committed',
      rows: { received: 100, ok: 100, review: 0, error: 0 },
      review_batch_id: null,
    });
    expect(await yearly(rel.s1, y)).toBe(expected);
    const months = await db.execute<{ cents: string }>(
      sql`select sum(amount_cents)::text as cents from spend_period where relationship_id = ${rel.s1} and period like ${`${y}-%`}`,
    );
    expect(Number(months.rows[0]?.cents)).toBe(expected);
  });

  it('eine Wiederholung mit gleicher idempotency_key verarbeitet nichts neu und liefert dieselbe Antwort', async () => {
    const body = {
      object_type: 'spend',
      idempotency_key: `same-${run}`,
      rows: [spendRow(numbers.s2, `${year - 6}-01`, '10.00')],
    };
    const first = await v1(key, 'POST', '/batches', body);
    await queue.drain();
    const count = async () =>
      Number(
        (
          await db.execute<{ n: string }>(
            sql`select count(*)::text as n from import_batch where org_id = ${orgs.a}`,
          )
        ).rows[0]?.n,
      );
    const before = await count();
    const again = await v1(key, 'POST', '/batches', { ...body, rows: [] });
    expect(again.status).toBe(202);
    expect(again.body).toEqual(first.body);
    await queue.drain();
    expect(await count()).toBe(before);
  });

  it('ein Schlüssel ohne die Objektart order_line kann keine Bestellzeilen liefern', async () => {
    const order = {
      object_type: 'order_line',
      idempotency_key: `order-${run}`,
      rows: [{ order_no: '1', line_no: 1 }],
    };
    expect((await v1(key, 'POST', '/batches', order)).status).toBe(403);
    // Mit der Objektart: erlaubt, aber Reziproq übernimmt Bestellzeilen erst mit KI-19
    const orderKey = await createKey(['order_line']);
    const later = await v1(orderKey, 'POST', '/batches', order);
    expect(later).toMatchObject({ status: 422, body: { code: 'objektart_folgt' } });
  });

  it('ein widerrufener Schlüssel wird mit 401 abgelehnt', async () => {
    const revoked = await createKey(['spend']);
    const list = apiKeysSchema.parse(
      (await call(users.admin, 'GET', '/einstellungen/anbindungen/schluessel')).body,
    );
    const id = list.keys.find((entry) => revoked.startsWith(entry.prefix))?.id;
    expect(
      (await call(users.admin, 'POST', `/einstellungen/anbindungen/schluessel/${id}/widerrufen`))
        .status,
    ).toBe(200);
    const response = await v1(revoked, 'POST', '/batches', {
      object_type: 'spend',
      idempotency_key: `revoked-${run}`,
      rows: [],
    });
    expect(response.status).toBe(401);
    expect(
      (await v1('rzq_unbekannt_xxxxxxxxxxxxxxxx', 'GET', `/batches/${randomUUID()}`)).status,
    ).toBe(401);
  });

  it('eine Zeile mit falschem Datum erscheint als Fehler mit Zeilennummer und Feld; die anderen werden verarbeitet', async () => {
    const y = year - 4;
    const { state } = await deliver(key, {
      object_type: 'spend',
      idempotency_key: `date-${run}`,
      rows: [
        spendRow(numbers.s1, `${y}-01`, '100.00'),
        spendRow(numbers.s1, `${y}-13`, '50.00'),
        { ...spendRow(numbers.s1, `${y}-02`, '25.50'), cost_center: '4711' },
      ],
    });
    expect(state.errors).toEqual([
      { row: 2, field: 'period', reason: 'Datum ungültig, erwartet YYYY-MM' },
    ]);
    expect(state.ignored_fields).toEqual(['cost_center']);
    expect(state).toMatchObject({ status: 'committed', rows: { received: 3, ok: 2, error: 1 } });
    expect(await yearly(rel.s1, y)).toBe(12_550);
  });

  it('Spend derselben Periode ersetzt die vorige Lieferung, statt sie zu verdoppeln', async () => {
    const y = year - 2;
    await deliver(key, {
      object_type: 'spend',
      idempotency_key: `month-1-${run}`,
      rows: [spendRow(numbers.s2, `${y}-03`, '100.00'), spendRow(numbers.s2, `${y}-04`, '40.00')],
    });
    expect(await yearly(rel.s2, y)).toBe(14_000);
    await deliver(key, {
      object_type: 'spend',
      idempotency_key: `month-2-${run}`,
      rows: [spendRow(numbers.s2, `${y}-03`, '70.00')],
    });
    // März ersetzt, April bleibt
    expect(await yearly(rel.s2, y)).toBe(11_000);
  });

  it('Zeilen zur Prüfung blockieren die Übernahme der übrigen Zeilen nicht', async () => {
    const y = year - 5;
    const { state } = await deliver(key, {
      object_type: 'spend',
      idempotency_key: `review-${run}`,
      rows: [
        spendRow(numbers.s1, `${y}-01`, '300.00'),
        spendRow(`unbekannt-${run}`, `${y}-01`, '99.00'),
      ],
    });
    expect(state).toMatchObject({ status: 'committed', rows: { received: 2, ok: 1, review: 1 } });
    expect(state.review_batch_id).not.toBeNull();
    expect(await yearly(rel.s1, y)).toBe(30_000);
    // Die offene Zeile steht im Import zur Prüfung, Quelle API
    const list = (await call(users.admin, 'GET', '/einstellungen/importe')).body as {
      batches: { id: string; status: string; source: string; rowsReview: number }[];
    };
    expect(list.batches.find((batch) => batch.id === state.review_batch_id)).toMatchObject({
      status: 'review',
      source: 'api',
      rowsReview: 1,
    });
  });

  it('über 60 Aufrufe je Minute ergeben 429', async () => {
    const busy = await createKey(['spend']);
    const id = randomUUID();
    const statuses: number[] = [];
    let retryAfter: string | null = null;
    for (let index = 0; index < 61; index += 1) {
      const response = await v1(busy, 'GET', `/batches/${id}`);
      statuses.push(response.status);
      retryAfter ??= response.retryAfter;
    }
    expect(statuses.slice(0, 60).every((status) => status === 404)).toBe(true);
    expect(statuses[60]).toBe(429);
    expect(Number(retryAfter)).toBeGreaterThan(0);
  });

  it('Kunde A kann mit seinem Schlüssel keine Lieferung von Kunde B lesen', async () => {
    const keyB = await createKey(['spend'], users.adminB);
    const sent = await v1(keyB, 'POST', '/batches', {
      object_type: 'spend',
      idempotency_key: `b-${run}`,
      rows: [spendRow('B-1', `${year - 2}-01`, '1.00')],
    });
    await queue.drain();
    const id = (sent.body as ApiBatchResponse).batch_id;
    expect((await v1(key, 'GET', `/batches/${id}`)).status).toBe(404);
    expect((await v1(keyB, 'GET', `/batches/${id}`)).status).toBe(200);
    // Auch ein zweiter Schlüssel desselben Kunden liest nur eigene Lieferungen
    const other = await createKey(['spend']);
    const own = await deliver(key, {
      object_type: 'spend',
      idempotency_key: `own-${run}`,
      rows: [],
    });
    expect((await v1(other, 'GET', `/batches/${own.first.batch_id}`)).status).toBe(404);
  });

  it('die Seite Anbindungen zeigt die Lieferung, der Test-Lieferant sieht nichts davon', async () => {
    expect(
      (await call(users.admin, 'POST', '/einstellungen/anbindungen/import_api/verbinden', {}))
        .status,
    ).toBe(200);
    await deliver(key, {
      object_type: 'spend',
      idempotency_key: `page-${run}`,
      rows: [spendRow(numbers.s1, `${year - 7}-01`, '1.00'), spendRow(numbers.s1, 'x', '1.00')],
    });
    const page = (await call(users.admin, 'GET', '/einstellungen/anbindungen')).body as {
      connectors: {
        key: string;
        connection: { lastJob: { itemsIn: number; itemsFailed: number } } | null;
      }[];
    };
    expect(
      page.connectors.find((entry) => entry.key === 'import_api')?.connection?.lastJob,
    ).toMatchObject({
      itemsIn: 2,
      itemsFailed: 1,
    });
    const keys = apiKeysSchema.parse(
      (await call(users.admin, 'GET', '/einstellungen/anbindungen/schluessel')).body,
    );
    expect(keys.lastDelivery).toMatchObject({ rowsTotal: 2, rowsError: 1 });
    expect(
      (await call(users.supplier, 'GET', '/einstellungen/anbindungen/schluessel')).status,
    ).toBe(403);
    const seen = await db.execute(sql`
      select 1 from api_key k where k.org_id = ${orgs.s1}
      union all select 1 from spend_period p where p.org_id = ${orgs.s1}`);
    expect(seen.rows).toEqual([]);
  });

  it('Lieferantenstamm über die API: neue Lieferanten warten auf Prüfung', async () => {
    const { state } = await deliver(key, {
      object_type: 'supplier',
      idempotency_key: `supplier-${run}`,
      rows: [
        {
          external_number: numbers.s1,
          name: `IN07 Rheintal ${run}`,
          country: 'DE',
          vat_id: 'DE123',
        },
        { external_number: `NEU-${run}`, name: `Neu ${run}`, country: 'DE' },
      ],
    });
    expect(state.errors).toEqual([{ row: 2, field: 'vat_id', reason: 'vat_id oder duns fehlt' }]);
    expect(state.status).toBe('committed');
  });
});
