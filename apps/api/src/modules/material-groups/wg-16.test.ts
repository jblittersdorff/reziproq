import { randomUUID } from 'node:crypto';
import { type Database, schema, sql, withTenant } from '@reziproq/db';
import {
  approvalViewSchema,
  lastFullYear,
  relevanceKeys,
  strategyContextResponseSchema,
} from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';
import { ApprovalService } from './approval.service.js';
import { StrategyService } from './strategy.service.js';

// Tests zu docs/specs/WG-16.md (Freigabe), je Kriterium aus „Fertig, wenn“.
describe('WG-16 Freigabe', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const run = randomUUID().slice(0, 8);
  const orgs = { a: randomUUID(), s1: randomUUID() };
  const rel = randomUUID();
  const groups = { hh: randomUUID(), hl: randomUUID(), lh: randomUUID(), ll: randomUUID() };
  const strategies: Record<keyof typeof groups, string> = { hh: '', hl: '', lh: '', ll: '' };
  const u = (key: string) => `wg16-${key}-${run}`;
  const users = {
    lead: u('lead'),
    cm: u('cm'),
    admin: u('admin'),
    board1: u('board1'),
    board2: u('board2'),
    head: u('head'),
    tandem1: u('tandem1'),
    tandem2: u('tandem2'),
    dept: u('dept'),
    reader: u('reader'),
    supplier: u('sup'),
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
  const base = (key: keyof typeof groups) => `/warengruppen/strategien/${strategies[key]}`;
  const view = async (key: keyof typeof groups, user = users.lead) =>
    approvalViewSchema.parse((await call(user, 'GET', `${base(key)}/freigabe`)).body);
  const scores = (value: number) =>
    Object.fromEntries(relevanceKeys.map((key) => [key, value])) as Record<string, number>;
  const prepare = async (key: keyof typeof groups, relevance: number) => {
    await call(users.lead, 'PUT', `${base(key)}/relevanz`, { scores: scores(relevance) });
    await call(users.lead, 'PUT', `${base(key)}/zusammenfassung`, {
      statusQuo: 'Zwei Lieferanten tragen 65 % des Umsatzes.',
      targetState: 'Kapazität bestätigt bis 2033.',
      roadmap: 'Laminat direkt beziehen.',
    });
    await call(users.lead, 'POST', `${base(key)}/zusammenfassung/bestaetigen`);
  };

  beforeAll(async () => {
    testApp = await startTestApp();
    db = testApp.adminDb;
    await db.insert(schema.organization).values([
      { id: orgs.a, name: `WG16-A ${run}` },
      { id: orgs.s1, name: `WG16-Rheintal ${run}` },
    ]);
    await db
      .insert(schema.organizationFeature)
      .values({ organizationId: orgs.a, feature: 'buyer' });
    await db.insert(schema.appUser).values(
      Object.entries(users).map(([key, id]) => ({
        id,
        name: key,
        email: `${id}@example.com`,
        organizationId: key === 'supplier' ? orgs.s1 : orgs.a,
        orgRole: key === 'admin' || key === 'supplier' ? ('admin' as const) : ('member' as const),
        rolesImportedAt: new Date(),
      })),
    );
    await insertRelationships(db, [{ id: rel, buyer: orgs.a, supplier: orgs.s1 }]);
    await db.insert(schema.materialGroup).values(
      Object.entries(groups).map(([key, id]) => ({
        id,
        orgId: orgs.a,
        name: `Gruppe ${key}`,
        code: `${key.toUpperCase()}-${run}`,
        leadUserId: users.lead,
        commodityManagerUserId: users.cm,
      })),
    );
    // Umsatz hoch: 20.000 € in hh und lh, gering: 1 € in hl und ll (Schwelle 10.000 €)
    await db.insert(schema.relationshipSpend).values(
      Object.entries(groups).map(([key, id]) => ({
        relationshipId: rel,
        year: lastFullYear(),
        amountCents: key.endsWith('h') ? 2_000_000 : 100,
        materialGroupId: id,
      })),
    );
    const saved = await call(users.admin, 'PUT', '/warengruppen/freigabeweg', {
      relevanceThreshold: 3.5,
      spendThresholdCents: 1_000_000,
      routes: {
        board: [users.board1, users.board2],
        head: [users.head],
        tandem: [users.tandem1, users.tandem2],
        department: [users.dept],
      },
    });
    expect(saved.status).toBe(200);
    for (const [key, id] of Object.entries(groups)) {
      strategies[key as keyof typeof groups] = strategyContextResponseSchema.parse(
        (await call(users.lead, 'POST', `/warengruppen/${id}/strategie`, { year: 2031 })).body,
      ).context?.strategy.id as string;
    }
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    const orgIds = Object.values(orgs);
    await db.execute(sql`delete from material_group_strategy where org_id in ${orgIds}`);
    await db.execute(sql`delete from material_group_relevance where org_id in ${orgIds}`);
    await db.execute(sql`delete from material_group_kpi where org_id in ${orgIds}`);
    await db.execute(sql`delete from material_group_question where org_id in ${orgIds}`);
    await db.execute(sql`delete from org_setting where org_id in ${orgIds}`);
    await deleteRelationships(db, orgIds);
    await db.execute(sql`delete from objective_category where org_id in ${orgIds}`);
    await db.execute(sql`delete from app_user where organization_id in ${orgIds}`);
    await db.execute(sql`delete from organization_feature where organization_id in ${orgIds}`);
    await db.execute(sql`delete from organization where id in ${orgIds}`);
    await testApp.close();
  });

  it('Vorlegen ist gesperrt, solange ein Schritt von 2 bis 9 offen ist', async () => {
    await prepare('hh', 5);
    const blocked = await call(users.lead, 'POST', `${base('hh')}/vorlegen`);
    expect(blocked).toMatchObject({
      status: 409,
      body: { code: 'submit_blocked', blockers: ['steps_open'] },
    });
    expect((blocked.body as { openSteps: number[] }).openSteps).toEqual([2, 3, 4, 5, 6, 7, 8, 9]);
    expect((await view('hh')).canSubmit).toBe(false);
    // Nur der Lead legt vor
    const other = await call(users.cm, 'POST', `${base('hh')}/vorlegen`);
    expect((other.body as { blockers: string[] }).blockers).toContain('not_lead');
  });

  it('für jede der vier Kombinationen aus Relevanz und Umsatz entstehen die richtigen Unterschriften', async () => {
    // Die Schritte 2 bis 9 gelten hier als fertig; das Sperren prüft der Test davor.
    vi.spyOn(testApp.app.get(StrategyService), 'stepStatesIn').mockResolvedValue(
      Array.from({ length: 10 }, () => 'done' as const),
    );
    await prepare('hl', 5);
    await prepare('lh', 2);
    await prepare('ll', 2);
    const expected = {
      hh: {
        route: 'board',
        signers: [
          ['lead', users.lead],
          ['commodity_manager', users.cm],
          ['approver', users.board1],
          ['approver', users.board2],
        ],
      },
      hl: {
        route: 'head',
        signers: [
          ['lead', users.lead],
          ['commodity_manager', users.cm],
          ['approver', users.head],
        ],
      },
      lh: {
        route: 'tandem',
        signers: [
          ['lead', users.lead],
          ['approver', users.tandem1],
          ['approver', users.tandem2],
        ],
      },
      ll: {
        route: 'department',
        signers: [
          ['lead', users.lead],
          ['approver', users.dept],
        ],
      },
    } as const;
    for (const key of Object.keys(expected) as (keyof typeof expected)[]) {
      const submitted = await call(users.lead, 'POST', `${base(key)}/vorlegen`);
      expect(submitted.status, key).toBe(201);
      const result = approvalViewSchema.parse(submitted.body);
      expect(result.route, key).toBe(expected[key].route);
      expect(result.approvals.map((entry) => [entry.role, entry.userId]).sort(), key).toEqual(
        [...expected[key].signers].map((entry) => [...entry]).sort(),
      );
      expect(result.approvals.find((entry) => entry.role === 'lead')?.status).toBe('signed');
    }
    // Admins übersteuern die Relevanz nur mit Begründung
    const noReason = await call(users.admin, 'PUT', `${base('ll')}/relevanz/uebersteuern`, {
      override: 'high',
      reason: '',
    });
    expect(noReason).toMatchObject({ status: 400, body: { code: 'reason_required' } });
  });

  it('Zurückgeben ohne Kommentar wird abgelehnt', async () => {
    const approval = (await view('lh', users.tandem1)).approvals.find(
      (entry) => entry.userId === users.tandem1,
    );
    expect(approval?.canDecide).toBe(true);
    const empty = await call(
      users.tandem1,
      'POST',
      `/warengruppen/freigaben/${approval?.id}/zurueckgeben`,
      {
        comment: '  ',
      },
    );
    expect(empty).toMatchObject({ status: 400, body: { code: 'comment_required' } });
    const returned = await call(
      users.tandem1,
      'POST',
      `/warengruppen/freigaben/${approval?.id}/zurueckgeben`,
      { comment: 'Roadmap ohne Termine.' },
    );
    expect(returned.status).toBe(201);
    expect(approvalViewSchema.parse(returned.body).status).toBe('resubmit');
    // Der Commodity Manager unterschreibt, gibt aber nicht zurück
    const cmRow = (await view('hh', users.cm)).approvals.find((entry) => entry.userId === users.cm);
    const cmReturn = await call(
      users.cm,
      'POST',
      `/warengruppen/freigaben/${cmRow?.id}/zurueckgeben`,
      {
        comment: 'Nein',
      },
    );
    expect(cmReturn.status).toBe(403);
  });

  it('eine freigegebene Strategie lässt sich nicht ändern; die Änderung erzeugt Version 2, Version 1 bleibt lesbar', async () => {
    const approval = (await view('ll', users.dept)).approvals.find(
      (entry) => entry.userId === users.dept,
    );
    const signed = await call(
      users.dept,
      'POST',
      `/warengruppen/freigaben/${approval?.id}/unterschreiben`,
    );
    expect(approvalViewSchema.parse(signed.body).status).toBe('approved');
    const edit = await call(users.lead, 'PUT', `${base('ll')}/schritte/9/notiz`, {
      view: '',
      text: 'Nachträglich',
      notApplicable: false,
    });
    expect(edit.status).toBe(403);
    const summary = await call(users.lead, 'PUT', `${base('ll')}/zusammenfassung`, {
      statusQuo: 'Neu',
      targetState: 'Neu',
      roadmap: 'Neu',
    });
    expect(summary.status).toBe(403);
    const created = await call(users.lead, 'POST', `${base('ll')}/neue-version`);
    expect(created).toMatchObject({ status: 201, body: { version: 2 } });
    const id = (created.body as { id: string }).id;
    const v2 = approvalViewSchema.parse(
      (await call(users.lead, 'GET', `/warengruppen/strategien/${id}/freigabe`)).body,
    );
    expect(v2).toMatchObject({ version: 2, status: 'draft' });
    expect(v2.summary).toMatchObject({
      statusQuo: 'Zwei Lieferanten tragen 65 % des Umsatzes.',
      status: 'draft',
    });
    expect(v2.versions.map((entry) => [entry.version, entry.status])).toEqual([
      [1, 'approved'],
      [2, 'draft'],
    ]);
    // Version 1 bleibt lesbar und unverändert; Leser sehen sie statt des Entwurfs
    expect((await view('ll')).status).toBe('approved');
    const reader = strategyContextResponseSchema.parse(
      (await call(users.reader, 'GET', `/warengruppen/${groups.ll}/strategie?jahr=2031`)).body,
    );
    expect(reader.context?.strategy).toMatchObject({ version: 1, status: 'approved' });
    const old = strategyContextResponseSchema.parse(
      (await call(users.lead, 'GET', `/warengruppen/${groups.ll}/strategie?jahr=2031&version=1`))
        .body,
    );
    expect(old.context?.strategy.id).toBe(strategies.ll);
    // Eine zweite neue Version aus Version 1 gibt es nicht
    expect((await call(users.lead, 'POST', `${base('ll')}/neue-version`)).body).toMatchObject({
      code: 'version_exists',
    });
  });

  it('zum Jahreswechsel entsteht genau ein Entwurf für das Folgejahr', async () => {
    const service = testApp.app.get(ApprovalService);
    const first = await service.createNextYearDrafts(orgs.a, new Date('2032-01-02T05:30:00Z'));
    expect(first).toHaveLength(1);
    const second = await service.createNextYearDrafts(orgs.a, new Date('2032-01-03T05:30:00Z'));
    expect(second).toHaveLength(0);
    const rows = await db.execute<{ version: number; status: string; group: string }>(sql`
      select version, status, material_group_id as group from material_group_strategy
      where org_id = ${orgs.a} and year = 2032`);
    expect(rows.rows).toEqual([{ version: 1, status: 'draft', group: groups.ll }]);
    const summary = await db.execute<{ status_quo: string }>(sql`
      select status_quo from material_group_summary where strategy_id = ${first[0]}`);
    expect(summary.rows[0]?.status_quo).toBe('Zwei Lieferanten tragen 65 % des Umsatzes.');
  });

  it('der Test-Lieferant sieht keine Freigabe', async () => {
    const supplier = await call(users.supplier, 'GET', `${base('hh')}/freigabe`);
    expect([403, 404]).toContain(supplier.status);
    const rows = await withTenant(
      db,
      { userId: users.supplier, organizationId: orgs.s1 },
      async (tx) => ({
        approvals: await tx.execute(sql`select 1 from material_group_approval`),
        summaries: await tx.execute(sql`select 1 from material_group_summary`),
        relevance: await tx.execute(sql`select 1 from material_group_relevance`),
      }),
    );
    expect(rows.approvals.rows).toHaveLength(0);
    expect(rows.summaries.rows).toHaveLength(0);
    expect(rows.relevance.rows).toHaveLength(0);
  });
});
