import { randomUUID } from 'node:crypto';
import { type Database, eq, schema, sql } from '@reziproq/db';
import { importBatchListSchema, importBatchSchema } from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';
import { ImportsService } from './imports.service.js';

// Tests zu docs/specs/KI-15.md: Lieferanten über Alias, USt-ID und Ähnlichkeit, Warengruppen über
// Regeln und Modell, nichts vom Modell ohne Entscheidung, Summe auf den Cent, Lernen aus
// Entscheidungen, keine Datei zweimal, Rückgängig, Trennung der Kunden, nichts für den Lieferanten.
describe('KI-15 Import und Zuordnung', () => {
  const run = randomUUID().slice(0, 8);
  const digits = () => String(Math.floor(Math.random() * 1e9)).padStart(9, '0');
  const orgs = {
    a: randomUUID(),
    b: randomUUID(),
    rheintal: randomUUID(),
    silesia: randomUUID(),
  };
  const users = {
    admin: `ki15-adm-${run}`,
    cm: `ki15-cm-${run}`,
    adminB: `ki15-admb-${run}`,
    supplier: `ki15-sup-${run}`,
  };
  const rel = { rheintal: randomUUID(), silesia: randomUUID(), bOwn: randomUUID() };
  const groups = { lp: randomUUID(), guss: randomUUID(), foreign: randomUUID() };
  const vat = `DE${digits()}`;
  const year = new Date().getUTCFullYear() - 1;
  let app: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  let service: ImportsService;

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
  async function upload(user: string, name: string, content: string, kind = 'spend') {
    const form = new FormData();
    form.append('file', new Blob([content], { type: 'text/csv' }), name);
    const response = await fetch(`${app.baseUrl}/api/einstellungen/importe?art=${kind}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${await app.signToken({ subject: user })}` },
      body: form,
    });
    return { status: response.status, body: (await response.json().catch(() => null)) as unknown };
  }
  const batch = (body: unknown) => importBatchSchema.parse(body);
  /** Hochladen, Spalten bestätigen, verarbeiten */
  async function prepare(name: string, content: string, user = users.admin) {
    const uploaded = batch((await upload(user, name, content)).body);
    expect(
      (
        await call(user, 'PUT', `/einstellungen/importe/${uploaded.id}/spalten`, {
          columnMap: uploaded.suggestedMap,
        })
      ).status,
    ).toBe(200);
    const processed = await call(user, 'POST', `/einstellungen/importe/${uploaded.id}/verarbeiten`);
    expect(processed.status).toBe(200);
    return batch(processed.body);
  }
  const header =
    'Lieferantennummer;Name;Ort;Land;USt-IdNr;Buchungsdatum;Betrag;Währung;Materialgruppe;Text';
  const spendFile = [
    header,
    `4711;Rheintal Elektronik GmbH;Speyer;DE;;15.03.${year};1000,00;EUR;Z-LP;Leiterplatten 4-lagig`,
    `9001;Ganz anderer Name AG;Berlin;DE;${vat};20.03.${year};250,50;EUR;Z-LP;Leiterplatten Muster`,
    `9002;Silesia Gus;Gliwice;PL;;01.04.${year};500,00;EUR;;Gussteile für Gehäuse`,
    `9003;Nordwind Kunststoffwerk;Ulm;DE;;01.04.${year};80,00;EUR;;Frachtkosten Express`,
    `9004;Rheintal Elektronik GmbH;Speyer;DE;;01.05.${year};100,00;CNY;Z-LP;Leiterplatten`,
    `9005;Rheintal Elektronik GmbH;Speyer;DE;;01.05.${year};;EUR;Z-LP;Leiterplatten`,
  ].join('\n');
  const rowOf = (value: ReturnType<typeof batch>, externalNumber: string) =>
    value.rows.find((row) => row.normalized.externalNumber === externalNumber);

  beforeAll(async () => {
    app = await startTestApp();
    db = app.adminDb;
    service = app.app.get(ImportsService);
    await db.insert(schema.organization).values([
      { id: orgs.a, name: `KI15 OEM A ${run}` },
      { id: orgs.b, name: `KI15 OEM B ${run}` },
      { id: orgs.rheintal, name: `Rheintal Elektronik GmbH ${run}`, country: 'DE', vatId: vat },
      { id: orgs.silesia, name: `Silesia Guss Sp. z o.o. ${run}`, country: 'PL' },
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
        organizationId: key === 'adminB' ? orgs.b : key === 'supplier' ? orgs.rheintal : orgs.a,
        orgRole: key === 'cm' ? ('member' as const) : ('admin' as const),
        rolesImportedAt: new Date(),
      })),
    );
    await insertRelationships(db, [
      { id: rel.rheintal, buyer: orgs.a, supplier: orgs.rheintal },
      { id: rel.silesia, buyer: orgs.a, supplier: orgs.silesia },
      { id: rel.bOwn, buyer: orgs.b, supplier: orgs.rheintal },
    ]);
    // Anzeigenamen und eigene Nummer beim Käufer A
    await db.execute(sql`
      insert into relationship_side (relationship_id, org_id, display_name, external_ref) values
        (${rel.rheintal}, ${orgs.a}, 'Rheintal Elektronik GmbH', '4711'),
        (${rel.silesia}, ${orgs.a}, 'Silesia Guss', null)
      on conflict (relationship_id, org_id) do update set display_name = excluded.display_name,
        external_ref = excluded.external_ref`);
    await db.insert(schema.materialGroup).values([
      {
        id: groups.lp,
        orgId: orgs.a,
        name: 'Leiterplatten',
        code: `LP-${run}`,
        commodityManagerUserId: users.cm,
      },
      { id: groups.guss, orgId: orgs.a, name: 'Gussteile', code: `GU-${run}` },
      { id: groups.foreign, orgId: orgs.b, name: 'Fremde Gruppe', code: `FR-${run}` },
    ]);
    // Gelernte Regel aus einem früheren Import: ERP-Materialgruppe Z-LP → Leiterplatten
    await db.insert(schema.categoryRule).values({
      orgId: orgs.a,
      materialGroupId: groups.lp,
      field: 'material_group',
      pattern: 'Z-LP',
      createdBy: users.admin,
    });
  });

  afterAll(async () => {
    const ids = [orgs.a, orgs.b];
    await db.execute(sql`delete from import_batch where org_id in ${ids}`);
    await db.execute(sql`delete from supplier_alias where org_id in ${ids}`);
    await db.execute(sql`delete from category_rule where org_id in ${ids}`);
    await db.execute(sql`delete from model_call where org_id in ${ids}`);
    const relationships = (
      await db.execute<{ id: string; supplier_org_id: string }>(
        sql`select id, supplier_org_id from relationship where buyer_org_id in ${ids}`,
      )
    ).rows;
    const relationshipIds = relationships.map((row) => row.id);
    if (relationshipIds.length > 0) {
      await db.execute(
        sql`delete from relationship_spend where relationship_id in ${relationshipIds}`,
      );
      await db.execute(
        sql`delete from relationship_material_group where relationship_id in ${relationshipIds}`,
      );
    }
    await db.execute(sql`delete from material_group where org_id in ${ids}`);
    await deleteRelationships(db, ids);
    const created = relationships
      .map((row) => row.supplier_org_id)
      .filter((id) => !(Object.values(orgs) as string[]).includes(id));
    await db.execute(sql`delete from outbox_event where org_id in ${ids}`);
    await db.execute(sql`delete from app_user where organization_id in ${[...ids, orgs.rheintal]}`);
    await db.execute(
      sql`delete from organization where id in ${[...Object.values(orgs), ...created]}`,
    );
    await app.close();
  });

  it('bekannte Lieferantennummern und gelernte Regeln ordnen ohne Modellaufruf zu', async () => {
    const before = service.modelCalls;
    const result = await prepare(
      'bekannt.csv',
      [header, `4711;Rheintal Elektronik GmbH;Speyer;DE;;15.03.${year};10,00;EUR;Z-LP;LP`].join(
        '\n',
      ),
    );
    expect(result.rowsOk).toBe(1);
    expect(service.modelCalls).toBe(before);
    const [row] = await db
      .select()
      .from(schema.importRow)
      .where(eq(schema.importRow.batchId, result.id));
    expect(row).toMatchObject({
      relationshipId: rel.rheintal,
      matchMethod: 'alias',
      categoryMethod: 'rule',
      materialGroupId: groups.lp,
    });
  });

  let spendBatch: string;

  it('gleiche USt-ID mit anderem Namen gehört zum selben Lieferanten; Ähnlichkeit 0,80 bleibt zur Prüfung', async () => {
    const result = await prepare('spend.csv', spendFile);
    spendBatch = result.id;
    const rows = await db
      .select()
      .from(schema.importRow)
      .where(eq(schema.importRow.batchId, result.id));
    const byNumber = (number: string) =>
      rows.find((row) => (row.normalized as { externalNumber?: string }).externalNumber === number);
    expect(byNumber('9001')).toMatchObject({ relationshipId: rel.rheintal, matchMethod: 'vat_id' });
    const silesia = byNumber('9002');
    expect(silesia?.status).toBe('review');
    expect(silesia?.relationshipId).toBeNull();
    const [score] = (
      await db.execute<{ s: number }>(
        sql`select similarity('silesia gus', 'silesia guss')::float8 as s`,
      )
    ).rows;
    expect(Number(score?.s)).toBeGreaterThanOrEqual(0.7);
    expect(Number(score?.s)).toBeLessThan(0.92);
  });

  it('ein Vorschlag des Modells wird nie ohne Entscheidung übernommen', async () => {
    const value = batch(
      (await call(users.admin, 'GET', `/einstellungen/importe/${spendBatch}`)).body,
    );
    const silesia = rowOf(value, '9002');
    expect(silesia?.suggestion?.relationshipId).toBe(rel.silesia);
    expect(silesia?.supplier).toBeNull();
    expect(silesia?.needs).toContain('supplier');
    // Fehler: Fremdwährung ohne Kurs und Betrag leer
    expect(value.errors.map((entry) => entry.reason).sort()).toEqual([
      'Betrag leer',
      'Währung CNY ohne Kurs',
    ]);
  });

  it('das Modell kann keine Warengruppe zurückgeben, die der Kunde nicht hat', async () => {
    service.testModel = ({ rows }) => ({
      suppliers: [],
      categories: rows.map((row) => ({
        rowId: row.id,
        materialGroupId: groups.foreign,
        confidence: 0.99,
        reason: 'Fremde Gruppe',
      })),
    });
    try {
      const result = await prepare(
        'fremd.csv',
        [header, `7777;Völlig Unbekannt KG;Bonn;DE;;01.02.${year};5,00;EUR;;Irgendwas`].join('\n'),
      );
      const [row] = await db
        .select()
        .from(schema.importRow)
        .where(eq(schema.importRow.batchId, result.id));
      expect(row?.materialGroupId).toBeNull();
      expect(row?.categorySuggestion).toBeNull();
    } finally {
      service.testModel = undefined;
    }
  });

  it('ein Commodity Manager entscheidet nur Warengruppen; eine Entscheidung legt Alias und Regel an', async () => {
    const value = batch(
      (await call(users.admin, 'GET', `/einstellungen/importe/${spendBatch}`)).body,
    );
    const silesia = rowOf(value, '9002');
    const nordwind = rowOf(value, '9003');
    expect(
      (
        await call(users.cm, 'POST', `/einstellungen/importe/${spendBatch}/entscheiden`, {
          rowIds: [silesia?.id],
          action: 'supplier',
          relationshipId: rel.silesia,
        })
      ).status,
    ).toBe(403);
    // Admin: Lieferant übernehmen (Alias), Warengruppe setzen (Regel), Neu anlegen
    expect(
      (
        await call(users.admin, 'POST', `/einstellungen/importe/${spendBatch}/entscheiden`, {
          rowIds: [silesia?.id],
          action: 'accept',
        })
      ).status,
    ).toBe(200);
    await call(users.admin, 'POST', `/einstellungen/importe/${spendBatch}/entscheiden`, {
      rowIds: [silesia?.id],
      action: 'category',
      materialGroupId: groups.guss,
    });
    await call(users.admin, 'POST', `/einstellungen/importe/${spendBatch}/entscheiden`, {
      rowIds: [nordwind?.id],
      action: 'new',
    });
    const after = batch(
      (
        await call(users.admin, 'POST', `/einstellungen/importe/${spendBatch}/entscheiden`, {
          rowIds: [nordwind?.id],
          action: 'category',
          materialGroupId: null,
        })
      ).body,
    );
    expect(after.rowsReview).toBe(0);
    const aliases = await db
      .select()
      .from(schema.supplierAlias)
      .where(eq(schema.supplierAlias.orgId, orgs.a));
    expect(
      aliases.some(
        (alias) => alias.externalNumber === '9002' && alias.relationshipId === rel.silesia,
      ),
    ).toBe(true);
    const rules = await db
      .select()
      .from(schema.categoryRule)
      .where(eq(schema.categoryRule.orgId, orgs.a));
    expect(rules.some((rule) => rule.materialGroupId === groups.guss)).toBe(true);
  });

  it('die Summe des übernommenen Spend stimmt auf den Cent mit der Datei abzüglich der Fehlerzeilen', async () => {
    const committed = await call(
      users.admin,
      'POST',
      `/einstellungen/importe/${spendBatch}/uebernehmen`,
    );
    expect(committed.status).toBe(200);
    expect(batch(committed.body).status).toBe('committed');
    const [sum] = (
      await db.execute<{ cents: string }>(sql`
        select coalesce(sum(s.amount_cents), 0)::text as cents from relationship_spend s
        join relationship r on r.id = s.relationship_id
        where r.buyer_org_id = ${orgs.a} and s.source = 'import' and s.year = ${year}`)
    ).rows;
    // 1000,00 + 250,50 + 500,00 + 80,00; CNY und leerer Betrag sind Fehler
    expect(Number(sum?.cents)).toBe(183_050);
    const nordwind = await db.execute<{ id: string }>(sql`
      select r.id from relationship r join relationship_side s on s.relationship_id = r.id
      where r.buyer_org_id = ${orgs.a} and s.display_name = 'Nordwind Kunststoffwerk'`);
    expect(nordwind.rows).toHaveLength(1);
  });

  it('ein zweiter Import derselben Datei ordnet ohne Prüfung zu, wird aber nicht zweimal übernommen', async () => {
    const again = await prepare('spend.csv', spendFile);
    // Nur die Fracht, die bewusst keiner Warengruppe zugeordnet wurde, steht wieder zur Prüfung.
    expect(again.rowsReview).toBeLessThanOrEqual(1);
    const silesia = (
      await db.select().from(schema.importRow).where(eq(schema.importRow.batchId, again.id))
    ).find((row) => (row.normalized as { externalNumber?: string }).externalNumber === '9002');
    expect(silesia).toMatchObject({ matchMethod: 'alias', relationshipId: rel.silesia });
    const twice = await call(users.admin, 'POST', `/einstellungen/importe/${again.id}/uebernehmen`);
    expect(twice.status).toBe(409);
    expect((twice.body as { code: string }).code).toBe('datei_schon_uebernommen');
  });

  it('Rückgängig machen stellt den Stand vor dem Import wieder her', async () => {
    const reverted = await call(
      users.admin,
      'POST',
      `/einstellungen/importe/${spendBatch}/rueckgaengig`,
    );
    expect(reverted.status).toBe(200);
    expect(batch(reverted.body).status).toBe('reverted');
    const [sum] = (
      await db.execute<{ n: string }>(sql`
        select count(*)::text as n from relationship_spend s join relationship r on r.id = s.relationship_id
        where r.buyer_org_id = ${orgs.a} and s.source = 'import' and s.year = ${year}`)
    ).rows;
    expect(Number(sum?.n)).toBe(0);
    const nordwind = await db.execute<{ id: string }>(sql`
      select r.id from relationship r join relationship_side s on s.relationship_id = r.id
      where r.buyer_org_id = ${orgs.a} and s.display_name = 'Nordwind Kunststoffwerk'`);
    expect(nordwind.rows).toHaveLength(0);
  });

  it('Kunde B sieht weder Importe noch Aliasse noch Regeln von Kunde A; der Lieferant nichts', async () => {
    const list = importBatchListSchema.parse(
      (await call(users.adminB, 'GET', '/einstellungen/importe')).body,
    );
    expect(list.batches.some((entry) => entry.id === spendBatch)).toBe(false);
    expect((await call(users.adminB, 'GET', `/einstellungen/importe/${spendBatch}`)).status).toBe(
      404,
    );
    // Bei B greift kein Alias von A: dieselbe Nummer bleibt zur Prüfung oder wird über die Nummer von B erkannt
    const bResult = await prepare(
      'b.csv',
      [header, `9002;Silesia Gus;Gliwice;PL;;01.04.${year};500,00;EUR;;Gussteile`].join('\n'),
      users.adminB,
    );
    const [bRow] = await db
      .select()
      .from(schema.importRow)
      .where(eq(schema.importRow.batchId, bResult.id));
    expect(bRow?.matchMethod).not.toBe('alias');
    expect(bRow?.materialGroupId).toBeNull();
    expect((await call(users.supplier, 'GET', '/einstellungen/importe')).status).toBe(403);
  });
});
