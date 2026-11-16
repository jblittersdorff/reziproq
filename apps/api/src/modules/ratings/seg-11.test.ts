import { randomUUID } from 'node:crypto';
import { type Database, schema, sql } from '@reziproq/db';
import {
  type DeviationExplanations,
  defaultSegmentCriteria,
  defaultSegmentTypes,
  deviationExplanationsSchema,
} from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';
import { TestDraftModel } from '../ai-drafts/draft-model.js';

// SEG-11 mit AI_PROVIDER=test: Die KI erklärt die drei größten Abweichungen aus den Begründungen.

describe('SEG-11 KI erklärt Abweichungen', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const run = randomUUID().slice(0, 8);
  const orgs = { oem: randomUUID(), supplier: randomUUID() };
  const relationship = randomUUID();
  const users = {
    admin: `seg11-admin-${run}`,
    raterA: `seg11-a-${run}`,
    raterB: `seg11-b-${run}`,
    supplier: `seg11-sup-${run}`,
  };
  const names: Record<string, string> = {
    [users.admin]: 'Ottilie Brennecke',
    [users.raterA]: 'Greta Sommerfeld',
    [users.raterB]: 'Jonas Kranich',
    [users.supplier]: 'Viktor Lindqvist',
  };
  const roundId = randomUUID();
  const unit = randomUUID();
  const [c0, c1, c2] = defaultSegmentCriteria.map((criterion) => criterion.key) as [
    string,
    string,
    string,
  ];

  const call = async (user: string, method: 'GET' | 'POST', path = '') => {
    const response = await fetch(
      `${testApp.baseUrl}/api/ratings/relationship/${relationship}/segmentation/explanations${path}`,
      {
        method,
        headers: { authorization: `Bearer ${await testApp.signToken({ subject: user })}` },
      },
    );
    return { status: response.status, body: (await response.json().catch(() => null)) as unknown };
  };
  const parse = (body: unknown): DeviationExplanations => deviationExplanationsSchema.parse(body);

  beforeAll(async () => {
    testApp = await startTestApp();
    db = testApp.adminDb;
    await db.insert(schema.organization).values([
      { id: orgs.oem, name: `SEG11-OEM ${run}` },
      { id: orgs.supplier, name: `SEG11-Lieferant ${run}` },
    ]);
    await db
      .insert(schema.organizationFeature)
      .values({ organizationId: orgs.oem, feature: 'buyer' });
    await db.insert(schema.appUser).values(
      Object.entries(users).map(([key, id]) => ({
        id,
        name: names[id] as string,
        email: `${id}@example.com`,
        organizationId: key === 'supplier' ? orgs.supplier : orgs.oem,
        orgRole: key === 'admin' || key === 'supplier' ? ('admin' as const) : ('member' as const),
        rolesImportedAt: new Date(),
      })),
    );
    await insertRelationships(db, [{ id: relationship, buyer: orgs.oem, supplier: orgs.supplier }]);
    await db
      .insert(schema.businessUnit)
      .values({ id: unit, orgId: orgs.oem, name: 'Antrieb', code: `A-${run}` });
    const [model] = await db
      .insert(schema.segmentModel)
      .values({
        orgId: orgs.oem,
        version: 1,
        status: 'active',
        lowMax: 33,
        midMax: 66,
        activatedAt: new Date(),
      })
      .returning({ id: schema.segmentModel.id });
    if (!model) throw new Error('Modell fehlt');
    await db
      .insert(schema.segmentCriterion)
      .values(defaultSegmentCriteria.map((criterion) => ({ ...criterion, modelId: model.id })));
    await db
      .insert(schema.segmentType)
      .values(defaultSegmentTypes.map((type) => ({ ...type, modelId: model.id })));
    await db.insert(schema.segmentationRound).values({
      id: roundId,
      orgId: orgs.oem,
      name: 'Runde',
      dueDate: '2099-12-31',
      status: 'open',
      modelVersion: 1,
      createdBy: users.admin,
    });
    // Spannweiten: c0 80, c1 50, c2 30, alle anderen 0. Zu c2 gibt es keine Begründung.
    const values: Record<string, Record<string, { ist: number; comment: string | null }>> = {
      [users.raterA]: {
        [c0]: { ist: 90, comment: 'Greta Sommerfeld findet die Zusammenarbeit sehr eng.' },
        [c1]: { ist: 80, comment: 'Laut Herr Müller vom Lieferanten liefern sie pünktlich.' },
        [c2]: { ist: 70, comment: null },
      },
      [users.raterB]: {
        [c0]: { ist: 10, comment: 'Kranich sieht kaum Abstimmung, Jonas bestätigt das.' },
        [c1]: { ist: 30, comment: 'Liefertreue schwankt stark.' },
        [c2]: { ist: 40, comment: '   ' },
      },
    };
    for (const [rater, fn] of [
      [users.raterA, 'quality'],
      [users.raterB, 'purchasing'],
    ] as const) {
      const [assignment] = await db
        .insert(schema.ratingAssignment)
        .values({
          roundId,
          relationshipId: relationship,
          businessUnitId: unit,
          function: fn,
          raterUserId: rater,
          status: 'submitted',
        })
        .returning({ id: schema.ratingAssignment.id });
      if (!assignment) throw new Error('Zuordnung fehlt');
      await db.insert(schema.rating).values(
        defaultSegmentCriteria.map(({ key }) => ({
          assignmentId: assignment.id,
          relationshipId: relationship,
          criterionKey: key,
          modelVersion: 1,
          ist: values[rater]?.[key]?.ist ?? 50,
          soll: 60,
          comment: values[rater]?.[key]?.comment ?? null,
          submittedAt: new Date(),
        })),
      );
    }
    // SRO der Beziehung ist niemand aus dem Test; erklären darf hier nur der Admin.
  });

  afterAll(async () => {
    await db.delete(schema.aiDraft).where(sql`${schema.aiDraft.orgId} = ${orgs.oem}`);
    await deleteRelationships(db, Object.values(orgs));
    await db.delete(schema.businessUnit).where(sql`${schema.businessUnit.orgId} = ${orgs.oem}`);
    await db.delete(schema.segmentModel).where(sql`${schema.segmentModel.orgId} = ${orgs.oem}`);
    await db.delete(schema.appUser).where(sql`${schema.appUser.id} in ${Object.values(users)}`);
    await db
      .delete(schema.organization)
      .where(sql`${schema.organization.id} in ${Object.values(orgs)}`);
    await testApp.close();
  });

  it('Ein Entwurf ist sichtbar als Entwurf, bis er übernommen wird', async () => {
    const created = await call(users.admin, 'POST');
    expect(created.status).toBe(200);
    const explained = parse(created.body);
    expect(explained.explanations.map((entry) => entry.criterionKey)).toEqual([c0, c1, c2]);
    const first = explained.explanations[0];
    expect(first?.draft?.status).toBe('draft');
    expect(first?.draft?.content).toMatch(/\.\s.+\.$/);
    expect(first?.accepted).toBeNull();

    // Andere mit Zugriff sehen den Entwurf nicht und dürfen nichts erzeugen.
    const member = parse((await call(users.raterA, 'GET')).body);
    expect(member.canExplain).toBe(false);
    expect(member.explanations.every((entry) => !entry.draft && !entry.accepted)).toBe(true);
    expect((await call(users.raterA, 'POST')).status).toBe(403);

    const draftId = first?.draft?.id as string;
    expect((await call(users.raterA, 'POST', `/${draftId}/accept`)).status).toBe(403);
    const accepted = parse((await call(users.admin, 'POST', `/${draftId}/accept`)).body);
    expect(accepted.explanations[0]?.accepted?.content).toBe(first?.draft?.content);
    expect(accepted.explanations[0]?.draft).toBeNull();
    const seen = parse((await call(users.raterA, 'GET')).body);
    expect(seen.explanations[0]?.accepted?.status).toBe('accepted');

    // Verworfen verschwindet; ein zweites Mal entscheiden geht nicht.
    const second = explained.explanations[1]?.draft?.id as string;
    const discarded = parse((await call(users.admin, 'POST', `/${second}/discard`)).body);
    expect(discarded.explanations[1]?.draft).toBeNull();
    expect(discarded.explanations[1]?.accepted).toBeNull();
    expect((await call(users.admin, 'POST', `/${second}/accept`)).status).toBe(409);

    const [audit] = await db
      .select({ objectType: schema.auditEvent.objectType })
      .from(schema.auditEvent)
      .where(sql`${schema.auditEvent.objectId} = ${draftId}`);
    expect(audit?.objectType).toBe('ai_draft');
  });

  it('Die Eingabe an die KI enthält keine Namen von Personen', async () => {
    TestDraftModel.requests.length = 0;
    expect((await call(users.admin, 'POST')).status).toBe(200);
    expect(TestDraftModel.requests).toHaveLength(2);
    const sent = TestDraftModel.requests.map((request) => request.prompt).join('\n');
    for (const name of [...Object.values(names), 'Müller'])
      for (const part of name.split(' ')) expect(sent).not.toContain(part);
    expect(sent).toContain('[Person] findet die Zusammenarbeit sehr eng.');
    expect(sent).toContain('Laut [Person] vom Lieferanten liefern sie pünktlich.');
    expect(sent).toContain('Antrieb, Qualität: 90.');
  });

  it('Der Lieferant sieht keinen Entwurf', async () => {
    expect((await call(users.supplier, 'GET')).status).toBe(403);
    expect((await call(users.supplier, 'POST')).status).toBe(403);
  });

  it('Ohne Begründungen erzeugt Reziproq keinen Entwurf, sondern einen Hinweis', async () => {
    const explained = parse((await call(users.admin, 'POST')).body);
    expect(explained.withoutReasons).toEqual([c2]);
    const third = explained.explanations.find((entry) => entry.criterionKey === c2);
    expect(third?.reasons).toBe(0);
    expect(third?.draft).toBeNull();
  });
});
