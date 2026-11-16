import { randomUUID } from 'node:crypto';
import { type Database, schema, sql } from '@reziproq/db';
import { type SurveyWaveDetail, surveyWaveDetailSchema } from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';
import { feedbackHtml } from '../print/documents.js';
import { PdfService } from '../print/pdf.service.js';

// Tests zu docs/specs/QS-03.md, PDFs: Lieferantenplan (nur Käufer), Gemeinsamer Plan und
// Feedback-Ergebnis für beide Seiten, jeweils ein Klick und nur mit Sichtbarem (Test über den Text).

async function pdfText(buffer: ArrayBuffer): Promise<string> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const document = await pdfjs.getDocument({ data: new Uint8Array(buffer), useSystemFonts: true })
    .promise;
  const pages: string[] = [];
  for (let number = 1; number <= document.numPages; number += 1) {
    const content = await (await document.getPage(number)).getTextContent();
    pages.push(content.items.map((item) => ('str' in item ? item.str : '')).join(' '));
  }
  // Ohne Leerzeichen vergleichen: Die enge Laufweite der Titel trennt Wörter im Text nicht immer.
  return pages.join(' ').replace(/\s+/g, '');
}
const squash = (text: string) => text.replace(/\s+/g, '');

describe('QS-03 PDFs', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const run = randomUUID().slice(0, 8);
  const orgs = { oem: randomUUID(), supplier: randomUUID() };
  const rel = randomUUID();
  const users = { sro: `qs3p-sro-${run}`, kam: `qs3p-kam-${run}` };
  let waveId = '';

  const call = async (user: string, method: string, url: string, body?: unknown) =>
    fetch(`${testApp.baseUrl}/api${url}`, {
      method,
      headers: {
        authorization: `Bearer ${await testApp.signToken({ subject: user })}`,
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  const pdf = async (user: string, url: string) => {
    const response = await call(user, 'GET', url);
    return {
      status: response.status,
      type: response.headers.get('content-type') ?? '',
      text: response.status === 200 ? await pdfText(await response.arrayBuffer()) : '',
    };
  };

  beforeAll(async () => {
    testApp = await startTestApp();
    db = testApp.adminDb;
    await db.insert(schema.organization).values([
      { id: orgs.oem, name: `QS3P-OEM ${run}` },
      { id: orgs.supplier, name: `QS3P-Lieferant ${run}` },
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
        person(users.sro, 'Sara Ost', orgs.oem),
        person(users.kam, 'Kim Kaiser', orgs.supplier),
      ]);
    await insertRelationships(db, [{ id: rel, buyer: orgs.oem, supplier: orgs.supplier }]);
    await db.insert(schema.relationshipMember).values([
      { relationshipId: rel, orgId: orgs.oem, userId: users.sro, teamRole: 'sro' },
      { relationshipId: rel, orgId: orgs.supplier, userId: users.kam, teamRole: 'sro' },
    ]);
    // Lieferantenplan des Käufers im aktiven Zyklus
    await db.insert(schema.cycle).values({ relationshipId: rel, label: '2026', status: 'active' });
    expect((await call(users.sro, 'POST', `/suppliers/${rel}/plan`)).status).toBeLessThan(300);
    await db.execute(
      sql`update supplier_plan set summary = ${`Interne Planung ${run}`} where relationship_id = ${rel}`,
    );
    // Gemeinsamer Plan mit Themen beider Seiten und einem internen Thema des Käufers
    expect(
      (
        await call(users.sro, 'POST', `/suppliers/${rel}/jbp`, {
          startsAt: '2099-01-15T09:00:00Z',
          location: null,
          locale: 'de',
        })
      ).status,
    ).toBeLessThan(300);
    await call(users.sro, 'POST', `/suppliers/${rel}/jbp/themen`, {
      title: `Ausfälle senken ${run}`,
      description: '',
    });
    await call(users.kam, 'POST', `/kunden/${rel}/jbp/themen`, {
      title: `Neues Werk ${run}`,
      description: '',
    });
    const [plan] = await db
      .select({ id: schema.jbp.id })
      .from(schema.jbp)
      .where(sql`relationship_id = ${rel}`);
    await db.insert(schema.jbpTopic).values({
      relationshipId: rel,
      ownerOrgId: orgs.oem,
      visibility: 'internal',
      jbpId: plan?.id as string,
      side: 'buyer',
      title: `Zweitquelle intern ${run}`,
      priority: 99,
      createdBy: users.sro,
      createdByName: 'Sara Ost',
    });
    // Feedback-Welle, noch nicht aufgedeckt
    const started = await call(users.sro, 'POST', `/suppliers/${rel}/feedback`, {
      kind: 'pulse',
      dueDate: '2099-03-31',
      participants: [
        { side: 'buyer', email: `qs3p-a-${run}@example.com`, name: null, function: 'purchasing' },
      ],
    });
    waveId = surveyWaveDetailSchema.parse(await started.json()).wave.id;
  });

  afterAll(async () => {
    await db.execute(sql`delete from supplier_plan where relationship_id = ${rel}`);
    await db.execute(sql`delete from jbp_topic where relationship_id = ${rel}`);
    await db.execute(sql`delete from jbp where relationship_id = ${rel}`);
    await db.execute(sql`delete from meeting where relationship_id = ${rel}`);
    await deleteRelationships(db, Object.values(orgs));
    await db.execute(sql`delete from app_user where organization_id in ${Object.values(orgs)}`);
    await db.execute(sql`delete from objective_category where org_id in ${Object.values(orgs)}`);
    await db.execute(sql`delete from survey_template where org_id in ${Object.values(orgs)}`);
    await db.execute(sql`delete from organization_feature where organization_id = ${orgs.oem}`);
    await db.execute(sql`delete from organization where id in ${Object.values(orgs)}`);
    await testApp.close();
  });

  it('Jedes PDF entsteht mit einem Klick und enthält nur Sichtbares (Test über den Text)', async () => {
    // Lieferantenplan: nur der Käufer, ganz intern markiert
    const plan = await pdf(users.sro, `/suppliers/${rel}/plan/pdf`);
    expect(plan.status).toBe(200);
    expect(plan.type).toContain('application/pdf');
    expect(plan.text).toContain(squash(`Interne Planung ${run}`));
    expect(plan.text).toContain('Intern');
    expect((await call(users.kam, 'GET', `/suppliers/${rel}/plan/pdf`)).status).toBe(403);

    // Gemeinsamer Plan: beide Seiten, das interne Thema nur beim Käufer
    const buyerPlan = await pdf(users.sro, `/suppliers/${rel}/jbp/pdf`);
    const supplierPlan = await pdf(users.kam, `/kunden/${rel}/jbp/pdf?sprache=en`);
    expect(buyerPlan.status).toBe(200);
    expect(supplierPlan.status).toBe(200);
    for (const text of [buyerPlan.text, supplierPlan.text]) {
      expect(text).toContain(squash(`Ausfälle senken ${run}`));
      expect(text).toContain(squash(`Neues Werk ${run}`));
    }
    expect(buyerPlan.text).toContain(squash(`Zweitquelle intern ${run}`));
    expect(supplierPlan.text).not.toContain(squash(`Zweitquelle intern ${run}`));
    expect(supplierPlan.text).toContain('Jointplan');

    // Feedback: beide Seiten; vor dem Aufdecken nur der Hinweis
    const buyerFeedback = await pdf(users.sro, `/suppliers/${rel}/feedback/${waveId}/pdf`);
    const supplierFeedback = await pdf(users.kam, `/kunden/${rel}/feedback/${waveId}/pdf`);
    expect(buyerFeedback.status).toBe(200);
    expect(supplierFeedback.status).toBe(200);
    expect(buyerFeedback.text).toContain(squash('noch nicht aufgedeckt'));
  }, 60_000);

  it('Das Feedback-Ergebnis zeigt interne Maßnahmen nur, wenn die API sie der Seite gibt, markiert als intern', async () => {
    // Nur die Felder, die die Druckseite liest; der Rest der Antwort spielt hier keine Rolle.
    const detail = (actions: unknown): SurveyWaveDetail =>
      ({
        wave: {
          id: randomUUID(),
          kind: 'annual',
          templateVersion: 1,
          dueDate: '2026-12-31',
          createdAt: '2026-11-01T00:00:00Z',
          createdByName: 'Sara Ost',
          buyerClosedAt: null,
          supplierClosedAt: null,
          status: 'closed',
          turnout: {
            buyer: { invited: 3, answered: 3 },
            supplier: { invited: 3, answered: 3 },
          },
        },
        ownSide: 'buyer',
        participants: [],
        canInvite: false,
        canClose: false,
        canExtend: false,
        results: {
          revealedAt: '2026-12-01T00:00:00Z',
          responses: { buyer: 3, supplier: 3 },
          dimensions: [
            {
              dimension: 'transparency',
              resultId: null,
              buyer: { ist: 3.2, soll: 4.5 },
              supplier: { ist: 1.8, soll: 4.6 },
              delta: 1.4,
            },
          ],
          topGaps: [],
          functions: [],
          questions: [],
          freeTexts: ['Mehr Vorlauf bei Abrufen'],
          actions,
        },
      }) as unknown as SurveyWaveDetail;
    const pdfService = new PdfService();
    try {
      const withInternal = squash(
        await pdfText(
          (
            await pdfService.render(
              feedbackHtml(
                detail([
                  {
                    id: randomUUID(),
                    title: 'Abrufe früher melden',
                    dimension: 'transparency',
                    status: 'open',
                    visibility: 'shared',
                    own: true,
                  },
                  {
                    id: randomUUID(),
                    title: 'Eigene Liste nachziehen',
                    dimension: 'transparency',
                    status: 'in_progress',
                    visibility: 'internal',
                    own: true,
                  },
                ] as never),
                'Rheintal',
                'de',
              ),
            )
          ).buffer as ArrayBuffer,
        ),
      );
      expect(withInternal).toContain('Transparenz');
      expect(withInternal).toContain(squash('Mehr Vorlauf bei Abrufen'));
      expect(withInternal).toContain(squash('Abrufe früher melden'));
      expect(withInternal).toContain(squash('Eigene Liste nachziehen'));
      expect(withInternal).toContain('Intern');
    } finally {
      await pdfService.onModuleDestroy();
    }
  }, 60_000);
});
