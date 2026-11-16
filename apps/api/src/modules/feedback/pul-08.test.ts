import { randomUUID } from 'node:crypto';
import { type Database, schema, sql } from '@reziproq/db';
import {
  type FeedbackThemes,
  feedbackThemesSchema,
  surveyWaveDetailSchema,
} from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';
import {
  DRAFT_MODEL,
  type DraftModel,
  type DraftRequest,
  TestDraftModel,
} from '../ai-drafts/draft-model.js';
import { longestSharedRun } from '../ai-drafts/quotes.js';

/** Testmodell, das auf Wunsch einen Freitext wörtlich übernimmt */
class QuotingModel implements DraftModel {
  readonly name = 'test';
  quote = false;
  private readonly plain = new TestDraftModel();

  async write(request: DraftRequest) {
    if (!this.quote) return this.plain.write(request);
    const first = request.prompt.split('\n')[1] ?? '';
    return `${first}\n- Ein weiteres Thema ohne Zitat.`;
  }
}

// Tests zu docs/specs/PUL-08.md mit AI_PROVIDER=test.
describe('PUL-08 KI fasst Freitexte zu Themen zusammen', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const model = new QuotingModel();
  const run = randomUUID().slice(0, 8);
  const orgs = { oem: randomUUID(), supplier: randomUUID() };
  const rel = randomUUID();
  const users = { sro: `pul08-sro-${run}`, kam: `pul08-kam-${run}` };
  const buyer = `/suppliers/${rel}/feedback`;
  const supplier = `/kunden/${rel}/feedback`;
  const tokens: Record<string, string> = {};
  let waveId = '';
  const buyerTexts = [
    'Die Abstimmung bei technischen Änderungen am Bauteil dauert oft mehrere Wochen zu lange.',
    'Wir wünschen uns frühere Informationen, wenn sich Lieferzeiten oder Kapazitäten verschieben.',
    'Bei Qualitätsproblemen reagiert das Team schnell, die Ursachenanalyse bleibt aber oberflächlich.',
  ];
  const supplierTexts = [
    'Die Prognosen für Abrufe kommen spät und schwanken von Woche zu Woche sehr stark.',
    'Ansprechpartner beim Kunden wechseln häufig, Zuständigkeiten sind deshalb oft unklar.',
  ];

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
  const themes = (body: unknown): FeedbackThemes => feedbackThemesSchema.parse(body);
  const answer = async (who: string, comment: string | null) => {
    const response = await fetch(`${testApp.baseUrl}/api/umfrage/${tokens[who]}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        answers: {
          pulse_satisfaction: { current: 4, target: 5 },
          pulse_trust: { current: 3, target: 5 },
          pulse_alignment: { current: 3, target: 4 },
        },
        comment,
      }),
    });
    expect(response.status).toBe(200);
  };
  const people = [
    ['b1', 'buyer', 'purchasing'],
    ['b2', 'buyer', 'purchasing'],
    ['b3', 'buyer', 'quality'],
    ['s1', 'supplier', 'sales'],
    ['s2', 'supplier', 'sales'],
    ['s3', 'supplier', 'sales'],
  ] as const;

  beforeAll(async () => {
    testApp = await startTestApp({
      configure: (builder) => builder.overrideProvider(DRAFT_MODEL).useValue(model),
    });
    db = testApp.adminDb;
    await db.insert(schema.organization).values([
      { id: orgs.oem, name: `PUL8-OEM ${run}` },
      { id: orgs.supplier, name: `PUL8-Lieferant ${run}` },
    ]);
    await db
      .insert(schema.organizationFeature)
      .values({ organizationId: orgs.oem, feature: 'buyer' });
    const user = (id: string, organizationId: string) => ({
      id,
      name: id,
      email: `${id}@example.com`,
      organizationId,
      orgRole: 'member' as const,
      rolesImportedAt: new Date(),
    });
    await db
      .insert(schema.appUser)
      .values([user(users.sro, orgs.oem), user(users.kam, orgs.supplier)]);
    await insertRelationships(db, [{ id: rel, buyer: orgs.oem, supplier: orgs.supplier }]);
    // SRO beim Käufer, Key Account Manager (Teamrolle sro) beim Lieferanten
    await db.insert(schema.relationshipMember).values([
      { relationshipId: rel, orgId: orgs.oem, userId: users.sro, teamRole: 'sro' },
      { relationshipId: rel, orgId: orgs.supplier, userId: users.kam, teamRole: 'sro' },
    ]);
    const started = surveyWaveDetailSchema.parse(
      (
        await call(users.sro, 'POST', buyer, {
          kind: 'pulse',
          dueDate: '2099-03-31',
          participants: people.map(([key, side, fn]) => ({
            side,
            email: `pul08-${key}-${run}@example.com`,
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
    for (const [index, key] of ['b1', 'b2', 'b3'].entries())
      await answer(key, buyerTexts[index] ?? null);
    for (const [index, key] of ['s1', 's2', 's3'].entries())
      await answer(key, supplierTexts[index] ?? null);
    await db.execute(sql`update survey_wave set due_date = current_date - 1 where id = ${waveId}`);
    const revealed = surveyWaveDetailSchema.parse(
      (await call(users.sro, 'GET', `${buyer}/${waveId}`)).body,
    );
    expect(revealed.results?.freeTexts).toHaveLength(2);
  });

  afterAll(async () => {
    await db.delete(schema.aiDraft).where(sql`${schema.aiDraft.relationshipId} = ${rel}`);
    await db.execute(sql`delete from survey_free_text where relationship_id = ${rel}`);
    await db.execute(sql`delete from survey_result where relationship_id = ${rel}`);
    await db.execute(sql`delete from survey_response where relationship_id = ${rel}`);
    await deleteRelationships(db, Object.values(orgs));
    await db.execute(sql`delete from survey_template where org_id in ${Object.values(orgs)}`);
    await db.execute(sql`delete from app_user where organization_id in ${Object.values(orgs)}`);
    await db.execute(sql`delete from organization_feature where organization_id = ${orgs.oem}`);
    await db.execute(sql`delete from organization where id in ${Object.values(orgs)}`);
    await testApp.close();
  });

  it('Ohne mindestens drei Freitexte gibt es keinen Entwurf', async () => {
    // Der Käufer sieht nur zwei Freitexte des Lieferanten.
    const before = themes((await call(users.sro, 'GET', `${buyer}/${waveId}/themen`)).body);
    expect(before).toMatchObject({ freeTexts: 2, canSummarize: true, draft: null });
    const response = await call(users.sro, 'POST', `${buyer}/${waveId}/themen`);
    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({ code: 'zu_wenige_freitexte' });
    const stored = await db
      .select()
      .from(schema.aiDraft)
      .where(sql`${schema.aiDraft.relationshipId} = ${rel}`);
    expect(stored).toHaveLength(0);
  });

  it('Die Ausgabe enthält keine Wortfolge von mehr als acht Wörtern aus einem Freitext', async () => {
    // Ein Entwurf mit Zitat wird nicht gespeichert.
    model.quote = true;
    const quoted = await call(users.kam, 'POST', `${supplier}/${waveId}/themen`);
    model.quote = false;
    expect(quoted.status).toBe(422);
    expect(
      themes((await call(users.kam, 'GET', `${supplier}/${waveId}/themen`)).body).draft,
    ).toBeNull();

    const created = themes((await call(users.kam, 'POST', `${supplier}/${waveId}/themen`)).body);
    expect(created.draft?.status).toBe('draft');
    const content = created.draft?.content ?? '';
    expect(content.split('\n').length).toBeLessThanOrEqual(5);
    expect(longestSharedRun(content, buyerTexts)).toBeLessThanOrEqual(8);
  });

  it('Jede Seite sieht nur ihre eigene Zusammenfassung', async () => {
    const open = themes((await call(users.kam, 'GET', `${supplier}/${waveId}/themen`)).body);
    const draftId = open.draft?.id as string;
    // Die andere Seite kann den Entwurf weder sehen noch übernehmen.
    expect(
      (await call(users.sro, 'POST', `${buyer}/${waveId}/themen/${draftId}/uebernehmen`)).status,
    ).toBe(404);
    const accepted = themes(
      (await call(users.kam, 'POST', `${supplier}/${waveId}/themen/${draftId}/uebernehmen`)).body,
    );
    expect(accepted.accepted?.status).toBe('accepted');
    expect(accepted.draft).toBeNull();
    const buyerView = themes((await call(users.sro, 'GET', `${buyer}/${waveId}/themen`)).body);
    expect(buyerView.accepted).toBeNull();
    expect(buyerView.draft).toBeNull();
    // Auch direkt in der Datenbank sieht der Käufer die Zeile nicht (org_private).
    const visible = await db.execute<{ n: number }>(sql`
      select count(*)::int as n from ai_draft where relationship_id = ${rel} and org_id = ${orgs.oem}
    `);
    expect(visible.rows[0]?.n).toBe(0);
  });
});
