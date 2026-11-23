import { randomUUID } from 'node:crypto';
import { type Database, schema, sql } from '@reziproq/db';
import { overviewInsightSchema, securedResultsSchema, supplierRingsSchema } from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';
import { InsightSummaryService } from '../ai-gateway/insight-summary.service.js';

// Tests zu docs/specs/AW-01.md in der API: Ringpaar der Übersicht und des Lieferanten aus
// bestehenden Daten. Gesichert nur vom Controlling bestätigt, kein äußerer Ring ohne Ziel, der
// innere Ring beim Lieferanten zählt nur fällige Zusagen, keine Summe über Wirkungsarten.
describe('AW-01 Beleg aus bestehenden Daten', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const run = randomUUID().slice(0, 8);
  const orgs = { oem: randomUUID(), other: randomUUID(), a: randomUUID(), b: randomUUID() };
  const rel = { a: randomUUID(), b: randomUUID() };
  const jbp = { a: randomUUID(), b: randomUUID() };
  const initiative = randomUUID();
  const group = randomUUID();
  const year = 2026;
  const users = {
    admin: `aw01-adm-${run}`,
    sro: `aw01-sro-${run}`,
    lead: `aw01-lead-${run}`,
    member: `aw01-mem-${run}`,
    other: `aw01-other-${run}`,
    supplier: `aw01-sup-${run}`,
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
  const overview = async (user = users.admin) =>
    overviewInsightSchema.parse((await call(user, 'GET', `/uebersicht?jahr=${year}`)).body);
  const rings = async (user = users.admin) =>
    supplierRingsSchema.parse(
      (await call(user, 'GET', `/suppliers/${rel.a}/ergebnisse/ringe?jahr=${year}`)).body,
    );

  beforeAll(async () => {
    testApp = await startTestApp();
    db = testApp.adminDb;
    await db.insert(schema.organization).values([
      { id: orgs.oem, name: `AW01-OEM ${run}` },
      { id: orgs.other, name: `AW01-Andere ${run}` },
      { id: orgs.a, name: `AW01-A ${run}` },
      { id: orgs.b, name: `AW01-B ${run}` },
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
        person(users.lead, orgs.oem, 'member'),
        person(users.member, orgs.oem, 'member'),
        person(users.other, orgs.other, 'admin'),
        person(users.supplier, orgs.a, 'admin'),
      ]);
    await insertRelationships(db, [
      { id: rel.a, buyer: orgs.oem, supplier: orgs.a },
      { id: rel.b, buyer: orgs.oem, supplier: orgs.b },
    ]);
    await db.insert(schema.relationshipSide).values([
      { relationshipId: rel.a, orgId: orgs.oem, isFocus: true, focusReason: 'Test' },
      { relationshipId: rel.b, orgId: orgs.oem, isFocus: true, focusReason: 'Test' },
    ]);
    await db.insert(schema.relationshipMember).values({
      relationshipId: rel.a,
      orgId: orgs.oem,
      userId: users.sro,
      teamRole: 'sro',
    });
    await db.insert(schema.materialGroup).values({
      id: group,
      orgId: orgs.oem,
      name: 'Leiterplatten',
      code: `LP-${run}`,
      leadUserId: users.lead,
    });
    await db
      .insert(schema.relationshipMaterialGroup)
      .values({ relationshipId: rel.a, materialGroupId: group, isPrimary: true });
    const jbpRow = (id: string, relationshipId: string, status: 'approved' | 'draft') => ({
      id,
      relationshipId,
      ownerOrgId: orgs.oem,
      status,
      createdBy: users.admin,
      createdByName: 'Ada Admin',
    });
    await db
      .insert(schema.jbp)
      .values([jbpRow(jbp.a, rel.a, 'approved'), jbpRow(jbp.b, rel.b, 'draft')]);
    await db.insert(schema.initiative).values({
      id: initiative,
      relationshipId: rel.a,
      ownerOrgId: orgs.oem,
      jbpId: jbp.a,
      title: 'Kupferklausel',
      goal: 'Preis',
      benefitBuyer: 'A',
      benefitSupplier: 'B',
      ownerBuyerName: 'Ada',
      ownerSupplierName: 'Kim',
      startsOn: '2026-01-01',
      endsOn: '2026-12-31',
      createdBy: users.admin,
      createdByName: 'Ada Admin',
    });
    const value = (
      month: string,
      kind: 'plan' | 'actual',
      valueCents: number,
      effectType = 'ebit',
    ) => ({
      relationshipId: rel.a,
      ownerOrgId: orgs.oem,
      visibility: 'internal' as const,
      initiativeId: initiative,
      month,
      kind,
      valueCents,
      effectType,
    });
    // März bestätigt, April nicht; dazu Plan im Juni
    await db
      .insert(schema.initiativeValue)
      .values([
        value('2026-03-01', 'actual', 3_000_000),
        value('2026-04-01', 'actual', 1_000_000),
        value('2026-06-01', 'plan', 2_000_000),
      ]);
    await db.insert(schema.initiativeValidation).values({
      relationshipId: rel.a,
      initiativeId: initiative,
      periodFrom: '2026-01-01',
      periodTo: '2026-03-31',
      status: 'approved',
      requestedBy: users.sro,
      requestedByName: 'Sara',
      decidedBy: users.admin,
      decidedByName: 'Ada',
      decidedAt: new Date(),
    });
    // Zusagen: zwei im Jahr fällig (eine eingehalten), eine im Vorjahr, eine erst 2027
    const commitment = (dueOn: string, status: 'open' | 'kept' | 'missed') => ({
      relationshipId: rel.a,
      ownerOrgId: orgs.oem,
      jbpId: jbp.a,
      side: 'buyer' as const,
      title: `Zusage ${dueOn}`,
      ownerName: 'Sara',
      dueOn,
      status,
      createdBy: users.sro,
      createdByName: 'Sara',
    });
    await db
      .insert(schema.commitment)
      .values([
        commitment('2026-02-01', 'kept'),
        commitment('2026-03-01', 'missed'),
        commitment('2025-06-01', 'kept'),
        commitment('2027-01-15', 'open'),
      ]);
  });

  afterAll(async () => {
    await db.execute(sql`delete from hint where org_id = ${orgs.oem}`);
    const orgIds = Object.values(orgs);
    await db.execute(sql`delete from value_opportunity where org_id in ${orgIds}`);
    await db.execute(sql`delete from insight_summary where org_id in ${orgIds}`);
    await db.execute(sql`delete from model_call where org_id in ${orgIds}`);
    await db.execute(sql`delete from relationship_ebit_target where org_id in ${orgIds}`);
    await db.execute(sql`delete from org_setting where org_id in ${orgIds}`);
    await db.execute(sql`delete from commitment where relationship_id in ${Object.values(rel)}`);
    await db.execute(sql`delete from initiative_validation where initiative_id = ${initiative}`);
    await db.execute(sql`delete from initiative_value where initiative_id = ${initiative}`);
    await db.execute(sql`delete from initiative where id = ${initiative}`);
    await db.execute(sql`delete from jbp where relationship_id in ${Object.values(rel)}`);
    await deleteRelationships(db, orgIds);
    await db.execute(sql`delete from app_user where organization_id in ${orgIds}`);
    await db.execute(sql`delete from organization_feature where organization_id in ${orgIds}`);
    await db.execute(sql`delete from organization where id in ${orgIds}`);
    await testApp.close();
  });

  it('gesichert zählt nur vom Controlling bestätigte Monate; EBIT und Cash stehen getrennt', async () => {
    const data = await overview();
    expect(data.securedEbitCents).toBe(3_000_000);
    expect(data.focusTotal).toBe(2);
    expect(data.focusWithApprovedJbp).toBe(1);
    expect(data.cashCents).toBe(0);
    expect(data.inProgress.highCents).toBeGreaterThanOrEqual(2_000_000);
  });

  it('die Brücke enthält nur vom Controlling bestätigte Werte; ihre Summe ist „Gesichert“', async () => {
    const data = securedResultsSchema.parse(
      (await call(users.admin, 'GET', `/suppliers/${rel.a}/ergebnisse/gesichert?jahr=${year}`))
        .body,
    );
    expect(data.steps).toEqual([
      expect.objectContaining({ initiativeId: initiative, securedCents: 3_000_000 }),
    ]);
    const sum = data.steps.reduce((total, step) => total + step.securedCents, 0);
    expect(sum).toBe(data.securedEbitCents);
    expect(sum).toBe((await rings()).securedEbitCents);
    // April ist Ist, aber nicht bestätigt: offene Bestätigung, kein Balken
    expect(data.pending).toEqual({ months: 1, initiatives: 1, amountCents: 1_000_000 });
    expect(data.others).toEqual([]);
    expect(
      (await call(users.other, 'GET', `/suppliers/${rel.a}/ergebnisse/gesichert`)).status,
    ).toBe(404);
    expect(
      (await call(users.supplier, 'GET', `/suppliers/${rel.a}/ergebnisse/gesichert`)).status,
    ).toBe(403);
  });

  it('ohne Jahresziel gibt es keinen äußeren Ring; Admin und Lead setzen es, andere nicht', async () => {
    expect((await overview()).goalEbitCents).toBeNull();
    expect((await overview(users.member)).canSetGoal).toBe(false);
    expect(
      (await call(users.member, 'PUT', '/uebersicht/ziel', { year, amountCents: 6_000_000 }))
        .status,
    ).toBe(403);
    expect((await overview(users.lead)).canSetGoal).toBe(true);
    expect(
      (await call(users.lead, 'PUT', '/uebersicht/ziel', { year, amountCents: 6_000_000 })).status,
    ).toBe(204);
    expect((await overview()).goalEbitCents).toBe(6_000_000);
  });

  it('der innere Ring beim Lieferanten zählt nur Zusagen, die im Zeitraum fällig waren', async () => {
    const data = await rings();
    expect(data.securedEbitCents).toBe(3_000_000);
    expect(data.commitments).toEqual({ due: 2, keptOnTime: 1 });
  });

  it('das Ziel des Lieferanten schlägt der SRO vor, Admin oder Lead gibt frei; erst dann zählt es', async () => {
    expect((await rings()).target).toBeNull();
    expect(
      (
        await call(users.member, 'PUT', `/suppliers/${rel.a}/ergebnisse/ziel`, {
          year,
          amountCents: 5_000_000,
        })
      ).status,
    ).toBe(403);
    expect(
      (
        await call(users.sro, 'PUT', `/suppliers/${rel.a}/ergebnisse/ziel`, {
          year,
          amountCents: 5_000_000,
        })
      ).status,
    ).toBe(204);
    expect((await rings(users.sro)).target).toMatchObject({
      ebitTargetCents: 5_000_000,
      approved: false,
    });
    expect((await rings(users.sro)).canApprove).toBe(false);
    expect(
      (await call(users.sro, 'POST', `/suppliers/${rel.a}/ergebnisse/ziel/freigeben`, { year }))
        .status,
    ).toBe(403);
    expect(
      (await call(users.lead, 'POST', `/suppliers/${rel.a}/ergebnisse/ziel/freigeben`, { year }))
        .status,
    ).toBe(204);
    expect((await rings()).target).toMatchObject({ approved: true });
  });

  it('die Karte „Größte Chance“ nimmt das offene Potenzial mit der höchsten unteren Spanne, ohne low', async () => {
    expect((await rings()).chance).toBeNull();
    const row = (confidence: 'low' | 'medium' | 'high', low: number, status = 'new' as const) => ({
      orgId: orgs.oem,
      relationshipId: rel.a,
      templateKey: 'index_clause',
      templateVersion: 1,
      title: 'Preisgleitklausel nach Index',
      reason: 'Test',
      impactType: 'ebit' as const,
      buyerLowCents: low,
      buyerHighCents: low * 2,
      confidence,
      confidenceReason: 'test',
      inputs: {},
      status,
    });
    await db.insert(schema.valueOpportunity).values([row('low', 9_000_000)]);
    expect((await rings()).chance).toBeNull();
    await db
      .insert(schema.valueOpportunity)
      .values([row('medium', 3_000_000), row('high', 5_000_000)]);
    expect((await rings()).chance).toMatchObject({
      low: 5_000_000,
      high: 10_000_000,
      confidence: 'high',
    });
  });

  it('die Karte „Größtes Risiko“ nimmt den offenen Hinweis mit dem höchsten score; ohne Hinweis fehlt sie', async () => {
    expect((await rings()).risk ?? null).toBeNull();
    const hint = (score: number, title: string, status: 'open' | 'dismissed' = 'open') => ({
      orgId: orgs.oem,
      relationshipId: rel.a,
      ruleKey: 'performance_drop' as const,
      fingerprint: `${score}`,
      detail: { kpi: 'Liefertreue', months: 3 },
      status,
      ...(status === 'dismissed' ? { reason: 'Test' } : {}),
      severity: 'high' as const,
      score,
      title,
    });
    await db
      .insert(schema.hint)
      .values([
        hint(400, '„Liefertreue“ seit 3 Monaten unter Ziel und schlechter'),
        hint(900, 'Verworfen und darum kein Risiko', 'dismissed'),
        hint(100, 'Kleiner Hinweis'),
      ]);
    expect((await rings()).risk).toMatchObject({
      ruleKey: 'performance_drop',
      severity: 'high',
      detail: { kpi: 'Liefertreue', months: 3 },
    });
    // Wer nicht im Team ist und kein Admin, sieht das Risiko nicht
    expect((await rings(users.member)).risk ?? null).toBeNull();
    // Ohne blockiertes Potenzial nennt „Was hakt“ den Hinweis mit dem höchsten score
    const sentences = (await overview()).sentences ?? [];
    const stuck = sentences.find((entry) => entry.kind === 'stuck');
    expect(stuck?.text).toBe(
      `Bei AW01-A ${run}: „Liefertreue“ seit 3 Monaten unter Ziel und schlechter.`,
    );
    expect(stuck?.href).toMatch(/^\/hinweise\?hinweis=/);
    // Die folgenden Tests prüfen die Sätze ohne Hinweise.
    await db.execute(sql`delete from hint where org_id = ${orgs.oem}`);
  });

  it('die Aussage nennt nur Zahlen aus den Fakten; die drei Sätze folgen der Regel', async () => {
    // Der Admin hat in dieser Stunde schon eine Aussage mit anderen Fakten: dann nur der Beleg.
    expect((await overview()).statement).toBeNull();
    const data = await overview(users.sro);
    // Jahresziel 60.000 €, gesichert 30.000 € (aus dem Test davor)
    expect(data.statement?.headline).toBe('Gesichert sind 50\u00a0% des Jahresziels.');
    expect(data.statement?.body).toMatch(/fehlen 30\.000\s€/);
    const kinds = (data.sentences ?? []).map((entry) => entry.kind);
    expect(kinds).toContain('good');
    expect(data.sentences?.find((entry) => entry.kind === 'good')?.text).toMatch(
      new RegExp(`^AW01-A ${run} trägt 30\\.000\\s€ bei, 50\\s% des Jahresziels\\.$`),
    );
    // Rheintal B hat keinen freigegebenen JBP, aber kein Potenzial: kein Satz „Was hakt“
    expect(kinds).not.toContain('stuck');
  });

  it('ändern sich die Fakten nicht, entsteht keine neue Aussage; je Person eine eigene', async () => {
    const calls = async () =>
      (
        await db.execute<{ n: string }>(
          sql`select count(*)::text as n from model_call where org_id = ${orgs.oem} and feature = 'insight_summary'`,
        )
      ).rows[0]?.n;
    const before = await calls();
    const first = await overview(users.sro);
    expect(await calls()).toBe(before);
    expect((await overview(users.sro)).statement?.id).toBe(first.statement?.id);
    const lead = await overview(users.lead);
    expect(lead.statement?.id).not.toBe(first.statement?.id);
    // „Stimmt nicht“ nur für die eigene Aussage
    const id = first.statement?.id as string;
    expect((await call(users.lead, 'POST', `/aussagen/${id}/stimmt-nicht`)).status).toBe(404);
    expect((await call(users.sro, 'POST', `/aussagen/${id}/stimmt-nicht`)).status).toBe(204);
  });

  it('eine Aussage mit einer Zahl, die nicht in den Fakten steht, wird unterdrückt', async () => {
    const service = testApp.app.get(InsightSummaryService);
    service.testModelText = () =>
      JSON.stringify({
        headline: 'Gesichert sind 77 % des Ziels.',
        body: 'Das liegt an 12345 Euro.',
      });
    try {
      expect((await overview(users.member)).statement).toBeNull();
      const [row] = (
        await db.execute<{ status: string }>(
          sql`select status from insight_summary where org_id = ${orgs.oem} and user_id = ${users.member} and page_key = 'overview'`,
        )
      ).rows;
      expect(row?.status).toBe('suppressed');
    } finally {
      service.testModelText = undefined;
    }
  });

  it('„Was hakt“ nennt das größte Potenzial ohne freigegebenen JBP, „Was ihr tun solltet“ die Handlung', async () => {
    await db.insert(schema.valueOpportunity).values({
      orgId: orgs.oem,
      relationshipId: rel.b,
      templateKey: 'index_clause',
      templateVersion: 1,
      title: 'Preisgleitklausel nach Index',
      reason: 'Test',
      impactType: 'ebit',
      buyerLowCents: 1_000_000,
      buyerHighCents: 2_000_000,
      confidence: 'medium',
      confidenceReason: 'test',
      inputs: {},
    });
    const sentences = (await overview()).sentences ?? [];
    expect(sentences.find((entry) => entry.kind === 'stuck')?.text).toMatch(
      new RegExp(`^Bei AW01-B ${run} wartet ein Potenzial von 10\\.000\\s€ bis 20\\.000\\s€ EBIT`),
    );
    expect(sentences.find((entry) => entry.kind === 'todo')).toMatchObject({
      text: `Als Nächstes: den JBP mit AW01-B ${run} freigeben.`,
      href: '/mein-tag',
    });
  });

  it('ein fremder Käufer und der Test-Lieferant sehen keinen Ring und keine Zahl', async () => {
    expect((await call(users.other, 'GET', `/suppliers/${rel.a}/ergebnisse/ringe`)).status).toBe(
      404,
    );
    const other = await overview(users.other);
    expect(other).toMatchObject({ securedEbitCents: 0, focusTotal: 0 });
    expect((await call(users.supplier, 'GET', '/uebersicht')).status).toBe(403);
    expect((await call(users.supplier, 'GET', `/suppliers/${rel.a}/ergebnisse/ringe`)).status).toBe(
      403,
    );
  });
  it('NAV-10: ein Käufer ohne Zugriff sieht den Lieferanten in keiner Zahl, keinem Highlight und keiner Matrix', async () => {
    // Gegenprobe: die eigene Organisation sieht Lieferant, Hinweis und Potenzial
    const own = JSON.stringify((await call(users.admin, 'GET', '/hinweise')).body);
    expect(own).toContain(rel.a);
    const paths = [
      `/uebersicht?jahr=${year}`,
      '/uebersicht/wertpotenziale',
      '/portfolio',
      '/portfolio/matrix',
      '/start',
      '/start/due',
      '/hinweise',
      '/suppliers',
    ];
    for (const path of paths) {
      const response = await call(users.other, 'GET', path);
      expect(response.status, path).toBeLessThan(500);
      const text = JSON.stringify(response.body);
      for (const secret of [rel.a, rel.b, `AW01-A ${run}`, `AW01-B ${run}`, 'Kupferklausel']) {
        expect(text, `${path} nennt ${secret}`).not.toContain(secret);
      }
    }
    const overview = overviewInsightSchema.parse(
      (await call(users.other, 'GET', `/uebersicht?jahr=${year}`)).body,
    );
    expect(overview).toMatchObject({ securedEbitCents: 0, focusTotal: 0, cashCents: 0 });
    expect(overview.inProgress).toEqual({ lowCents: 0, highCents: 0 });
  });
});
