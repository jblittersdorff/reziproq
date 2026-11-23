import { randomUUID } from 'node:crypto';
import { type Database, schema, sql, withTenant } from '@reziproq/db';
import { surveyWaveDetailSchema, surveyWavesSchema } from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';
import { feedbackCycleStepSource } from '../overview/cycle.js';

// Tests zu docs/specs/PUL-03.md: keine Ergebnisse vor der Aufdeckung, auch nicht der eigenen Seite;
// Gruppen unter drei Antworten fehlen; die drei größten Lücken stimmen; beide Seiten sehen dieselben
// Zahlen; die Aufdeckung erledigt den Zyklus-Schritt Feedback.
describe('PUL-03 Auswertung und Wahrnehmungslücken', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const run = randomUUID().slice(0, 8);
  const orgs = { oem: randomUUID(), supplier: randomUUID() };
  const rel = randomUUID();
  const users = { sro: `pul03-sro-${run}`, kam: `pul03-kam-${run}` };
  const buyer = `/suppliers/${rel}/feedback`;
  const supplier = `/kunden/${rel}/feedback`;
  const tokens: Record<string, string> = {};
  let waveId = '';
  const startedAt = new Date(Date.now() - 86_400_000);

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
  const answer = async (
    who: string,
    values: { satisfaction: number; trust: number; alignment: number },
    comment: string | null = null,
  ) => {
    const response = await fetch(`${testApp.baseUrl}/api/umfrage/${tokens[who]}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        answers: {
          pulse_satisfaction: { current: values.satisfaction, target: 5 },
          pulse_trust: { current: values.trust, target: 5 },
          pulse_alignment: { current: values.alignment, target: 4 },
        },
        comment,
      }),
    });
    expect(response.status).toBe(200);
  };
  const people = [
    ['b1', 'buyer', 'purchasing'],
    ['b2', 'buyer', 'purchasing'],
    ['b3', 'buyer', 'purchasing'],
    ['b4', 'buyer', 'quality'],
    ['b5', 'buyer', 'quality'],
    ['s1', 'supplier', 'sales'],
    ['s2', 'supplier', 'sales'],
    ['s3', 'supplier', 'sales'],
  ] as const;
  const detail = async (user: string, base: string) =>
    surveyWaveDetailSchema.parse((await call(user, 'GET', `${base}/${waveId}`)).body);

  beforeAll(async () => {
    testApp = await startTestApp();
    db = testApp.adminDb;
    await db.insert(schema.organization).values([
      { id: orgs.oem, name: `PUL3-OEM ${run}` },
      { id: orgs.supplier, name: `PUL3-Lieferant ${run}` },
    ]);
    await db
      .insert(schema.organizationFeature)
      .values({ organizationId: orgs.oem, feature: 'buyer' });
    const user = (id: string, organizationId: string, orgRole: 'admin' | 'member') => ({
      id,
      name: id,
      email: `${id}@example.com`,
      organizationId,
      orgRole,
      rolesImportedAt: new Date(),
    });
    await db
      .insert(schema.appUser)
      .values([user(users.sro, orgs.oem, 'member'), user(users.kam, orgs.supplier, 'admin')]);
    await insertRelationships(db, [{ id: rel, buyer: orgs.oem, supplier: orgs.supplier }]);
    await db
      .insert(schema.relationshipMember)
      .values({ relationshipId: rel, orgId: orgs.oem, userId: users.sro, teamRole: 'sro' });
    const started = surveyWaveDetailSchema.parse(
      (
        await call(users.sro, 'POST', buyer, {
          kind: 'pulse',
          dueDate: '2099-03-31',
          participants: people.map(([key, side, fn]) => ({
            side,
            email: `pul03-${key}-${run}@example.com`,
            name: null,
            function: fn,
          })),
        })
      ).body,
    );
    waveId = started.wave.id;
    const links = await db.execute<{ recipient: string; link: string }>(sql`
      select email_recipient as recipient, email_link as link from outbox_event
      where email_template = 'survey' and email_recipient like ${`%-${run}@example.com`}
    `);
    for (const row of links.rows) {
      tokens[row.recipient.split('-')[1] as string] = row.link.replace('/umfrage/', '');
    }
    // Käufer: Zufriedenheit 4, Vertrauen 4, Ausrichtung 3; Qualität mit nur zwei Antworten.
    for (const key of ['b1', 'b2', 'b3', 'b4', 'b5']) {
      await answer(
        key,
        { satisfaction: 4, trust: 4, alignment: 3 },
        key === 'b1' ? 'Mehr Offenheit bei Kosten.' : null,
      );
    }
    // Lieferant: erst zwei Antworten.
    await answer('s1', { satisfaction: 3, trust: 2, alignment: 4 }, 'Prognosen kommen zu spät.');
    await answer('s2', { satisfaction: 4, trust: 2, alignment: 4 });
  });

  afterAll(async () => {
    await db.execute(sql`delete from survey_free_text where relationship_id = ${rel}`);
    await db.execute(sql`delete from survey_result where relationship_id = ${rel}`);
    await db.execute(sql`delete from survey_response where relationship_id = ${rel}`);
    await db.execute(sql`delete from insight_summary where org_id in ${Object.values(orgs)}`);
    await db.execute(sql`delete from model_call where org_id in ${Object.values(orgs)}`);
    await deleteRelationships(db, Object.values(orgs));
    await db.execute(sql`delete from survey_template where org_id in ${Object.values(orgs)}`);
    await db.execute(sql`delete from app_user where organization_id in ${Object.values(orgs)}`);
    await db.execute(sql`delete from organization_feature where organization_id = ${orgs.oem}`);
    await db.execute(sql`delete from organization where id in ${Object.values(orgs)}`);
    await testApp.close();
  });

  it('ohne drei Antworten je Seite gibt es keine Aufdeckung, auch nach der Frist', async () => {
    await db.execute(sql`update survey_wave set due_date = current_date - 1 where id = ${waveId}`);
    expect((await detail(users.sro, buyer)).results).toBeNull();
    const list = surveyWavesSchema.parse((await call(users.sro, 'GET', buyer)).body);
    expect(list.waves[0]).toMatchObject({ revealedAt: null, topGap: null });
    await db.execute(sql`update survey_wave set due_date = '2099-03-31' where id = ${waveId}`);
  });

  it('vor der Aufdeckung liefert keine Schnittstelle Ergebnisse, auch nicht der eigenen Seite', async () => {
    await answer('s3', { satisfaction: 4, trust: 2, alignment: 4 });
    expect((await detail(users.sro, buyer)).results).toBeNull();
    expect((await detail(users.kam, supplier)).results).toBeNull();
    const stored = await db.execute<{ n: number }>(
      sql`select count(*)::int as n from survey_result where wave_id = ${waveId}`,
    );
    expect(stored.rows[0]?.n).toBe(0);
    // Auch der Zyklus-Schritt ist erst begonnen.
    const status = await withTenant(db, { userId: users.sro, organizationId: orgs.oem }, (tx) =>
      feedbackCycleStepSource.cycleStepStatus(
        {
          id: randomUUID(),
          relationshipId: rel,
          label: '2027',
          startedAt,
          jbpDate: null,
          status: 'active',
        },
        tx,
      ),
    );
    expect(status).toBe('in_progress');
  });

  it('nach dem Abschluss beider Seiten stehen die drei größten Lücken oben', async () => {
    await call(users.sro, 'POST', `${buyer}/${waveId}/abschliessen`);
    const closed = surveyWaveDetailSchema.parse(
      (await call(users.kam, 'POST', `${supplier}/${waveId}/abschliessen`)).body,
    );
    expect(closed.wave.revealedAt).not.toBeNull();
    const results = closed.results;
    expect(results?.responses).toEqual({ buyer: 5, supplier: 3 });
    // Vertrauen 4 gegen 2, Ausrichtung 3 gegen 4, Zufriedenheit (Zusammenarbeit) 4 gegen 3,67.
    expect(results?.topGaps.map((entry) => [entry.dimension, entry.delta])).toEqual([
      ['trust', 2],
      ['strategy', -1],
      ['collaboration', 0.33],
    ]);
    expect(results?.dimensions.find((entry) => entry.dimension === 'strategy')).toMatchObject({
      buyer: { ist: 3, soll: 4 },
      supplier: { ist: 4, soll: 4 },
    });
    const list = surveyWavesSchema.parse((await call(users.sro, 'GET', buyer)).body);
    expect(list.waves[0]?.topGap).toEqual({ dimension: 'trust', delta: 2 });
  });

  it('Gruppen unter drei Antworten fehlen in jeder Ausgabe', async () => {
    const results = (await detail(users.sro, buyer)).results;
    expect(results?.functions.map((entry) => entry.function).sort()).toEqual([
      'purchasing',
      'sales',
    ]);
    const purchasing = results?.functions.find((entry) => entry.function === 'purchasing');
    expect(purchasing?.buyer?.n).toBe(3);
    expect(purchasing?.supplier).toBeNull();
    const stored = await db.execute<{ fn: string | null; n: number }>(
      sql`select function as fn, min(n)::int as n from survey_result where wave_id = ${waveId} group by function`,
    );
    expect(stored.rows.every((row) => row.n >= 3)).toBe(true);
    expect(stored.rows.map((row) => row.fn)).not.toContain('quality');
  });

  it('beide Seiten sehen dieselben Zahlen; Freitexte jeweils der anderen Seite', async () => {
    const own = (await detail(users.sro, buyer)).results;
    const theirs = (await detail(users.kam, supplier)).results;
    expect(theirs?.dimensions).toEqual(own?.dimensions);
    expect(theirs?.functions).toEqual(own?.functions);
    expect(theirs?.questions).toEqual(own?.questions);
    expect(own?.freeTexts).toEqual(['Prognosen kommen zu spät.']);
    expect(theirs?.freeTexts).toEqual(['Mehr Offenheit bei Kosten.']);
  });

  it('AW-01: die Käuferseite sieht eine Aussage zur größten Lücke, der Lieferant nie', async () => {
    const own = (await detail(users.sro, buyer)).results;
    expect(own?.statement?.headline).toBe(
      'Bei Vertrauen liegen beide Seiten 2,0 Punkte auseinander.',
    );
    expect(own?.statement?.body).not.toMatch(/@|sro|kam/i);
    const theirs = (await detail(users.kam, supplier)).results;
    expect(theirs?.statement ?? null).toBeNull();
  });

  it('die Aufdeckung erledigt den Zyklus-Schritt Feedback', async () => {
    const status = await withTenant(db, { userId: users.sro, organizationId: orgs.oem }, (tx) =>
      feedbackCycleStepSource.cycleStepStatus(
        {
          id: randomUUID(),
          relationshipId: rel,
          label: '2027',
          startedAt,
          jbpDate: null,
          status: 'active',
        },
        tx,
      ),
    );
    expect(status).toBe('completed');
  });
});
