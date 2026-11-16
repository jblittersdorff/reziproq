import { randomUUID } from 'node:crypto';
import { type Database, schema, sql } from '@reziproq/db';
import {
  maxPreReadWords,
  meetingDetailSchema,
  type PreReadDraft,
  preReadDraftSchema,
  wordCount,
} from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';
import { TestDraftModel } from '../ai-drafts/draft-model.js';

// Tests zu docs/specs/QBR-07.md mit AI_PROVIDER=test: Die Eingabe des Lieferanten enthält nichts
// Internes des Käufers, die übernommene Zusammenfassung steht nur im PDF der eigenen Seite, und der
// Entwurf hat höchstens 200 Wörter.

/** Text aller Seiten eines PDFs, über pdf.js gelesen. */
async function pdfText(buffer: ArrayBuffer): Promise<string> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const document = await pdfjs.getDocument({ data: new Uint8Array(buffer), useSystemFonts: true })
    .promise;
  const pages: string[] = [];
  for (let number = 1; number <= document.numPages; number += 1) {
    const page = await document.getPage(number);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => ('str' in item ? item.str : '')).join(' '));
  }
  return pages.join('\n').replace(/\s+/g, ' ');
}

describe('QBR-07 KI-Entwurf für den Pre-Read', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const run = randomUUID().slice(0, 8);
  const orgs = { oem: randomUUID(), supplier: randomUUID() };
  const rel = randomUUID();
  const users = {
    sro: `qbr7-sro-${run}`,
    kam: `qbr7-kam-${run}`,
    member: `qbr7-member-${run}`,
  };
  const buyer = `/suppliers/${rel}/termine`;
  const supplier = `/kunden/${rel}/termine`;
  let meetingId = '';

  const call = async (user: string, method: string, url: string, body?: unknown) => {
    const response = await fetch(`${testApp.baseUrl}/api${url}`, {
      method,
      headers: {
        authorization: `Bearer ${await testApp.signToken({ subject: user })}`,
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return response;
  };
  const json = async (user: string, method: string, url: string, body?: unknown) => {
    const response = await call(user, method, url, body);
    expect(response.status, `${method} ${url}`).toBeLessThan(300);
    return (await response.json().catch(() => null)) as unknown;
  };
  const pdf = async (user: string, base: string, locale = 'de') => {
    const started = performance.now();
    const response = await call(user, 'GET', `${base}/${meetingId}/pre-read?sprache=${locale}`);
    const buffer = await response.arrayBuffer();
    return {
      status: response.status,
      type: response.headers.get('content-type'),
      disposition: response.headers.get('content-disposition'),
      milliseconds: performance.now() - started,
      text: response.status === 200 ? await pdfText(buffer) : '',
    };
  };
  const action = (
    title: string,
    visibility: 'internal' | 'shared',
    owner: 'buyer' | 'supplier',
  ) => ({
    action: {
      title,
      description: null,
      visibility,
      ownerSide: owner,
      ownerUserId: owner === 'buyer' ? users.sro : users.kam,
      ownerName: null,
      dueDate: '2099-01-31',
    },
    sourceType: 'manual',
    sourceId: null,
  });

  beforeAll(async () => {
    testApp = await startTestApp();
    db = testApp.adminDb;
    await db.insert(schema.organization).values([
      { id: orgs.oem, name: `QBR7-OEM ${run}` },
      { id: orgs.supplier, name: `QBR7-Lieferant ${run}` },
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
        { ...person(users.member, 'Mia Mitglied', orgs.oem), orgRole: 'member' as const },
      ]);
    await insertRelationships(db, [{ id: rel, buyer: orgs.oem, supplier: orgs.supplier }]);
    await db.insert(schema.relationshipMember).values([
      { relationshipId: rel, orgId: orgs.oem, userId: users.sro, teamRole: 'sro' },
      { relationshipId: rel, orgId: orgs.supplier, userId: users.kam, teamRole: 'sro' },
      { relationshipId: rel, orgId: orgs.oem, userId: users.member, teamRole: 'member' },
    ]);
    // Lieferantenplan des laufenden Zyklus: nur beim Käufer
    const cycleId = randomUUID();
    await db
      .insert(schema.cycle)
      .values({ id: cycleId, relationshipId: rel, label: '2099', status: 'active' });
    await db.insert(schema.supplierPlan).values({
      relationshipId: rel,
      cycleId,
      summary: `Lieferantenplan ${run}: Zweitquelle aufbauen`,
    });
    const created = meetingDetailSchema.parse(
      await json(users.sro, 'POST', buyer, {
        type: 'quarterly_review',
        ruleSetItemId: null,
        title: 'Quartalsreview Q1',
        startsAt: '2099-03-15T09:00:00Z',
        location: 'Werk Nord',
        participants: ['Sara Ost', 'Paul Plan'],
        locale: 'de',
      }),
    );
    meetingId = created.meeting.id;
    await json(users.sro, 'PUT', `${buyer}/${meetingId}/agenda`, {
      items: ['Liefertreue', 'Preis Leiterplatten'],
    });
    await json(users.sro, 'PUT', `${buyer}/${meetingId}/notiz`, {
      text: `Käufer intern ${run}: Zweitquelle offen halten`,
    });
    await json(users.kam, 'PUT', `${supplier}/${meetingId}/notiz`, {
      text: `Lieferant intern ${run}: Kapazität knapp`,
    });
    await json(
      users.sro,
      'POST',
      `/suppliers/${rel}/massnahmen`,
      action('Muster prüfen', 'shared', 'buyer'),
    );
    await json(
      users.sro,
      'POST',
      `/suppliers/${rel}/massnahmen`,
      action(`Käufer-Maßnahme intern ${run}`, 'internal', 'buyer'),
    );
    await json(
      users.kam,
      'POST',
      `/kunden/${rel}/massnahmen`,
      action(`Lieferanten-Maßnahme intern ${run}`, 'internal', 'supplier'),
    );
  });

  afterAll(async () => {
    await db.execute(sql`delete from ai_draft where relationship_id = ${rel}`);
    await db.execute(sql`delete from supplier_plan where relationship_id = ${rel}`);
    await db.execute(sql`delete from action where relationship_id = ${rel}`);
    await db.execute(sql`delete from meeting where relationship_id = ${rel}`);
    await deleteRelationships(db, Object.values(orgs));
    await db.execute(sql`delete from app_user where organization_id in ${Object.values(orgs)}`);
    await db.execute(sql`delete from organization_feature where organization_id = ${orgs.oem}`);
    await db.execute(sql`delete from organization where id in ${Object.values(orgs)}`);
    await testApp.close();
  });

  const draftOf = (body: unknown): PreReadDraft => preReadDraftSchema.parse(body);
  const summaryPath = (base: string) => `${base}/${meetingId}/zusammenfassung`;

  it('Interne Bewertungen, Lieferantenplan und interne Notizen erscheinen nie im Entwurf des Lieferanten (Test über die Eingabe an die KI)', async () => {
    TestDraftModel.requests.length = 0;
    const forSupplier = draftOf(await json(users.kam, 'POST', summaryPath(supplier)));
    expect(forSupplier.draft?.status).toBe('draft');
    const supplierPrompt = TestDraftModel.requests.at(-1)?.prompt ?? '';
    expect(supplierPrompt).toContain('Seite: Lieferant');
    expect(supplierPrompt).toContain('Muster prüfen');
    expect(supplierPrompt).toContain(`Lieferanten-Maßnahme intern ${run}`);
    for (const secret of [
      `Käufer intern ${run}`,
      `Käufer-Maßnahme intern ${run}`,
      `Lieferantenplan ${run}`,
      'Interne Notiz',
      'Lieferantenplan:',
    ])
      expect(supplierPrompt).not.toContain(secret);
    // Auch die eigene interne Notiz geht beim Lieferanten nicht mit (nur der Käufer bekommt Notizen).
    expect(supplierPrompt).not.toContain(`Lieferant intern ${run}`);
    // Keine Namen von Personen
    for (const name of ['Sara', 'Ost', 'Kim', 'Kaiser', 'Paul', 'Plan '])
      expect(supplierPrompt).not.toContain(name);

    const forBuyer = draftOf(await json(users.sro, 'POST', summaryPath(buyer)));
    expect(forBuyer.draft?.status).toBe('draft');
    const buyerPrompt = TestDraftModel.requests.at(-1)?.prompt ?? '';
    expect(buyerPrompt).toContain(`Interne Notiz: Käufer intern ${run}`);
    expect(buyerPrompt).toContain(`Lieferantenplan: Lieferantenplan ${run}`);
    expect(buyerPrompt).not.toContain(`Lieferant intern ${run}`);
    expect(buyerPrompt).not.toContain(`Lieferanten-Maßnahme intern ${run}`);

    // Nur SRO bzw. Key Account Manager und Admins
    expect((await call(users.member, 'POST', summaryPath(buyer))).status).toBe(403);
    expect(draftOf(await json(users.member, 'GET', summaryPath(buyer))).draft).toBeNull();
  });

  it('Der übernommene Entwurf erscheint nur im PDF der eigenen Seite', async () => {
    const open = draftOf(await json(users.sro, 'GET', summaryPath(buyer)));
    const draftId = open.draft?.id as string;
    // Die andere Seite kennt den Entwurf nicht.
    expect(
      (
        await call(users.kam, 'POST', `${summaryPath(supplier)}/${draftId}/uebernehmen`, {
          content: 'x',
        })
      ).status,
    ).toBe(404);
    const edited = `Zusammenfassung Käufer ${run}: Stand gut, offen bleibt die Zweitquelle.`;
    const accepted = draftOf(
      await json(users.sro, 'POST', `${summaryPath(buyer)}/${draftId}/uebernehmen`, {
        content: edited,
      }),
    );
    expect(accepted.accepted?.content).toBe(edited);
    expect(accepted.draft).toBeNull();

    const forBuyer = await pdf(users.sro, buyer);
    expect(forBuyer.text).toContain('Zusammenfassung');
    expect(forBuyer.text).toContain(`Zusammenfassung Käufer ${run}`);
    const forSupplier = await pdf(users.kam, supplier);
    expect(forSupplier.text).not.toContain(`Zusammenfassung Käufer ${run}`);
    expect(draftOf(await json(users.kam, 'GET', summaryPath(supplier))).accepted).toBeNull();
  }, 30_000);

  it('Der Entwurf überschreitet nie 200 Wörter', async () => {
    const proposed = draftOf(await json(users.kam, 'POST', summaryPath(supplier)));
    const content = proposed.draft?.content ?? '';
    // Das Testmodell schreibt absichtlich mehr; Reziproq kürzt.
    expect(wordCount(content)).toBeGreaterThan(150);
    expect(wordCount(content)).toBeLessThanOrEqual(maxPreReadWords);
    // Auch bearbeitet übernommen nie mehr als 200 Wörter
    const tooLong = Array.from({ length: 201 }, () => 'Wort').join(' ');
    expect(
      (
        await call(
          users.kam,
          'POST',
          `${summaryPath(supplier)}/${proposed.draft?.id}/uebernehmen`,
          {
            content: tooLong,
          },
        )
      ).status,
    ).toBe(400);
  });
});
