import { randomUUID } from 'node:crypto';
import { type Database, schema, sql, withTenant } from '@reziproq/db';
import { hintListSchema, hintRuleKeys, hintSchema, startSchema } from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';

// Tests zu docs/specs/FS-01.md: zehn Regeln mit je genau einem Hinweis, Verwerfen mit Begründung im
// Verlauf, Annehmen als interne Maßnahme mit privater Quelle, der Lieferant sieht nichts.
describe('FS-01 Hinweise', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const run = randomUUID().slice(0, 8);
  const buyer = randomUUID();
  // Je Lage eine eigene Beziehung, damit jede Regel genau einmal anschlägt.
  const keys = [
    'spend',
    'focus',
    'deviation',
    'sroA',
    'sroB',
    'team',
    'cadence',
    'feedback',
    'plan',
    'rights',
    'commitments',
  ] as const;
  type Id = ReturnType<typeof randomUUID>;
  const rel = Object.fromEntries(keys.map((key) => [key, randomUUID()])) as Record<
    (typeof keys)[number],
    Id
  >;
  const suppliers = Object.fromEntries(keys.map((key) => [key, randomUUID()])) as Record<
    (typeof keys)[number],
    Id
  >;
  const unit = randomUUID();
  const users = {
    admin: `fs1-admin-${run}`,
    sro: `fs1-sro-${run}`,
    buyerA: `fs1-p-${run}`,
    raterA: `fs1-r1-${run}`,
    raterB: `fs1-r2-${run}`,
    kam: `fs1-kam-${run}`,
  };
  const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000);
  const iso = (date: Date) => date.toISOString().slice(0, 10);
  let commitmentJbp = '';

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
  const list = async () => hintListSchema.parse((await call(users.admin, 'GET', '/hinweise')).body);
  const open = async () => (await list()).hints.filter((hint) => hint.status === 'open');

  beforeAll(async () => {
    testApp = await startTestApp();
    db = testApp.adminDb;
    await db
      .insert(schema.organization)
      .values([
        { id: buyer, name: `FS1-OEM ${run}` },
        ...keys.map((key) => ({ id: suppliers[key], name: `FS1 ${key} ${run}` })),
      ]);
    await db.insert(schema.organizationFeature).values({ organizationId: buyer, feature: 'buyer' });
    const person = (id: string, name: string, orgRole: 'admin' | 'member', org = buyer) => ({
      id,
      name,
      email: `${id}@example.com`,
      organizationId: org,
      orgRole,
      rolesImportedAt: new Date(),
    });
    await db
      .insert(schema.appUser)
      .values([
        person(users.admin, 'Ada Admin', 'admin'),
        person(users.sro, 'Sven Sro', 'member'),
        person(users.buyerA, 'Paul Einkauf', 'member'),
        person(users.raterA, 'Rita Eins', 'member'),
        person(users.raterB, 'Rolf Zwei', 'member'),
        person(users.kam, 'Kim Kaiser', 'admin', suppliers.commitments),
      ]);
    await insertRelationships(
      db,
      keys.map((key) => ({ id: rel[key], buyer, supplier: suppliers[key] })),
    );
    await db.execute(
      sql`update relationship set created_at = ${daysAgo(400)} where id = ${rel.feedback}`,
    );
    await db.insert(schema.relationshipSide).values([
      { relationshipId: rel.focus, orgId: buyer, isFocus: true, focusReason: 'Spend' },
      ...(['sroA', 'sroB', 'feedback'] as const).map((key) => ({
        relationshipId: rel[key],
        orgId: buyer,
        isFocus: true,
        focusReason: 'Strategischer Partner für die Elektronik',
      })),
    ]);
    // 4 Zu viele Fokuslieferanten: ein SRO mit zwei, erlaubt ist einer
    await db.insert(schema.orgSetting).values({
      orgId: buyer,
      key: 'hint_max_focus_per_sro',
      value: 1,
      updatedBy: users.admin,
    });
    await db.insert(schema.relationshipMember).values([
      {
        relationshipId: rel.sroA,
        orgId: buyer,
        userId: users.sro,
        teamRole: 'sro',
        function: 'quality',
      },
      {
        relationshipId: rel.sroB,
        orgId: buyer,
        userId: users.sro,
        teamRole: 'sro',
        function: 'quality',
      },
      // 5 Nur Einkauf im Team
      {
        relationshipId: rel.team,
        orgId: buyer,
        userId: users.buyerA,
        teamRole: 'member',
        function: 'purchasing',
      },
      {
        relationshipId: rel.commitments,
        orgId: buyer,
        userId: users.admin,
        teamRole: 'sro',
        function: 'logistics',
      },
    ]);
    // 1 und 3: Bewertungsrunde
    await db
      .insert(schema.businessUnit)
      .values({ id: unit, orgId: buyer, name: 'Antriebe', code: `A-${run}` });
    const [round] = await db
      .insert(schema.segmentationRound)
      .values({
        orgId: buyer,
        name: 'Runde',
        dueDate: iso(daysAgo(-30)),
        status: 'open',
        modelVersion: 1,
        createdBy: users.admin,
      })
      .returning();
    const assignment = async (
      relationshipId: string,
      rater: string,
      fn: 'purchasing' | 'quality' = 'purchasing',
    ) => {
      const [row] = await db
        .insert(schema.ratingAssignment)
        .values({
          roundId: round?.id as string,
          relationshipId,
          businessUnitId: unit,
          function: fn,
          raterUserId: rater,
          status: 'submitted',
        })
        .returning();
      return row?.id as string;
    };
    const rate = async (
      assignmentId: string,
      relationshipId: string,
      criterionKey: string,
      ist: number | null,
    ) =>
      db.insert(schema.rating).values({
        assignmentId,
        relationshipId,
        criterionKey,
        modelVersion: 1,
        ist,
        submittedAt: daysAgo(3),
      });
    // 1 Nur Spend bewertet, trotzdem konsolidiert
    const spendOnly = await assignment(rel.spend, users.raterA);
    await rate(spendOnly, rel.spend, 'spend', 60);
    await rate(spendOnly, rel.spend, 'uniqueness', null);
    await db.insert(schema.segmentDecision).values({
      relationshipId: rel.spend,
      scope: 'total',
      istImpactLevel: 2,
      istQualityLevel: 2,
      sollImpactLevel: 2,
      sollQualityLevel: 2,
      reason: 'Probe',
      modelVersion: 1,
      decidedBy: users.admin,
      version: 1,
    });
    // 3 Ungeklärte Abweichung: 10 gegen 90 bei Qualität, nicht konsolidiert
    const first = await assignment(rel.deviation, users.raterA);
    const second = await assignment(rel.deviation, users.raterB, 'quality');
    await rate(first, rel.deviation, 'uniqueness', 10);
    await rate(second, rel.deviation, 'uniqueness', 90);
    // 6 Takt verfehlt und 9 Recht ohne Pflicht: Spielregeln
    const ruleSet = async (
      relationshipId: string,
      items: { kind: 'right' | 'format'; group: 'cost' | null; cadence: 'monthly' | null }[],
    ) => {
      const [set] = await db
        .insert(schema.ruleSet)
        .values({
          relationshipId,
          ownerOrgId: buyer,
          version: 1,
          targetImpactLevel: 2,
          targetQualityLevel: 2,
          typeName: 'Strategisch',
          createdBy: users.admin,
        })
        .returning();
      const rows = await db
        .insert(schema.ruleSetItem)
        .values(
          items.map((item, position) => ({
            ruleSetId: set?.id as string,
            relationshipId,
            ownerOrgId: buyer,
            kind: item.kind,
            group: item.group,
            cadence: item.cadence,
            title: {
              de: item.kind === 'format' ? 'Quartalsgespräch' : 'Preisgleitklausel',
              en: 'Item',
            },
            description: { de: '', en: '' },
            origin: 'custom' as const,
            position,
          })),
        )
        .returning();
      await db.execute(
        sql`update rule_set set status = 'approved', approved_at = now(), approved_by = ${users.admin},
          approved_by_name = 'Ada Admin' where id = ${set?.id}`,
      );
      return { set: set?.id as string, items: rows };
    };
    const cadence = await ruleSet(rel.cadence, [
      { kind: 'format', group: null, cadence: 'monthly' },
    ]);
    await db.insert(schema.relationshipTarget).values({
      relationshipId: rel.cadence,
      ownerOrgId: buyer,
      typeName: 'Strategisch',
      typeDescription: '',
      ruleSetId: cadence.set,
      ruleSetVersion: 1,
      sharedAt: daysAgo(60),
      sharedBy: users.admin,
      sharedByName: 'Ada Admin',
    });
    await ruleSet(rel.rights, [{ kind: 'right', group: 'cost', cadence: null }]);
    // 8 Lieferantenplan fehlt: JBP in einer Woche, kein freigegebener Plan
    await db.insert(schema.cycle).values({
      relationshipId: rel.plan,
      label: '2026',
      status: 'active',
      jbpDate: iso(daysAgo(-7)),
    });
    // 10 Überfällige Zusage des Käufers
    const [plan] = await db
      .insert(schema.jbp)
      .values({
        relationshipId: rel.commitments,
        ownerOrgId: buyer,
        createdBy: users.admin,
        createdByName: 'Ada Admin',
      })
      .returning();
    commitmentJbp = plan?.id as string;
    await db.insert(schema.commitment).values({
      relationshipId: rel.commitments,
      ownerOrgId: buyer,
      jbpId: commitmentJbp,
      side: 'buyer',
      title: 'Zeichnungen liefern',
      ownerName: 'Ada Admin',
      dueOn: iso(daysAgo(5)),
      createdBy: users.admin,
      createdByName: 'Ada Admin',
    } as never);
  });

  afterAll(async () => {
    const ids = Object.values(rel);
    await db.execute(sql`delete from hint where org_id = ${buyer}`);
    await db.execute(sql`delete from action_private_source where relationship_id in ${ids}`);
    await db.execute(sql`delete from action where relationship_id in ${ids}`);
    await db.execute(sql`delete from commitment where relationship_id in ${ids}`);
    await db.execute(sql`delete from jbp where relationship_id in ${ids}`);
    await db.execute(sql`delete from cycle where relationship_id in ${ids}`);
    await db.execute(sql`delete from rating where relationship_id in ${ids}`);
    await db.execute(sql`delete from rating_assignment where relationship_id in ${ids}`);
    await db.execute(sql`delete from segment_decision where relationship_id in ${ids}`);
    await deleteRelationships(db, [buyer, ...Object.values(suppliers)]);
    await db.execute(sql`delete from segmentation_round where org_id = ${buyer}`);
    await db.execute(sql`delete from business_unit where org_id = ${buyer}`);
    await db.execute(sql`delete from org_setting where org_id = ${buyer}`);
    await db.execute(
      sql`delete from app_user where organization_id in ${[buyer, ...Object.values(suppliers)]}`,
    );
    await db.execute(sql`delete from organization_feature where organization_id = ${buyer}`);
    await db.execute(
      sql`delete from organization where id in ${[buyer, ...Object.values(suppliers)]}`,
    );
    await testApp.close();
  });

  it('Jede Regel löst mit Testdaten genau einen Hinweis aus', async () => {
    const hints = await open();
    const byRule = Object.fromEntries(
      hintRuleKeys.map((key) => [key, hints.filter((hint) => hint.ruleKey === key)]),
    );
    for (const key of hintRuleKeys) expect(byRule[key], key).toHaveLength(1);
    expect(byRule.segment_spend_only?.[0]?.relationshipId).toBe(rel.spend);
    expect(byRule.weak_focus?.[0]?.relationshipId).toBe(rel.focus);
    expect(byRule.unexplained_deviation?.[0]?.relationshipId).toBe(rel.deviation);
    expect(byRule.too_many_focus?.[0]).toMatchObject({
      relationshipId: null,
      detail: { person: 'Sven Sro', count: 2, limit: 1 },
    });
    expect(byRule.no_operational_function?.[0]?.relationshipId).toBe(rel.team);
    expect(byRule.cadence_missed?.[0]).toMatchObject({
      relationshipId: rel.cadence,
      href: `/lieferanten/${rel.cadence}/umsetzung/termine/neu`,
    });
    expect(byRule.no_feedback?.[0]?.relationshipId).toBe(rel.feedback);
    expect(byRule.plan_missing?.[0]?.relationshipId).toBe(rel.plan);
    expect(byRule.right_without_obligation?.[0]?.detail.groups).toEqual(['cost']);
    expect(byRule.buyer_commitments_overdue?.[0]).toMatchObject({
      relationshipId: rel.commitments,
      detail: { count: 1 },
    });
    // Ein zweiter Lauf erzeugt nichts doppelt.
    expect((await open()).length).toBe(hints.length);
    // Start zeigt die Anzahl.
    const start = startSchema.parse((await call(users.admin, 'GET', '/start')).body);
    expect(start.openHints).toBe(hints.length);
  });

  it('Ein verworfener Hinweis kommt nicht wieder, solange sich die Lage nicht ändert. Die Begründung steht im Verlauf.', async () => {
    const hint = (await open()).find((entry) => entry.ruleKey === 'buyer_commitments_overdue');
    expect(
      (await call(users.admin, 'POST', `/hinweise/${hint?.id}/verwerfen`, { reason: '' })).status,
    ).toBe(400);
    const dismissed = await call(users.admin, 'POST', `/hinweise/${hint?.id}/verwerfen`, {
      reason: 'Liefertermin mit dem Lieferanten verschoben',
    });
    expect(hintSchema.parse(dismissed.body)).toMatchObject({ status: 'dismissed' });
    expect((await open()).some((entry) => entry.ruleKey === 'buyer_commitments_overdue')).toBe(
      false,
    );
    const [event] = await db
      .select({ changes: schema.auditEvent.changes, visibility: schema.auditEvent.visibility })
      .from(schema.auditEvent)
      .where(
        sql`${schema.auditEvent.objectType} = 'hint' and ${schema.auditEvent.objectId} = ${hint?.id}`,
      );
    expect(event?.visibility).toBe('internal');
    expect(JSON.stringify(event?.changes)).toContain('Liefertermin mit dem Lieferanten verschoben');
    // Die Lage ändert sich: eine zweite Zusage ist überfällig. Dann kommt ein neuer Hinweis.
    await db.insert(schema.commitment).values({
      relationshipId: rel.commitments,
      ownerOrgId: buyer,
      jbpId: commitmentJbp,
      side: 'buyer',
      title: 'Muster senden',
      ownerName: 'Ada Admin',
      dueOn: iso(daysAgo(2)),
      createdBy: users.admin,
      createdByName: 'Ada Admin',
    } as never);
    const again = (await open()).filter((entry) => entry.ruleKey === 'buyer_commitments_overdue');
    expect(again).toHaveLength(1);
    expect(again[0]?.detail.count).toBe(2);
  });

  it('Annehmen erzeugt eine interne Maßnahme ohne Fremdschlüssel von geteilt auf privat', async () => {
    const hint = (await open()).find((entry) => entry.ruleKey === 'no_operational_function');
    // Nur SRO der Beziehung oder Admin; ein Mitglied ohne SRO-Rolle nicht
    expect((await call(users.buyerA, 'POST', `/hinweise/${hint?.id}/annehmen`)).status).toBe(403);
    const accepted = hintSchema.parse(
      (await call(users.admin, 'POST', `/hinweise/${hint?.id}/annehmen`)).body,
    );
    expect(accepted.status).toBe('accepted');
    expect(accepted.actionHref).toMatch(
      new RegExp(`^/lieferanten/${rel.team}/umsetzung/massnahmen/`),
    );
    const [action] = await db
      .select()
      .from(schema.action)
      .where(sql`relationship_id = ${rel.team}`);
    expect(action).toMatchObject({ visibility: 'internal', ownerSide: 'buyer' });
    const [source] = await db
      .select()
      .from(schema.actionPrivateSource)
      .where(sql`action_id = ${action?.id}`);
    expect(source).toMatchObject({ sourceType: 'hint', sourceId: hint?.id, orgId: buyer });
    // Kein Fremdschlüssel von der geteilten Maßnahme auf etwas Privates; die Quelle verweist auf sie.
    const foreignKeys = await db.execute<{ table_name: string; foreign_table: string }>(sql`
      select tc.table_name, ccu.table_name as foreign_table
      from information_schema.table_constraints tc
      join information_schema.constraint_column_usage ccu on ccu.constraint_name = tc.constraint_name
      where tc.constraint_type = 'FOREIGN KEY' and tc.table_name in ('action', 'hint')`);
    expect(
      foreignKeys.rows
        .filter((row) => row.table_name === 'action')
        .map((row) => row.foreign_table)
        .sort(),
    ).toEqual(['organization', 'relationship']);
    // Angenommen bleibt angenommen, auch beim nächsten Lauf.
    expect((await open()).some((entry) => entry.ruleKey === 'no_operational_function')).toBe(false);
  });

  it('Der Test-Lieferant sieht keine Hinweise', async () => {
    expect((await call(users.kam, 'GET', '/hinweise')).status).toBe(403);
    const hint = (await list()).hints[0];
    expect((await call(users.kam, 'GET', `/hinweise/${hint?.id}`)).status).toBe(403);
    const rows = await withTenant(
      db,
      { userId: users.kam, organizationId: suppliers.commitments, customerOrganizationId: buyer },
      (tx) => tx.select().from(schema.hint),
    );
    expect(rows).toEqual([]);
  });
});
