import { randomUUID } from 'node:crypto';
import { type Database, schema, sql, withTenant } from '@reziproq/db';
import { customerImpactSchema, impactListSchema } from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';

// Tests zu docs/specs/PNL-07.md: Sichtbarkeit je Tabelle und Seite, keine Summe über Wirkungsarten,
// Savings-Verweis zählt nicht und ist markiert, Anteile ergeben 100 %, der Käufer sieht den
// eigenen Nutzen des Lieferanten nie.
describe('PNL-07 Teilungsregel, Wirkungsarten und Doppelzählung', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const run = randomUUID().slice(0, 8);
  const orgs = { oem: randomUUID(), supplier: randomUUID() };
  const rel = randomUUID();
  const users = {
    sro: `pnl07-sro-${run}`,
    member: `pnl07-m-${run}`,
    kam: `pnl07-kam-${run}`,
    supplierMember: `pnl07-sm-${run}`,
  };
  const impact = `/suppliers/${rel}/wirkung`;
  const customer = `/kunden/${rel}/wirkung`;
  const ids = { price: '', avoid: '', quality: '' };

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
  /** Initiative mit Wirkung, Baseline und einem Ist-Monat. */
  const prepare = async (
    title: string,
    lever: string,
    effectType: string,
    baseline: object,
    month: object,
  ) => {
    const id = (
      (
        await call(users.sro, 'POST', `/suppliers/${rel}/jbp/initiativen`, {
          title,
          goal: 'Ziel',
          benefitBuyer: 'A',
          benefitSupplier: 'B',
          ownerBuyerName: 'Sara Ost',
          ownerSupplierName: 'Kim Kaiser',
          startsOn: '2099-01-01',
          endsOn: '2099-12-31',
        })
      ).body as { initiative: { id: string } }
    ).initiative.id;
    await call(users.sro, 'PUT', `${impact}/initiativen/${id}/einrichten`, {
      lever,
      pnlLineKey: 'material',
      effectType,
      effectiveFrom: null,
    });
    await call(users.sro, 'POST', `${impact}/initiativen/${id}/baseline`, {
      inputs: baseline,
      changeReason: null,
    });
    await call(users.sro, 'POST', `${impact}/initiativen/${id}/monate`, {
      month: '2099-03',
      kind: 'actual',
      inputs: month,
    });
    return id;
  };
  const list = async () => impactListSchema.parse((await call(users.sro, 'GET', impact)).body);
  const supplierView = async () =>
    customerImpactSchema.parse((await call(users.kam, 'GET', customer)).body);

  beforeAll(async () => {
    testApp = await startTestApp();
    db = testApp.adminDb;
    await db.insert(schema.organization).values([
      { id: orgs.oem, name: `PNL7-OEM ${run}` },
      { id: orgs.supplier, name: `PNL7-Lieferant ${run}` },
    ]);
    await db
      .insert(schema.organizationFeature)
      .values({ organizationId: orgs.oem, feature: 'buyer' });
    const person = (
      id: string,
      name: string,
      organizationId: string,
      orgRole: 'admin' | 'member',
    ) => ({
      id,
      name,
      email: `${id}@example.com`,
      organizationId,
      orgRole,
      rolesImportedAt: new Date(),
    });
    await db
      .insert(schema.appUser)
      .values([
        person(users.sro, 'Sara Ost', orgs.oem, 'member'),
        person(users.member, 'Tom Berg', orgs.oem, 'member'),
        person(users.kam, 'Kim Kaiser', orgs.supplier, 'member'),
        person(users.supplierMember, 'Lea Lang', orgs.supplier, 'member'),
      ]);
    await insertRelationships(db, [{ id: rel, buyer: orgs.oem, supplier: orgs.supplier }]);
    await db.insert(schema.relationshipMember).values([
      { relationshipId: rel, orgId: orgs.oem, userId: users.sro, teamRole: 'sro' },
      { relationshipId: rel, orgId: orgs.oem, userId: users.member, teamRole: 'member' },
      { relationshipId: rel, orgId: orgs.supplier, userId: users.kam, teamRole: 'sro' },
    ]);
    await call(users.sro, 'POST', `/suppliers/${rel}/jbp`, {
      startsAt: '2099-01-15T09:00:00Z',
      location: null,
      locale: 'de',
    });
    // Preis: (12,34 € − 12,00 €) × 100 = 34 € EBIT; Kostenvermeidung: (50 € − 48 €) × 10 = 20 €.
    ids.price = await prepare(
      'Preis',
      'price',
      'ebit',
      { price_old: '1234' },
      {
        price_new: '1200',
        quantity: '100',
      },
    );
    ids.avoid = await prepare(
      'Vermeidung',
      'cost_avoidance',
      'cost_avoidance',
      {
        price_requested: '5000',
      },
      { price_agreed: '4800', quantity: '10' },
    );
    ids.quality = await prepare(
      'Qualität',
      'price',
      'ebit',
      { price_old: '1100' },
      {
        price_new: '1000',
        quantity: '10',
      },
    );
  });

  afterAll(async () => {
    await db.execute(sql`delete from supplier_benefit where relationship_id = ${rel}`);
    await db.execute(sql`delete from jbp where relationship_id = ${rel}`);
    await db.execute(sql`delete from meeting where relationship_id = ${rel}`);
    await db.execute(sql`delete from pnl_line where org_id = ${orgs.oem}`);
    await deleteRelationships(db, Object.values(orgs));
    await db.execute(sql`delete from app_user where organization_id in ${Object.values(orgs)}`);
    await db.execute(sql`delete from organization_feature where organization_id = ${orgs.oem}`);
    await db.execute(sql`delete from organization where id in ${Object.values(orgs)}`);
    await testApp.close();
  });

  it('keine Schnittstelle bildet eine Summe über mehrere Wirkungsarten', async () => {
    const data = await list();
    expect(data.totals).toEqual([
      { effectType: 'ebit', plan: 0, actual: 34_00 + 10_00 },
      { effectType: 'cost_avoidance', plan: 0, actual: 20_00 },
    ]);
    for (const body of [data, await supplierView()]) {
      expect(Object.keys(body)).not.toContain('total');
      expect(JSON.stringify(body)).not.toContain(String(34_00 + 10_00 + 20_00));
    }
  });

  it('die Anteile ergeben zusammen 100 %; nur SRO oder Admin schlagen vor', async () => {
    const share = (buyerSharePct: number, supplierSharePct: number) => ({
      buyerSharePct,
      supplierSharePct,
      ruleText: 'Je zur Hälfte nach Abzug der Werkzeugkosten',
    });
    expect(
      (await call(users.sro, 'PUT', `${impact}/initiativen/${ids.price}/teilung`, share(70, 20)))
        .status,
    ).toBe(400);
    expect(
      (await call(users.member, 'PUT', `${impact}/initiativen/${ids.price}/teilung`, share(60, 40)))
        .status,
    ).toBe(403);
    expect(
      (await call(users.sro, 'PUT', `${impact}/initiativen/${ids.price}/teilung`, share(60, 40)))
        .status,
    ).toBe(200);
    await expect(
      db.execute(
        sql`update initiative_share set supplier_share_pct = 30 where initiative_id = ${ids.price}`,
      ),
    ).rejects.toThrow();
  });

  it('die Wirkung sieht der Lieferant erst nach seiner Bestätigung; ändert der Käufer, wieder nicht', async () => {
    const before = (await supplierView()).initiatives.find((entry) => entry.id === ids.price);
    expect(before?.share).toMatchObject({
      buyerSharePct: 60,
      supplierSharePct: 40,
      agreedAt: null,
    });
    expect(before?.value).toBeNull();
    expect(
      (
        await call(
          users.supplierMember,
          'POST',
          `${customer}/initiativen/${ids.price}/teilung/bestaetigen`,
        )
      ).status,
    ).toBe(403);
    const confirmed = customerImpactSchema.parse(
      (await call(users.kam, 'POST', `${customer}/initiativen/${ids.price}/teilung/bestaetigen`))
        .body,
    );
    const agreed = confirmed.initiatives.find((entry) => entry.id === ids.price);
    expect(agreed?.share?.supplierConfirmedByName).toBe('Kim Kaiser');
    expect(agreed?.value).toEqual({ effectType: 'ebit', plan: 0, actual: 34_00 });
    // Nicht vereinbarte Initiativen bleiben unsichtbar, auch in den Summen.
    expect(confirmed.totals).toEqual([{ effectType: 'ebit', plan: 0, actual: 34_00 }]);
    await call(users.sro, 'PUT', `${impact}/initiativen/${ids.price}/teilung`, {
      buyerSharePct: 50,
      supplierSharePct: 50,
      ruleText: null,
    });
    const reset = (await supplierView()).initiatives.find((entry) => entry.id === ids.price);
    expect(reset?.share?.agreedAt).toBeNull();
    expect(reset?.value).toBeNull();
  });

  it('eine Initiative mit Savings-Verweis zählt in keiner Summe und ist markiert', async () => {
    expect(
      (
        await call(users.sro, 'PUT', `${impact}/initiativen/${ids.quality}/savings`, {
          system: 'Coupa',
          reference: 'SAV-2099-17',
        })
      ).status,
    ).toBe(200);
    const data = await list();
    expect(data.initiatives.find((entry) => entry.id === ids.quality)?.savingsReference).toEqual({
      system: 'Coupa',
      reference: 'SAV-2099-17',
    });
    expect(data.totals.find((total) => total.effectType === 'ebit')?.actual).toBe(34_00);
    // Den Verweis sieht der Lieferant nie.
    expect(JSON.stringify(await supplierView())).not.toContain('SAV-2099-17');
  });

  it('den eigenen Nutzen sieht nur der Lieferant, nie der Käufer', async () => {
    const saved = customerImpactSchema.parse(
      (
        await call(users.kam, 'POST', `${customer}/initiativen/${ids.price}/nutzen`, {
          month: '2099-03-01',
          amountCents: 7_77,
          currency: 'EUR',
          note: 'Weniger Rüstzeit',
        })
      ).body,
    );
    expect(saved.benefitTotals).toEqual([{ currency: 'EUR', amountCents: 7_77 }]);
    expect(JSON.stringify(await list())).not.toContain('Weniger Rüstzeit');
    const seen = await withTenant(
      db,
      { userId: users.sro, organizationId: orgs.oem },
      async (tx) =>
        (
          await tx.execute(
            sql`select count(*)::int as n from supplier_benefit where relationship_id = ${rel}`,
          )
        ).rows,
    );
    expect(seen).toEqual([{ n: 0 }]);
    const references = await withTenant(
      db,
      { userId: users.kam, organizationId: orgs.supplier, customerOrganizationId: orgs.oem },
      async (tx) =>
        (
          await tx.execute(
            sql`select count(*)::int as n from savings_reference where relationship_id = ${rel}`,
          )
        ).rows,
    );
    expect(references).toEqual([{ n: 0 }]);
  });
});
