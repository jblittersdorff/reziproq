import { randomUUID } from 'node:crypto';
import { type Database, schema, sql } from '@reziproq/db';
import {
  dueListSchema,
  myFeedbackSchema,
  publicSurveySchema,
  surveyWaveDetailSchema,
} from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';

// Feedback in der App (Änderung zu PUL-02b): Eingeladene mit Konto beantworten angemeldet, auf
// beiden Seiten; nur die eigene Einladung, genau einmal, anonym wie beim Link.
describe('Feedback in der App', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const run = randomUUID().slice(0, 8);
  const orgs = { oem: randomUUID(), supplier: randomUUID() };
  const rel = randomUUID();
  const users = {
    sro: `fia-sro-${run}`,
    member: `fia-member-${run}`,
    kam: `fia-kam-${run}`,
  };
  const email = (id: string) => `${id}@example.com`;
  const buyer = `/suppliers/${rel}/feedback`;
  let waveId = '';

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
  const mine = async (user: string) =>
    myFeedbackSchema.parse((await call(user, 'GET', '/feedback/meine')).body).invitations;
  const answersFor = (questions: { key: string }[]) =>
    Object.fromEntries(questions.map((question) => [question.key, { current: 4, target: 5 }]));

  beforeAll(async () => {
    testApp = await startTestApp();
    db = testApp.adminDb;
    await db.insert(schema.organization).values([
      { id: orgs.oem, name: `FIA-OEM ${run}` },
      { id: orgs.supplier, name: `FIA-Lieferant ${run}` },
    ]);
    await db
      .insert(schema.organizationFeature)
      .values({ organizationId: orgs.oem, feature: 'buyer' });
    const user = (id: string, organizationId: string) => ({
      id,
      name: id,
      email: email(id),
      organizationId,
      orgRole: 'member' as const,
      rolesImportedAt: new Date(),
    });
    await db
      .insert(schema.appUser)
      .values([
        user(users.sro, orgs.oem),
        user(users.member, orgs.oem),
        user(users.kam, orgs.supplier),
      ]);
    await insertRelationships(db, [{ id: rel, buyer: orgs.oem, supplier: orgs.supplier }]);
    await db
      .insert(schema.relationshipMember)
      .values({ relationshipId: rel, orgId: orgs.oem, userId: users.sro, teamRole: 'sro' });
    const started = surveyWaveDetailSchema.parse(
      (
        await call(users.sro, 'POST', buyer, {
          kind: 'pulse',
          dueDate: '2099-03-31',
          participants: [
            // Die eigene Adresse in Großbuchstaben: Die App erkennt die Einladung trotzdem.
            {
              side: 'buyer',
              email: email(users.sro).toUpperCase(),
              name: null,
              function: 'purchasing',
            },
            {
              side: 'buyer',
              email: `fia-extern-${run}@example.com`,
              name: null,
              function: 'quality',
            },
            { side: 'supplier', email: email(users.kam), name: null, function: 'sales' },
          ],
        })
      ).body,
    );
    waveId = started.wave.id;
  });

  afterAll(async () => {
    await db.execute(sql`delete from survey_response where relationship_id = ${rel}`);
    await deleteRelationships(db, Object.values(orgs));
    await db.execute(sql`delete from survey_template where org_id in ${Object.values(orgs)}`);
    await db.execute(sql`delete from app_user where organization_id in ${Object.values(orgs)}`);
    await db.execute(sql`delete from organization_feature where organization_id = ${orgs.oem}`);
    await db.execute(sql`delete from organization where id in ${Object.values(orgs)}`);
    await testApp.close();
  });

  it('Eingeladene sehen ihren Fragebogen auf Start und in der App, auf beiden Seiten', async () => {
    const forSro = await mine(users.sro);
    expect(forSro).toHaveLength(1);
    expect(forSro[0]).toMatchObject({
      waveId,
      relationshipId: rel,
      side: 'buyer',
      status: 'open',
      counterpart: `FIA-Lieferant ${run}`,
    });
    const forKam = await mine(users.kam);
    expect(forKam).toHaveLength(1);
    expect(forKam[0]).toMatchObject({ side: 'supplier', counterpart: `FIA-OEM ${run}` });
    // Nicht eingeladen: keine Einladung
    expect(await mine(users.member)).toEqual([]);

    const due = dueListSchema.parse((await call(users.kam, 'GET', '/start/due')).body);
    expect(due.items).toContainEqual(
      expect.objectContaining({ kind: 'feedback', href: `/feedback/${forKam[0]?.id}` }),
    );
  });

  it('Beantworten in der App: genau einmal, anonym, der Rücklauf zählt mit', async () => {
    const [invitation] = await mine(users.sro);
    const id = invitation?.id as string;
    const survey = publicSurveySchema.parse(
      (await call(users.sro, 'GET', `/feedback/meine/${id}`)).body,
    );
    expect(survey.status).toBe('open');
    expect(survey.questions.length).toBeGreaterThan(0);
    const answered = await call(users.sro, 'POST', `/feedback/meine/${id}`, {
      answers: answersFor(survey.questions),
      comment: 'Abstimmungen dauern zu lange.',
    });
    expect(answered.status).toBe(200);
    expect(publicSurveySchema.parse(answered.body).status).toBe('used');
    expect(
      (
        await call(users.sro, 'POST', `/feedback/meine/${id}`, {
          answers: answersFor(survey.questions),
          comment: null,
        })
      ).status,
    ).toBe(409);
    expect((await mine(users.sro))[0]?.status).toBe('used');

    // Anonym: Die Antwort hat keinen Verweis auf Person oder Einladung.
    const columns = await db.execute<{ column_name: string }>(sql`
      select column_name from information_schema.columns where table_name = 'survey_response'
    `);
    expect(columns.rows.map((row) => row.column_name).sort()).toEqual(
      [
        'answers',
        'comment',
        'function',
        'id',
        'org_id',
        'relationship_id',
        'side',
        'wave_id',
      ].sort(),
    );
    const detail = surveyWaveDetailSchema.parse(
      (await call(users.sro, 'GET', `${buyer}/${waveId}`)).body,
    );
    expect(detail.wave.turnout.buyer).toEqual({ invited: 2, completed: 1 });
  });

  it('Fremde Einladungen lassen sich weder lesen noch beantworten', async () => {
    const [kamInvitation] = await mine(users.kam);
    const id = kamInvitation?.id as string;
    // Andere Person der anderen Seite und eine Person derselben Organisation ohne Einladung
    for (const user of [users.sro, users.member]) {
      expect((await call(user, 'GET', `/feedback/meine/${id}`)).status).toBe(404);
      expect(
        (
          await call(user, 'POST', `/feedback/meine/${id}`, {
            answers: { pulse_satisfaction: { current: 1, target: 1 } },
            comment: null,
          })
        ).status,
      ).toBe(404);
    }
    // Der Lieferant beantwortet seine eigene.
    const survey = publicSurveySchema.parse(
      (await call(users.kam, 'GET', `/feedback/meine/${id}`)).body,
    );
    expect(
      (
        await call(users.kam, 'POST', `/feedback/meine/${id}`, {
          answers: answersFor(survey.questions),
          comment: null,
        })
      ).status,
    ).toBe(200);
  });
});
