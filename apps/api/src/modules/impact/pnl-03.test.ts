import { randomUUID } from 'node:crypto';
import { type Database, schema, sql, withTenant } from '@reziproq/db';
import { impactDetailSchema, initiativeDetailSchema } from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';

// Tests zu docs/specs/PNL-03.md: keine Stufe ohne Nachweis, R5 nur über PNL-06; eingefrorene
// Baseline unveränderbar, Änderungen als Version mit Begründung; der Lieferant sieht keine Baseline;
// der Verlauf zeigt jede Stufe mit Person, Datum und Nachweis.
describe('PNL-03 Baseline und Reifegrade', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const run = randomUUID().slice(0, 8);
  const orgs = { oem: randomUUID(), supplier: randomUUID() };
  const rel = randomUUID();
  const users = { sro: `pnl03-sro-${run}`, kam: `pnl03-kam-${run}` };
  const impact = `/suppliers/${rel}/wirkung`;
  let initiativeId = '';
  let decisionId = '';

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
  const raise = (body: Record<string, unknown>) =>
    call(users.sro, 'POST', `${impact}/initiativen/${initiativeId}/reifegrad`, {
      decisionId: null,
      implementedOn: null,
      evidence: null,
      evidenceLink: null,
      ...body,
    });

  beforeAll(async () => {
    testApp = await startTestApp();
    db = testApp.adminDb;
    await db.insert(schema.organization).values([
      { id: orgs.oem, name: `PNL3-OEM ${run}` },
      { id: orgs.supplier, name: `PNL3-Lieferant ${run}` },
    ]);
    await db
      .insert(schema.organizationFeature)
      .values({ organizationId: orgs.oem, feature: 'buyer' });
    await db.insert(schema.appUser).values([
      {
        id: users.sro,
        name: 'Sara Ost',
        email: `${users.sro}@example.com`,
        organizationId: orgs.oem,
        orgRole: 'member',
        rolesImportedAt: new Date(),
      },
      {
        id: users.kam,
        name: 'Kim Kaiser',
        email: `${users.kam}@example.com`,
        organizationId: orgs.supplier,
        orgRole: 'admin',
        rolesImportedAt: new Date(),
      },
    ]);
    await insertRelationships(db, [{ id: rel, buyer: orgs.oem, supplier: orgs.supplier }]);
    await db
      .insert(schema.relationshipMember)
      .values({ relationshipId: rel, orgId: orgs.oem, userId: users.sro, teamRole: 'sro' });
    const plan = (
      await call(users.sro, 'POST', `/suppliers/${rel}/jbp`, {
        startsAt: '2099-01-15T09:00:00Z',
        location: null,
        locale: 'de',
      })
    ).body as { meeting: { id: string } };
    initiativeId = (
      (
        await call(users.sro, 'POST', `/suppliers/${rel}/jbp/initiativen`, {
          title: 'Preis Leiterplatten',
          goal: 'Senken',
          benefitBuyer: 'A',
          benefitSupplier: 'B',
          ownerBuyerName: 'Sara Ost',
          ownerSupplierName: 'Kim Kaiser',
          startsOn: '2099-01-01',
          endsOn: '2099-12-31',
        })
      ).body as { initiative: { id: string } }
    ).initiative.id;
    // Ein Beschluss im Termin dient als Nachweis für R3.
    const [decision] = await db
      .insert(schema.meetingDecision)
      .values({
        meetingId: plan.meeting.id,
        relationshipId: rel,
        ownerOrgId: orgs.oem,
        visibility: 'shared',
        text: 'Preis ab Q2 um 3 % senken',
        position: 1,
      })
      .returning({ id: schema.meetingDecision.id });
    decisionId = decision?.id as string;
    await call(users.sro, 'PUT', `${impact}/initiativen/${initiativeId}/einrichten`, {
      lever: 'price',
      pnlLineKey: 'material',
      effectType: 'ebit',
      effectiveFrom: null,
    });
  });

  afterAll(async () => {
    await db.execute(sql`delete from jbp where relationship_id = ${rel}`);
    await db.execute(sql`delete from meeting where relationship_id = ${rel}`);
    await db.execute(sql`delete from pnl_line where org_id = ${orgs.oem}`);
    await deleteRelationships(db, Object.values(orgs));
    await db.execute(sql`delete from app_user where organization_id in ${Object.values(orgs)}`);
    await db.execute(sql`delete from organization_feature where organization_id = ${orgs.oem}`);
    await db.execute(sql`delete from organization where id in ${Object.values(orgs)}`);
    await testApp.close();
  });

  it('keine Stufe ohne Nachweis', async () => {
    // R2 braucht die eingefrorene Baseline.
    expect((await raise({ toLevel: 2 })).body).toMatchObject({ code: 'nachweis_fehlt' });
    // Nur eine Stufe auf einmal.
    expect((await raise({ toLevel: 3 })).body).toMatchObject({ code: 'nur_eine_stufe' });
    const frozen = await call(users.sro, 'POST', `${impact}/initiativen/${initiativeId}/baseline`, {
      inputs: { price_old: '1234' },
      changeReason: null,
    });
    expect(frozen.status).toBe(201);
    expect(impactDetailSchema.parse((await raise({ toLevel: 2 })).body).maturity.level).toBe(2);
    // R3: Plan noch nicht freigegeben und kein Beschluss gewählt.
    expect((await raise({ toLevel: 3 })).body).toMatchObject({ code: 'nachweis_fehlt' });
    expect(
      impactDetailSchema.parse((await raise({ toLevel: 3, decisionId })).body).maturity.level,
    ).toBe(3);
    // R4 verlangt Umsetzungsdatum und Nachweis.
    expect((await raise({ toLevel: 4, implementedOn: '2099-04-01' })).body).toMatchObject({
      code: 'nachweis_fehlt',
    });
    const r4 = impactDetailSchema.parse(
      (
        await raise({
          toLevel: 4,
          implementedOn: '2099-04-01',
          evidence: 'Neuer Preis im Rahmenvertrag',
          evidenceLink: 'https://example.com/vertrag',
        })
      ).body,
    );
    expect(r4.maturity.level).toBe(4);
    expect(r4.next).toMatchObject({ toLevel: 5, requirement: 'validation' });
  });

  it('R5 gibt es nur über die Freigabe durch Controlling', async () => {
    expect((await raise({ toLevel: 5 })).body).toMatchObject({ code: 'nur_ueber_freigabe' });
    // Auch an der API vorbei bleibt eine Stufe unveränderbar.
    const changed = await withTenant(db, { userId: users.sro, organizationId: orgs.oem }, (tx) =>
      tx.execute(sql`update maturity_step set to_level = 5 where initiative_id = ${initiativeId}`),
    ).catch((error: unknown) => error);
    expect(changed).toBeInstanceOf(Error);
  });

  it('eine eingefrorene Baseline ist unveränderbar; Änderungen erzeugen eine Version mit Begründung', async () => {
    const update = await withTenant(db, { userId: users.sro, organizationId: orgs.oem }, (tx) =>
      tx.execute(
        sql`update initiative_baseline set inputs = '{"price_old":"1"}' where initiative_id = ${initiativeId}`,
      ),
    ).catch((error: unknown) => error);
    expect(update).toBeInstanceOf(Error);
    const withoutReason = await call(
      users.sro,
      'POST',
      `${impact}/initiativen/${initiativeId}/baseline`,
      {
        inputs: { price_old: '1250' },
        changeReason: null,
      },
    );
    expect(withoutReason).toMatchObject({ status: 400, body: { code: 'begruendung_fehlt' } });
    const wrong = await call(users.sro, 'POST', `${impact}/initiativen/${initiativeId}/baseline`, {
      inputs: { price_old: '12.5' },
      changeReason: 'Cent',
    });
    expect(wrong).toMatchObject({ status: 400, body: { fields: ['price_old'] } });
    const second = impactDetailSchema.parse(
      (
        await call(users.sro, 'POST', `${impact}/initiativen/${initiativeId}/baseline`, {
          inputs: { price_old: '1250' },
          changeReason: 'Preisliste 2099 korrigiert',
        })
      ).body,
    );
    expect(
      second.baselines.map((entry) => [entry.version, entry.inputs.price_old, entry.changeReason]),
    ).toEqual([
      [2, '1250', 'Preisliste 2099 korrigiert'],
      [1, '1234', null],
    ]);
  });

  it('der Lieferant sieht keine Baseline, aber Reifegrad und Nachweise', async () => {
    const seen = await withTenant(
      db,
      { userId: users.kam, organizationId: orgs.supplier, customerOrganizationId: orgs.oem },
      (tx) =>
        tx.execute<{ count: number }>(
          sql`select count(*)::int as count from initiative_baseline where initiative_id = ${initiativeId}`,
        ),
    );
    expect(seen.rows[0]?.count).toBe(0);
    expect((await call(users.kam, 'GET', `${impact}/initiativen/${initiativeId}`)).status).toBe(
      403,
    );
    const supplierView = initiativeDetailSchema.parse(
      (await call(users.kam, 'GET', `/kunden/${rel}/jbp/initiativen/${initiativeId}`)).body,
    );
    expect(supplierView.maturity.level).toBe(4);
    expect(JSON.stringify(supplierView)).not.toContain('1250');
  });

  it('der Verlauf zeigt jede Stufe mit Person, Datum und Nachweis', async () => {
    const detail = impactDetailSchema.parse(
      (await call(users.sro, 'GET', `${impact}/initiativen/${initiativeId}`)).body,
    );
    expect(
      detail.maturity.steps.map((step) => [step.toLevel, step.decidedByName, step.evidence]),
    ).toEqual([
      [2, 'Sara Ost', 'Baseline Version 1 eingefroren'],
      [
        3,
        'Sara Ost',
        'Beschluss im Termin „Joint Business Planning 2099“: Preis ab Q2 um 3 % senken',
      ],
      [4, 'Sara Ost', 'Umgesetzt am 2099-04-01: Neuer Preis im Rahmenvertrag'],
    ]);
    expect(detail.maturity.steps.every((step) => step.decidedAt.length > 0)).toBe(true);
    expect(detail.maturity.steps[2]?.evidenceLink).toBe('https://example.com/vertrag');
  });
});
