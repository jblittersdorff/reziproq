import { randomUUID } from 'node:crypto';
import { type Database, schema, sql } from '@reziproq/db';
import { defaultAiSettings, valueOpportunitiesSchema } from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';
import { queryAllowed, reasonAllowed } from './market.js';
import { OpportunitiesService } from './opportunities.service.js';

// Tests zu docs/specs/KI-11.md in der API: Lauf mit Anbieter fake und Testquellen, Rechnung nach
// Vorlage, Signale mit genau einem Ergebnis, Recherche nur wenn eingeschaltet, Filter vor dem Senden,
// Summen ohne low, Annahmen mit Protokoll, Thema ohne Zahl, Trennung der Beziehungen.
describe('KI-11 Wertpotenzial-Finder', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const run = randomUUID().slice(0, 8);
  const orgs = { oem: randomUUID(), other: randomUUID(), a: randomUUID(), b: randomUUID() };
  const rel = { a: randomUUID(), b: randomUUID() };
  const group = randomUUID();
  const users = {
    admin: `ki11-adm-${run}`,
    sro: `ki11-sro-${run}`,
    member: `ki11-mem-${run}`,
    other: `ki11-other-${run}`,
    supplier: `ki11-sup-${run}`,
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
  const research = (on: boolean) =>
    call(users.admin, 'PUT', '/einstellungen/ki', { ...defaultAiSettings, publicResearch: on });
  const start = async (relationshipId = rel.a, user = users.sro) => {
    const response = await call(user, 'POST', `/suppliers/${relationshipId}/wertpotenziale/lauf`);
    expect(response.status).toBe(201);
    return valueOpportunitiesSchema.parse(response.body);
  };
  const index = (data: ReturnType<typeof valueOpportunitiesSchema.parse>) =>
    data.opportunities.find((entry) => entry.templateKey === 'index_clause');

  beforeAll(async () => {
    testApp = await startTestApp();
    db = testApp.adminDb;
    await db.insert(schema.organization).values([
      { id: orgs.oem, name: `KI11-OEM ${run}` },
      { id: orgs.other, name: `KI11-Andere ${run}` },
      { id: orgs.a, name: `KI11-A ${run} GmbH` },
      { id: orgs.b, name: `KI11-B ${run} GmbH` },
    ]);
    await db.insert(schema.organizationFeature).values([
      { organizationId: orgs.oem, feature: 'buyer' },
      { organizationId: orgs.other, feature: 'buyer' },
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
        person(users.admin, orgs.oem, 'admin'),
        person(users.sro, orgs.oem, 'member'),
        person(users.member, orgs.oem, 'member'),
        person(users.other, orgs.other, 'admin'),
        person(users.supplier, orgs.a, 'admin'),
      ]);
    await insertRelationships(db, [
      { id: rel.a, buyer: orgs.oem, supplier: orgs.a },
      { id: rel.b, buyer: orgs.oem, supplier: orgs.b },
    ]);
    await db.insert(schema.relationshipMember).values([
      { relationshipId: rel.a, orgId: orgs.oem, userId: users.sro, teamRole: 'sro' },
      { relationshipId: rel.b, orgId: orgs.oem, userId: users.sro, teamRole: 'sro' },
    ]);
    await db.insert(schema.materialGroup).values({
      id: group,
      orgId: orgs.oem,
      name: 'Leiterplatten',
      code: `LP-${run}`,
    });
    await db
      .insert(schema.relationshipMaterialGroup)
      .values({ relationshipId: rel.a, materialGroupId: group, isPrimary: true });
    // Spend: A 3 Mio. €, B 5 Mio. € im Vorjahr
    const lastYear = new Date().getUTCFullYear() - 1;
    await db.insert(schema.relationshipSpend).values([
      { relationshipId: rel.a, year: lastYear, amountCents: 300_000_000 },
      { relationshipId: rel.b, year: lastYear, amountCents: 500_000_000 },
    ]);
    await db.insert(schema.jbp).values({
      relationshipId: rel.a,
      ownerOrgId: orgs.oem,
      status: 'draft',
      createdBy: users.admin,
      createdByName: 'Ada Admin',
    });
  });

  afterAll(async () => {
    const orgIds = Object.values(orgs);
    const rels = Object.values(rel);
    await db.execute(sql`delete from value_opportunity where relationship_id in ${rels}`);
    await db.execute(sql`delete from value_market_signal where relationship_id in ${rels}`);
    await db.execute(sql`delete from value_data_gap where relationship_id in ${rels}`);
    await db.execute(sql`delete from jbp where relationship_id in ${rels}`);
    await db.execute(sql`delete from agent where org_id in ${orgIds}`);
    await db.execute(sql`delete from model_call where org_id in ${orgIds}`);
    await db.execute(sql`delete from org_setting where org_id in ${orgIds}`);
    await db.execute(sql`delete from outbox_event where org_id in ${orgIds}`);
    await db.execute(sql`delete from relationship_spend where relationship_id in ${rels}`);
    await deleteRelationships(db, orgIds);
    await db.execute(sql`delete from material_group where id = ${group}`);
    await db.execute(sql`delete from app_user where organization_id in ${orgIds}`);
    await db.execute(sql`delete from organization_feature where organization_id in ${orgIds}`);
    await db.execute(sql`delete from organization where id in ${orgIds}`);
    await testApp.close();
  });

  it('ohne öffentliche Recherche keine Signale und keine Anfragen nach außen', async () => {
    expect((await research(false)).status).toBe(200);
    const data = await start();
    expect(data.researchEnabled).toBe(false);
    expect(data.signals).toEqual([]);
    expect(data.outbound).toEqual([]);
    // Ohne Index aus dem Marktumfeld ist die Preisgleitklausel nicht prüfbar
    expect(data.dataGaps.map((gap) => gap.dataKey)).toEqual(
      expect.arrayContaining(['base_index', 'current_index']),
    );
  });

  it('ein Lauf erzeugt je prüfbarer Vorlage ein Potenzial oder „ohne Potenzial“, sonst eine Datenlücke', async () => {
    expect((await research(true)).status).toBe(200);
    const data = await start();
    expect(data.checked.templates).toBe(9);
    expect(data.checked.checkable).toBe(
      data.checked.withOpportunity + data.checked.withoutOpportunity.length,
    );
    expect(data.checked.checkable + data.checked.notCheckable).toBe(9);
    expect(data.checked.withOpportunity).toBeGreaterThanOrEqual(1);
    const blocked = new Set(data.dataGaps.flatMap((gap) => gap.templatesBlocked));
    expect(blocked.size).toBe(data.checked.notCheckable);
    expect(blocked.has('index_clause')).toBe(false);
    expect(blocked.has('capacity_shortage')).toBe(true);
    expect(data.lastRun?.status).toBe('done');
  });

  it('die Werte stimmen mit der Rechnung von Hand, auch mit Indexwerten aus den Testquellen', async () => {
    const data = valueOpportunitiesSchema.parse(
      (await call(users.member, 'GET', `/suppliers/${rel.a}/wertpotenziale`)).body,
    );
    // 3 Mio. € × Materialanteil 30–50 % × (1 − 88/100)
    expect(index(data)).toMatchObject({
      buyer: { low: 10_800_000, high: 18_000_000 },
      impactType: 'ebit',
      confidence: 'medium',
      fromMarket: true,
      supplierEffect: 'Absicherung gegen Anstieg des Index',
    });
    const steps = index(data)?.steps ?? [];
    expect(steps.find((step) => step.key === 'current_index')).toMatchObject({
      low: '88',
      source: 'public_source',
    });
    expect(steps.find((step) => step.key === 'eligible_annual_cost_cents')).toMatchObject({
      low: '300000000',
      source: 'own_data',
    });
    expect(data.canDecide).toBe(false);
  });

  it('jedes Marktsignal hat genau ein Ergebnis; alte und undatierte Quellen werden kein Signal', async () => {
    const data = valueOpportunitiesSchema.parse(
      (await call(users.sro, 'GET', `/suppliers/${rel.a}/wertpotenziale`)).body,
    );
    expect(data.signals.map((signal) => [signal.kind, signal.outcome])).toEqual([
      ['raw_material', 'opportunity'],
      ['tariff_regulation', 'data_gap'],
      ['technology', 'topic'],
      ['supplier_public', 'no_effect'],
    ]);
    expect(data.signals.map((signal) => signal.title)).not.toContain('Alte Marktstudie');
    expect(data.signals.map((signal) => signal.title)).not.toContain('Undatierte Meldung');
    expect(data.signals.every((signal) => signal.outcomeReason.length > 0)).toBe(true);
    expect(data.checked.signals).toBe(4);
    expect(data.outbound.length).toBe(4);
  });

  it('eine Suchanfrage mit einer Zahl aus dem Spend wird nicht gesendet', async () => {
    expect(queryAllowed('Leiterplatten 3.000.000 Rohstoffe', ['300000000', '3000000'])).toBe(false);
    expect(queryAllowed('Leiterplatten Rohstoffe Index', ['300000000', '3000000'])).toBe(true);
    await db
      .update(schema.materialGroup)
      .set({ name: 'Leiterplatten 3000000' })
      .where(sql`${schema.materialGroup.id} = ${group}`);
    try {
      const data = await start();
      expect(data.outbound.map((query) => query.text)).toEqual([`KI11-A ${run} Geschäftsbericht`]);
    } finally {
      await db
        .update(schema.materialGroup)
        .set({ name: 'Leiterplatten' })
        .where(sql`${schema.materialGroup.id} = ${group}`);
    }
  });

  it('eine Modellausgabe mit einer Zahl, die in keiner Eingabe vorkommt, wird verworfen', async () => {
    expect(reasonAllowed('Spart 18000000 Cent.', ['18000000'])).toBe(true);
    expect(reasonAllowed('Spart 12345 Euro.', ['18000000'])).toBe(false);
    const service = testApp.app.get(OpportunitiesService);
    service.testModelText = () => 'Das spart sicher 12345 Euro im Jahr.';
    try {
      const data = await start();
      expect(index(data)?.reason).toBe(
        'Berechnet nach der Vorlage „Preisgleitklausel nach Index“ aus den Eingaben im Rechenweg.',
      );
    } finally {
      service.testModelText = undefined;
    }
    // Ein neuer Lauf ersetzt das offene Potenzial derselben Vorlage
    const rows = await db
      .select({ status: schema.valueOpportunity.status })
      .from(schema.valueOpportunity)
      .where(sql`${schema.valueOpportunity.relationshipId} = ${rel.a}
        and ${schema.valueOpportunity.templateKey} = 'index_clause'`);
    expect(rows.filter((row) => row.status === 'new')).toHaveLength(1);
    expect(rows.filter((row) => row.status === 'superseded').length).toBeGreaterThan(0);
  });

  it('Annahmen ändern rechnet neu und protokolliert Person, Zeit, alten und neuen Wert', async () => {
    const data = valueOpportunitiesSchema.parse(
      (await call(users.sro, 'GET', `/suppliers/${rel.a}/wertpotenziale`)).body,
    );
    const id = index(data)?.id as string;
    expect(
      (
        await call(users.member, 'PUT', `/suppliers/${rel.a}/wertpotenziale/${id}/annahmen`, {
          inputs: { material_share: { low: '0.4', high: '0.4' } },
        })
      ).status,
    ).toBe(403);
    const changed = valueOpportunitiesSchema.parse(
      (
        await call(users.sro, 'PUT', `/suppliers/${rel.a}/wertpotenziale/${id}/annahmen`, {
          inputs: { material_share: { low: '0.4', high: '0.4' } },
        })
      ).body,
    );
    // 3 Mio. € × 40 % × 12 %
    expect(index(changed)).toMatchObject({ buyer: { low: 14_400_000, high: 14_400_000 } });
    expect(index(changed)?.steps.find((step) => step.key === 'material_share')?.source).toBe(
      'user_assumption',
    );
    const [event] = await db
      .select()
      .from(schema.auditEvent)
      .where(sql`${schema.auditEvent.objectType} = 'value_opportunity'
        and ${schema.auditEvent.objectId} = ${id}`);
    expect(event?.actorUserId).toBe(users.sro);
    expect(event?.occurredAt).toBeInstanceOf(Date);
    expect(JSON.stringify(event?.changes)).toContain('0.3');
    expect(JSON.stringify(event?.changes)).toContain('0.4');
  });

  it('die Summen zeigen EBIT und Cash getrennt und lassen Potenziale mit low weg', async () => {
    const extra = (confidence: 'low' | 'medium', cents: number) => ({
      orgId: orgs.oem,
      relationshipId: rel.a,
      templateKey: 'consignment',
      templateVersion: 1,
      title: 'Konsignationslager',
      reason: 'Test',
      impactType: 'cash' as const,
      buyerLowCents: cents,
      buyerHighCents: cents,
      confidence,
      confidenceReason: 'test',
      inputs: {},
    });
    await db
      .insert(schema.valueOpportunity)
      .values([extra('low', 99_000_000), extra('medium', 2_000_000)]);
    const data = valueOpportunitiesSchema.parse(
      (await call(users.sro, 'GET', `/suppliers/${rel.a}/wertpotenziale`)).body,
    );
    expect(data.totals.find((total) => total.impactType === 'cash')?.new).toEqual({
      low: 2_000_000,
      high: 2_000_000,
    });
    // Die Preisgleitklausel trägt seit der geänderten Annahme die Stufe low und fehlt in der Summe.
    expect(index(data)?.confidence).toBe('low');
    expect(data.totals.find((total) => total.impactType === 'ebit')?.new).toEqual({ low: 0, high: 0 });
  });

  it('das Thema aus einem Potenzial enthält keine Zahl aus dem Rechenweg und keine Quelle', async () => {
    const data = valueOpportunitiesSchema.parse(
      (await call(users.sro, 'GET', `/suppliers/${rel.a}/wertpotenziale`)).body,
    );
    const id = index(data)?.id as string;
    const proposal = (
      await call(users.sro, 'GET', `/suppliers/${rel.a}/wertpotenziale/${id}/vorschlag`)
    ).body as { title: string; description: string };
    expect(`${proposal.title} ${proposal.description}`).not.toMatch(/\d|https?:/);
    const adopted = valueOpportunitiesSchema.parse(
      (
        await call(
          users.sro,
          'POST',
          `/suppliers/${rel.a}/wertpotenziale/${id}/uebernehmen`,
          proposal,
        )
      ).body,
    );
    expect(index(adopted)?.status).toBe('adopted');
    expect(adopted.counts.adopted).toBe(1);
    const topics = await db
      .select({ title: schema.jbpTopic.title, description: schema.jbpTopic.description })
      .from(schema.jbpTopic)
      .where(sql`${schema.jbpTopic.relationshipId} = ${rel.a}`);
    expect(topics).toEqual([proposal]);
  });

  it('Kostendaten von Lieferant A tauchen in keinem Potenzial von Lieferant B auf', async () => {
    const data = await start(rel.b);
    const values = JSON.stringify(data.opportunities);
    expect(values).not.toContain('300000000');
    expect(index(data)?.steps.find((step) => step.key === 'eligible_annual_cost_cents')?.low).toBe(
      '500000000',
    );
    const rows = await db
      .select({ inputs: schema.valueOpportunity.inputs })
      .from(schema.valueOpportunity)
      .where(sql`${schema.valueOpportunity.relationshipId} = ${rel.b}`);
    expect(JSON.stringify(rows)).not.toContain(rel.a);
  });

  it('der Test-Lieferant und ein fremder Käufer sehen nichts; nur SRO oder Admin starten', async () => {
    expect((await call(users.supplier, 'GET', `/suppliers/${rel.a}/wertpotenziale`)).status).toBe(
      403,
    );
    expect(
      (await call(users.supplier, 'POST', `/suppliers/${rel.a}/wertpotenziale/lauf`)).status,
    ).toBe(403);
    expect((await call(users.other, 'GET', `/suppliers/${rel.a}/wertpotenziale`)).status).toBe(404);
    expect(
      (await call(users.member, 'POST', `/suppliers/${rel.a}/wertpotenziale/lauf`)).status,
    ).toBe(403);
  });
});
