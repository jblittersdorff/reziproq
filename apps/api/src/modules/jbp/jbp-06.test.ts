import { createHash, randomUUID } from 'node:crypto';
import { type Database, schema, sql, withTenant } from '@reziproq/db';
import {
  dueListSchema,
  jbpApprovalViewSchema,
  jbpVersionsSchema,
  supplierOverviewSchema,
} from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';

// Tests zu docs/specs/JBP-06.md: Freigabe erst mit beiden Seiten, gesperrter Inhalt nach der
// Freigabe, neue Version mit erneuter Freigabe, Zurückgeben nur mit Begründung, Zyklus-Schritt JBP.
describe('JBP-06 Freigabe und Versionen des Gemeinsamen Plans', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const run = randomUUID().slice(0, 8);
  const orgs = { oem: randomUUID(), supplier: randomUUID() };
  const rel = randomUUID();
  const cycleId = randomUUID();
  const users = { sro: `jbp06-sro-${run}`, kam: `jbp06-kam-${run}` };
  const buyer = `/suppliers/${rel}/jbp`;
  const supplier = `/kunden/${rel}/jbp`;
  let initiativeId = '';
  let commitmentId = '';

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
  const view = async (user: string, base: string) =>
    jbpApprovalViewSchema.parse((await call(user, 'GET', `${base}/freigabe`)).body);
  const initiative = (title: string) => ({
    title,
    goal: 'Sichern',
    benefitBuyer: 'A',
    benefitSupplier: 'B',
    ownerBuyerName: 'Sara Ost',
    ownerSupplierName: 'Kim Kaiser',
    startsOn: '2099-01-01',
    endsOn: '2099-12-31',
  });

  beforeAll(async () => {
    testApp = await startTestApp();
    db = testApp.adminDb;
    await db.insert(schema.organization).values([
      { id: orgs.oem, name: `JBP6-OEM ${run}` },
      { id: orgs.supplier, name: `JBP6-Lieferant ${run}` },
    ]);
    await db
      .insert(schema.organizationFeature)
      .values({ organizationId: orgs.oem, feature: 'buyer' });
    const person = (id: string, name: string, organizationId: string) => ({
      id,
      name,
      email: `${id}@example.com`,
      organizationId,
      orgRole: 'admin' as const,
      rolesImportedAt: new Date(),
    });
    await db
      .insert(schema.appUser)
      .values([
        { ...person(users.sro, 'Sara Ost', orgs.oem), orgRole: 'member' as const },
        person(users.kam, 'Kim Kaiser', orgs.supplier),
      ]);
    await insertRelationships(db, [{ id: rel, buyer: orgs.oem, supplier: orgs.supplier }]);
    await db
      .insert(schema.relationshipMember)
      .values({ relationshipId: rel, orgId: orgs.oem, userId: users.sro, teamRole: 'sro' });
    // Die Person des Lieferanten hat die Einladung des Käufers angenommen; an sie geht die Mail.
    await db.insert(schema.invitation).values({
      relationshipId: rel,
      orgId: orgs.oem,
      email: `kim-${run}@lieferant.example`,
      tokenHash: createHash('sha256').update(run).digest('hex'),
      invitedBy: users.sro,
      expiresAt: new Date(Date.now() + 86_400_000),
      acceptedAt: new Date(),
      acceptedUserId: users.kam,
    });
    // Die Zyklus-Leiste gibt es nur bei Fokuslieferanten (ZYK-01).
    await db
      .insert(schema.relationshipSide)
      .values({ relationshipId: rel, orgId: orgs.oem, isFocus: true, focusReason: 'Test' });
    await db.insert(schema.cycle).values({
      id: cycleId,
      relationshipId: rel,
      label: '2099',
      status: 'active',
      jbpDate: '2099-01-15',
    });
    await call(users.sro, 'POST', buyer, {
      startsAt: '2099-01-15T09:00:00Z',
      location: null,
      locale: 'de',
    });
    await call(users.sro, 'POST', `${buyer}/themen`, { title: 'Ausfälle senken', description: '' });
    initiativeId = (
      (await call(users.sro, 'POST', `${buyer}/initiativen`, initiative('Zweitquelle'))).body as {
        initiative: { id: string };
      }
    ).initiative.id;
    const commitments = (
      await call(users.kam, 'POST', `${supplier}/zusagen`, {
        title: 'Kapazität reservieren',
        ownerUserId: users.kam,
        dueOn: '2099-02-28',
        initiativeId: null,
      })
    ).body as { supplier: { id: string }[] };
    commitmentId = commitments.supplier[0]?.id as string;
  });

  afterAll(async () => {
    await db.execute(sql`delete from jbp where relationship_id = ${rel}`);
    await db.execute(sql`delete from meeting where relationship_id = ${rel}`);
    await db.execute(sql`delete from invitation where relationship_id = ${rel}`);
    await deleteRelationships(db, Object.values(orgs));
    await db.execute(sql`delete from app_user where organization_id in ${Object.values(orgs)}`);
    await db.execute(sql`delete from organization_feature where organization_id = ${orgs.oem}`);
    await db.execute(sql`delete from organization where id in ${Object.values(orgs)}`);
    await testApp.close();
  });

  it('zurückgeben verlangt eine Begründung und setzt den Plan auf Entwurf', async () => {
    expect(await view(users.sro, buyer)).toMatchObject({ status: 'draft', canSubmit: true });
    // Der Lieferant kann nicht zur Prüfung geben, der Käufer nicht entscheiden.
    expect((await call(users.kam, 'POST', `${supplier}/freigabe/einreichen`)).status).toBe(404);
    const submitted = jbpApprovalViewSchema.parse(
      (await call(users.sro, 'POST', `${buyer}/freigabe/einreichen`)).body,
    );
    expect(submitted.status).toBe('in_review');
    const without = await call(users.kam, 'POST', `${supplier}/freigabe/entscheiden`, {
      decision: 'returned',
      comment: '  ',
    });
    expect(without.status).toBe(400);
    const returned = jbpApprovalViewSchema.parse(
      (
        await call(users.kam, 'POST', `${supplier}/freigabe/entscheiden`, {
          decision: 'returned',
          comment: 'Frist der Zusage zu knapp.',
        })
      ).body,
    );
    expect(returned.status).toBe('draft');
    expect(returned.decisions[0]).toMatchObject({
      side: 'supplier',
      decision: 'returned',
      comment: 'Frist der Zusage zu knapp.',
    });
  });

  it('der Plan ist erst freigegeben, wenn beide Seiten zugestimmt haben', async () => {
    await call(users.sro, 'POST', `${buyer}/freigabe/einreichen`);
    // Der Lieferant hat die Aufgabe auf Start, die Mail liegt im Postausgang.
    const due = dueListSchema.parse((await call(users.kam, 'GET', '/start/due')).body);
    expect(due.items.find((item) => item.kind === 'review')?.href).toBe(
      `/kunden/${rel}/plan/freigabe`,
    );
    const mails = await db.execute<{ count: number }>(
      sql`select count(*)::int as count from outbox_event where email_recipient = ${`kim-${run}@lieferant.example`}`,
    );
    expect(mails.rows[0]?.count).toBe(2);
    // Auch an der API vorbei: Der Käufer allein kann den Plan nicht freigeben.
    await expect(
      withTenant(db, { userId: users.sro, organizationId: orgs.oem }, (tx) =>
        tx.execute(
          sql`select app_jbp_transition((select id from jbp where relationship_id = ${rel}), 'approved')`,
        ),
      ),
    ).rejects.toThrow();
    expect((await view(users.kam, supplier)).canDecide).toBe(true);
    const approved = jbpApprovalViewSchema.parse(
      (
        await call(users.kam, 'POST', `${supplier}/freigabe/entscheiden`, {
          decision: 'approved',
          comment: null,
        })
      ).body,
    );
    expect(approved.status).toBe('approved');
    expect(approved.approvedAt).not.toBeNull();
    expect(approved.decisions.map((entry) => [entry.side, entry.decision])).toEqual([
      ['supplier', 'approved'],
      ['buyer', 'approved'],
      ['supplier', 'returned'],
      ['buyer', 'approved'],
    ]);
  });

  it('nach der Freigabe sind Inhalte gesperrt, Status und Meilensteine änderbar', async () => {
    expect(
      (await call(users.sro, 'PUT', `${buyer}/initiativen/${initiativeId}`, initiative('Neu')))
        .status,
    ).toBe(409);
    expect(
      (await call(users.sro, 'POST', `${buyer}/themen`, { title: 'Spät', description: '' })).status,
    ).toBe(409);
    expect(
      (
        await call(users.kam, 'PUT', `${supplier}/zusagen/${commitmentId}`, {
          title: 'Anders',
          ownerUserId: users.kam,
          dueOn: '2099-02-28',
          initiativeId: null,
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await call(users.sro, 'PUT', `${buyer}/initiativen/${initiativeId}/status`, {
          status: 'running',
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await call(users.sro, 'POST', `${buyer}/initiativen/${initiativeId}/meilensteine`, {
          title: 'Muster',
          dueOn: '2099-03-01',
          doneOn: null,
        })
      ).status,
    ).toBe(201);
    expect(
      (
        await call(users.kam, 'PUT', `${supplier}/zusagen/${commitmentId}/status`, {
          status: 'kept',
        })
      ).status,
    ).toBe(200);
  });

  it('die Freigabe erledigt den Zyklus-Schritt JBP', async () => {
    const overview = supplierOverviewSchema.parse(
      (await call(users.sro, 'GET', `/suppliers/${rel}/overview`)).body,
    );
    expect(overview.cycle?.steps.find((step) => step.key === 'jbp')).toMatchObject({
      status: 'completed',
      href: `/lieferanten/${rel}/plan/freigabe`,
    });
  });

  it('eine neue Version verlangt wieder beide Freigaben; die alte bleibt lesbar', async () => {
    const next = jbpApprovalViewSchema.parse(
      (await call(users.kam, 'POST', `${supplier}/freigabe/neue-version`)).body,
    );
    expect(next).toMatchObject({ status: 'draft', version: 2, decisions: [], canDecide: false });
    // Inhalte sind wieder änderbar.
    expect(
      (await call(users.sro, 'PUT', `${buyer}/initiativen/${initiativeId}`, initiative('Neu')))
        .status,
    ).toBe(200);
    const versions = jbpVersionsSchema.parse(
      (await call(users.sro, 'GET', `${buyer}/versionen`)).body,
    );
    expect(versions.versions).toHaveLength(1);
    expect(versions.versions[0]?.version).toBe(1);
    expect(versions.versions[0]?.content.initiatives.map((entry) => entry.title)).toEqual([
      'Zweitquelle',
    ]);
    expect(versions.versions[0]?.content.commitments[0]).toMatchObject({
      title: 'Kapazität reservieren',
      side: 'supplier',
    });
    // Version 2 wird erst mit beiden Freigaben gültig.
    await call(users.sro, 'POST', `${buyer}/freigabe/einreichen`);
    expect((await view(users.sro, buyer)).status).toBe('in_review');
    await call(users.kam, 'POST', `${supplier}/freigabe/entscheiden`, {
      decision: 'approved',
      comment: null,
    });
    const both = jbpVersionsSchema.parse(
      (await call(users.kam, 'GET', `${supplier}/versionen`)).body,
    );
    expect(both.versions.map((entry) => entry.version)).toEqual([2, 1]);
    expect(both.versions[0]?.content.initiatives[0]?.title).toBe('Neu');
  });
});
