import { randomUUID } from 'node:crypto';
import { type Database, schema, sql } from '@reziproq/db';
import { defaultAiSettings, hintListSchema, hintSchema } from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TenantDatabase } from '../../common/database.module.js';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';
import { fakePublicEvents } from './early-warning-rules.js';
import { HintsService } from './hints.service.js';

// Tests zu docs/specs/KI-16.md: Frühwarnung erweitert FS-01 um Regeln, Schwere, score, Beleg und
// Begründung; resolved statt löschen, Wiederkehr nur bei schlimmerer Lage, Sicht je SRO.
describe('KI-16 Hinweise mit Frühwarnung', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  let hints: HintsService;
  const run = randomUUID().slice(0, 8);
  const orgs = { oem: randomUUID(), a: randomUUID(), b: randomUUID() };
  const rel = { a: randomUUID(), b: randomUUID() };
  const jbp = { a: randomUUID(), b: randomUUID() };
  const kpi = randomUUID();
  const users = {
    admin: `ki16-adm-${run}`,
    sroA: `ki16-sroa-${run}`,
    sroB: `ki16-srob-${run}`,
    supplier: `ki16-sup-${run}`,
  };
  const month = (offset: number) => {
    const date = new Date();
    date.setUTCDate(1);
    date.setUTCMonth(date.getUTCMonth() + offset);
    return date.toISOString().slice(0, 10);
  };
  const day = (offset: number) => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + offset);
    return date.toISOString().slice(0, 10);
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
  const list = async (user = users.admin) =>
    hintListSchema.parse((await call(user, 'GET', '/hinweise')).body).hints;
  const of = async (ruleKey: string, user = users.admin) =>
    (await list(user)).filter((hint) => hint.ruleKey === ruleKey);
  const kpiValue = (period: string, value: string) => ({
    relationshipId: rel.a,
    ownerOrgId: orgs.oem,
    kpiId: kpi,
    period,
    value,
    source: 'manual' as const,
    enteredBy: users.admin,
    enteredByName: 'Ada',
  });

  beforeAll(async () => {
    testApp = await startTestApp();
    db = testApp.adminDb;
    hints = testApp.app.get(HintsService);
    await db.insert(schema.organization).values([
      { id: orgs.oem, name: `KI16-OEM ${run}` },
      { id: orgs.a, name: `KI16-A ${run}` },
      { id: orgs.b, name: `KI16-B ${run}` },
    ]);
    await db
      .insert(schema.organizationFeature)
      .values({ organizationId: orgs.oem, feature: 'buyer' });
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
        person(users.sroA, orgs.oem, 'member'),
        person(users.sroB, orgs.oem, 'member'),
        person(users.supplier, orgs.a, 'admin'),
      ]);
    await insertRelationships(db, [
      { id: rel.a, buyer: orgs.oem, supplier: orgs.a },
      { id: rel.b, buyer: orgs.oem, supplier: orgs.b },
    ]);
    await db.insert(schema.relationshipMember).values([
      { relationshipId: rel.a, orgId: orgs.oem, userId: users.sroA, teamRole: 'sro' },
      { relationshipId: rel.b, orgId: orgs.oem, userId: users.sroB, teamRole: 'sro' },
    ]);
    await db.insert(schema.relationshipSpend).values([
      { relationshipId: rel.a, year: new Date().getUTCFullYear() - 1, amountCents: 300_000_000 },
      { relationshipId: rel.b, year: new Date().getUTCFullYear() - 1, amountCents: 300_000_000 },
    ]);
    const plan = (id: string, relationshipId: string) => ({
      id,
      relationshipId,
      ownerOrgId: orgs.oem,
      status: 'approved' as const,
      createdBy: users.admin,
      createdByName: 'Ada',
    });
    await db.insert(schema.jbp).values([plan(jbp.a, rel.a), plan(jbp.b, rel.b)]);
    const scorecard = randomUUID();
    await db
      .insert(schema.scorecard)
      .values({ id: scorecard, relationshipId: rel.a, ownerOrgId: orgs.oem, jbpId: jbp.a });
    await db.insert(schema.scorecardKpi).values({
      id: kpi,
      relationshipId: rel.a,
      ownerOrgId: orgs.oem,
      scorecardId: scorecard,
      name: 'Liefertreue',
      unit: '%',
      direction: 'higher',
      baseline: '90',
      target: '95',
      targetDate: day(200),
      ownerSide: 'supplier',
      ownerName: 'Kim',
      benefitFor: 'both',
    });
    // Drei Monate unter Ziel und schlechter werdend
    await db
      .insert(schema.kpiValue)
      .values([kpiValue(month(-3), '92'), kpiValue(month(-2), '91'), kpiValue(month(-1), '89')]);
    // Zusage des Lieferanten bei B seit 20 Tagen überfällig
    await db.insert(schema.commitment).values({
      relationshipId: rel.b,
      ownerOrgId: orgs.oem,
      jbpId: jbp.b,
      side: 'supplier',
      title: 'Kapazitätsplan liefern',
      ownerName: 'Kim',
      dueOn: day(-20),
      createdBy: users.admin,
      createdByName: 'Ada',
    });
  });

  afterAll(async () => {
    const orgIds = Object.values(orgs);
    const rels = Object.values(rel);
    await db.execute(sql`delete from ai_draft where org_id in ${orgIds}`);
    await db.execute(sql`delete from hint where org_id in ${orgIds}`);
    await db.execute(sql`delete from model_call where org_id in ${orgIds}`);
    await db.execute(sql`delete from kpi_value where relationship_id in ${rels}`);
    await db.execute(sql`delete from scorecard_kpi where relationship_id in ${rels}`);
    await db.execute(sql`delete from scorecard where relationship_id in ${rels}`);
    await db.execute(sql`delete from commitment where relationship_id in ${rels}`);
    await db.execute(sql`delete from jbp where relationship_id in ${rels}`);
    await db.execute(sql`delete from relationship_spend where relationship_id in ${rels}`);
    await db.execute(sql`delete from org_setting where org_id in ${orgIds}`);
    await db.execute(sql`delete from outbox_event where org_id in ${orgIds}`);
    await deleteRelationships(db, orgIds);
    await db.execute(sql`delete from app_user where organization_id in ${orgIds}`);
    await db.execute(sql`delete from organization_feature where organization_id in ${orgIds}`);
    await db.execute(sql`delete from organization where id in ${orgIds}`);
    await testApp.close();
  });

  it('eine Kennzahl drei Monate unter Ziel erzeugt genau einen Hinweis performance_drop mit Beleg', async () => {
    const found = await of('performance_drop');
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      relationshipId: rel.a,
      severity: 'medium',
      suggestedAction: 'Maßnahme anlegen',
      evidence: { metric: 'Liefertreue', threshold: 'Ziel 95 %' },
    });
    expect(found[0]?.evidence.values?.map((value) => value.value)).toEqual([
      '92 %',
      '91 %',
      '89 %',
    ]);
    const overdue = await of('supplier_commitment_overdue');
    expect(overdue).toHaveLength(1);
    expect(overdue[0]?.severity).toBe('medium');
  });

  it('ein zweiter Lauf erzeugt keinen zweiten Hinweis, sondern aktualisiert last_seen_at', async () => {
    const [before] = await of('performance_drop');
    await new Promise((resolve) => setTimeout(resolve, 20));
    const after = await of('performance_drop');
    expect(after).toHaveLength(1);
    expect(after[0]?.id).toBe(before?.id);
    expect(Date.parse(after[0]?.lastSeenAt ?? '')).toBeGreaterThan(
      Date.parse(before?.lastSeenAt ?? ''),
    );
  });

  it('eine Begründung mit einer Zahl, die nicht im Beleg steht, wird verworfen', async () => {
    hints.testExplanation = () => 'Die Liefertreue fällt seit 7 Monaten, Schaden 12345 Euro.';
    try {
      const written = await testApp.app
        .get(TenantDatabase)
        .run({ userId: 'system:test', organizationId: orgs.oem }, (tx) =>
          hints.explain(tx, orgs.oem),
        );
      expect(written).toBe(0);
    } finally {
      hints.testExplanation = undefined;
    }
    expect((await of('performance_drop'))[0]?.explanation).toBeNull();
    // Mit Werten aus dem Beleg entsteht die Begründung als Entwurf
    const written = await testApp.app
      .get(TenantDatabase)
      .run({ userId: 'system:test', organizationId: orgs.oem }, (tx) =>
        hints.explain(tx, orgs.oem),
      );
    expect(written).toBe(2);
    expect((await of('performance_drop'))[0]?.explanation).toContain('89 %');
  });

  it('die Sortierung folgt score; bei gleicher Schwere steht der Fokuslieferant vorn', async () => {
    await db
      .insert(schema.relationshipSide)
      .values({
        relationshipId: rel.b,
        orgId: orgs.oem,
        isFocus: true,
        focusReason: 'Strategisch wichtig für Antriebe',
      })
      .onConflictDoUpdate({
        target: [schema.relationshipSide.relationshipId, schema.relationshipSide.orgId],
        set: { isFocus: true, focusReason: 'Strategisch wichtig für Antriebe' },
      });
    const open = (await list()).filter((hint) =>
      ['performance_drop', 'supplier_commitment_overdue'].includes(hint.ruleKey),
    );
    expect(open.map((hint) => hint.ruleKey)).toEqual([
      'supplier_commitment_overdue',
      'performance_drop',
    ]);
    expect(open[0]?.isFocus).toBe(true);
    expect((open[0]?.score ?? 0) > (open[1]?.score ?? 0)).toBe(true);
  });

  it('ein verworfener Hinweis kommt nicht wieder, außer seine Schwere steigt', async () => {
    const [hint] = await of('performance_drop');
    expect(
      (
        await call(users.admin, 'POST', `/hinweise/${hint?.id}/verwerfen`, {
          reason: 'Saisonale Delle',
        })
      ).status,
    ).toBe(200);
    expect((await of('performance_drop')).filter((entry) => entry.status === 'open')).toHaveLength(
      0,
    );
    // Fokus für A: Schwere steigt auf hoch, ein neuer offener Hinweis entsteht
    await db
      .insert(schema.relationshipSide)
      .values({
        relationshipId: rel.a,
        orgId: orgs.oem,
        isFocus: true,
        focusReason: 'Strategisch wichtig für Elektronik',
      })
      .onConflictDoUpdate({
        target: [schema.relationshipSide.relationshipId, schema.relationshipSide.orgId],
        set: { isFocus: true, focusReason: 'Strategisch wichtig für Elektronik' },
      });
    const again = (await of('performance_drop')).filter((entry) => entry.status === 'open');
    expect(again).toHaveLength(1);
    expect(again[0]?.severity).toBe('high');
  });

  it('ist die Bedingung nicht mehr erfüllt, wird der Hinweis resolved', async () => {
    await db.execute(sql`update commitment set status = 'kept' where relationship_id = ${rel.b}`);
    const [resolved] = await of('supplier_commitment_overdue');
    expect(resolved).toMatchObject({
      status: 'resolved',
      resolvedReason: 'Bedingung nicht mehr erfüllt',
    });
  });

  it('ohne öffentliche Recherche kein public_event; Meldungen ohne Datum oder zu alt erzeugen keinen', async () => {
    hints.publicEventSource = (relationships) =>
      relationships
        .filter((entry) => entry.id === rel.a)
        .map((entry) => ({
          relationshipId: entry.id,
          kind: 'plant_closure' as const,
          title: 'Werk Nord schließt',
          sources: [
            {
              title: 'Zeitung',
              url: 'https://zeitung.example.test/a',
              publisher: 'Zeitung',
              publishedOn: day(-3),
            },
            {
              title: 'Alt',
              url: 'https://alt.example.test/a',
              publisher: 'Alt',
              publishedOn: day(-60),
            },
            {
              title: 'Ohne Datum',
              url: 'https://x.example.test/a',
              publisher: 'X',
              publishedOn: null,
            },
          ],
        }));
    try {
      expect(await of('public_event')).toHaveLength(0);
      expect(
        (
          await call(users.admin, 'PUT', '/einstellungen/ki', {
            ...defaultAiSettings,
            publicResearch: true,
          })
        ).status,
      ).toBe(200);
      const events = await of('public_event');
      expect(events).toHaveLength(1);
      // Nur eine Quelle zählt (alt und ohne Datum fallen weg): Schwere mittel
      expect(events[0]).toMatchObject({ severity: 'medium' });
      expect(events[0]?.evidence.sources).toHaveLength(1);
    } finally {
      hints.publicEventSource = () => [];
    }
  });

  it('ein SRO sieht nur Hinweise seiner Beziehungen; der Test-Lieferant sieht keine', async () => {
    const forA = await list(users.sroA);
    expect(forA.length).toBeGreaterThan(0);
    expect(forA.every((hint) => hint.relationshipId === rel.a)).toBe(true);
    const forB = await list(users.sroB);
    expect(forB.every((hint) => hint.relationshipId === rel.b)).toBe(true);
    const other = forA[0]?.id as string;
    expect((await call(users.sroB, 'GET', `/hinweise/${other}`)).status).toBe(404);
    expect((await call(users.supplier, 'GET', '/hinweise')).status).toBe(403);
  });

  it('In Arbeit und Bewertung „hilfreich“ werden gespeichert', async () => {
    const [hint] = (await of('performance_drop', users.admin)).filter(
      (entry) => entry.status === 'open',
    );
    const started = hintSchema.parse(
      (await call(users.admin, 'POST', `/hinweise/${hint?.id}/in-arbeit`)).body,
    );
    expect(started.status).toBe('in_progress');
    const rated = hintSchema.parse(
      (await call(users.admin, 'POST', `/hinweise/${hint?.id}/bewertung`, { helpful: false })).body,
    );
    expect(rated.feedback).toBe('not_helpful');
    const settings = (await call(users.admin, 'GET', '/hinweise/regeln')).body as {
      ratings: { ruleKey: string; notHelpful: number }[];
    };
    expect(settings.ratings.find((entry) => entry.ruleKey === 'performance_drop')?.notHelpful).toBe(
      1,
    );
  });

  it('bei mehr als der Hälfte „nicht hilfreich“ ab 20 Bewertungen bekommt der Admin eine Aufgabe', async () => {
    const due = async (user: string) =>
      ((await call(user, 'GET', '/start/due')).body as { items: { id: string; kind: string }[] })
        .items;
    const rated = (feedback: 'helpful' | 'not_helpful') => ({
      orgId: orgs.oem,
      ruleKey: 'public_event' as const,
      fingerprint: 'medium',
      status: 'resolved' as const,
      feedback,
    });
    await db
      .insert(schema.hint)
      .values([
        ...Array.from({ length: 10 }, () => rated('not_helpful')),
        ...Array.from({ length: 9 }, () => rated('helpful')),
      ]);
    // 19 Bewertungen reichen nicht
    expect((await due(users.admin)).some((item) => item.kind === 'hint_rule_review')).toBe(false);
    await db.insert(schema.hint).values(rated('not_helpful'));
    const items = await due(users.admin);
    expect(items.find((item) => item.kind === 'hint_rule_review')).toMatchObject({
      id: 'hint-rule-public_event',
    });
    // Nur Admins
    expect((await due(users.sroA)).some((item) => item.kind === 'hint_rule_review')).toBe(false);
  });

  it('der lokale Testanbieter meldet nur für den Test-Lieferanten', () => {
    const today = day(0);
    const events = fakePublicEvents(
      [
        { id: rel.a, name: 'Test-Lieferant (Demo)' },
        { id: rel.b, name: 'Rheintal Elektronik GmbH (Demo)' },
      ],
      today,
    );
    expect(new Set(events.map((event) => event.relationshipId))).toEqual(new Set([rel.a]));
    expect(
      events.some((event) => event.sources.some((source) => source.publishedOn === null)),
    ).toBe(true);
  });

  it('Hinweise tragen Warengruppe und ob sie zu den eigenen Beziehungen gehören', async () => {
    const forA = await list(users.sroA);
    expect(forA.every((hint) => hint.isOwn)).toBe(true);
    const all = await list(users.admin);
    expect(all.filter((hint) => hint.relationshipId).every((hint) => !hint.isOwn)).toBe(true);
  });
});
