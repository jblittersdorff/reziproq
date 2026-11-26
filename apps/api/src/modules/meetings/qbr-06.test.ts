import { randomUUID } from 'node:crypto';
import { type Database, schema, sql } from '@reziproq/db';
import { meetingDetailSchema } from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';
import { printDocument } from '../print/print-document.js';
import { preReadHtml } from './pre-read.js';

// Tests zu docs/specs/QBR-06.md: Pre-Read als PDF in unter zehn Sekunden, nur mit dem, was die
// erzeugende Seite sehen darf, bei abgeschlossenen Terminen der eingefrorene Stand, Layout aus den
// Tokens und in Schwarz-Weiß lesbar.

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

describe('QBR-06 Pre-Read als PDF', () => {
  let testApp: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const run = randomUUID().slice(0, 8);
  const orgs = { oem: randomUUID(), supplier: randomUUID() };
  const rel = randomUUID();
  const users = { sro: `qbr6-sro-${run}`, kam: `qbr6-kam-${run}` };
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
      { id: orgs.oem, name: `QBR6-OEM ${run}` },
      { id: orgs.supplier, name: `QBR6-Lieferant ${run}` },
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
    await db.execute(sql`delete from commitment where relationship_id = ${rel}`);
    await db.execute(sql`delete from task where relationship_id = ${rel}`);
    await db.execute(sql`delete from meeting where relationship_id = ${rel}`);
    await deleteRelationships(db, Object.values(orgs));
    await db.execute(sql`delete from app_user where organization_id in ${Object.values(orgs)}`);
    await db.execute(sql`delete from organization_feature where organization_id = ${orgs.oem}`);
    await db.execute(sql`delete from organization where id in ${Object.values(orgs)}`);
    await testApp.close();
  });

  it('Ein Klick erzeugt das PDF in unter zehn Sekunden (lokal gemessen)', async () => {
    const result = await pdf(users.sro, buyer);
    expect(result.status).toBe(200);
    expect(result.type).toContain('application/pdf');
    expect(result.disposition).toContain('attachment');
    expect(result.milliseconds).toBeLessThan(10_000);
    // Titelseite mit Termin, Teilnehmenden und Agenda, danach der Stand.
    expect(result.text).toContain('Pre-Read');
    expect(result.text).toContain('Quartalsreview Q1');
    expect(result.text).toContain('Werk Nord');
    expect(result.text).toContain('Paul Plan');
    expect(result.text).toContain('Preis Leiterplatten');
    expect(result.text).toContain('Offene Maßnahmen');
    expect(result.text).toContain('Muster prüfen');
  }, 30_000);

  it('Das PDF des Lieferanten enthält keine internen Inhalte des Käufers, und umgekehrt (Test über den Text des PDFs)', async () => {
    const forBuyer = await pdf(users.sro, buyer);
    expect(forBuyer.text).toContain(`Käufer intern ${run}`);
    expect(forBuyer.text).toContain(`Käufer-Maßnahme intern ${run}`);
    expect(forBuyer.text).toContain('Interne Notiz');
    expect(forBuyer.text).not.toContain(`Lieferant intern ${run}`);
    expect(forBuyer.text).not.toContain(`Lieferanten-Maßnahme intern ${run}`);

    const forSupplier = await pdf(users.kam, supplier, 'en');
    expect(forSupplier.text).toContain('Pre-read');
    expect(forSupplier.text).toContain(`Lieferant intern ${run}`);
    expect(forSupplier.text).toContain(`Lieferanten-Maßnahme intern ${run}`);
    expect(forSupplier.text).toContain('Muster prüfen');
    expect(forSupplier.text).not.toContain(`Käufer intern ${run}`);
    expect(forSupplier.text).not.toContain(`Käufer-Maßnahme intern ${run}`);
  }, 30_000);

  it('Bei abgeschlossenen Terminen zeigt das PDF den eingefrorenen Stand', async () => {
    await json(users.sro, 'POST', `${buyer}/${meetingId}/abschliessen`);
    // Danach ändert sich der Stand am Ort: Das Protokoll zeigt trotzdem den alten.
    for (const table of ['commitment', 'task'] as const) {
      await db.execute(
        sql`update ${sql.identifier(table)} set title = 'Muster nachgeprüft' where relationship_id = ${rel} and title = 'Muster prüfen'`,
      );
    }
    const result = await pdf(users.sro, buyer);
    expect(result.text).toContain('Protokoll');
    expect(result.text).toContain('Eingefrorener Stand');
    expect(result.text).toContain('Muster prüfen');
    expect(result.text).not.toContain('Muster nachgeprüft');
  }, 30_000);

  it('Das Layout nutzt die Tokens und ist in Schwarz-Weiß lesbar', async () => {
    const detail = meetingDetailSchema.parse(await json(users.sro, 'GET', `${buyer}/${meetingId}`));
    const html = preReadHtml(detail, 'de');
    // Die Tokens der App stehen im Dokument; das Druck-Layout selbst nennt keine Farbwerte.
    expect(html).toContain('--ink: #0f1b22');
    const layout = printDocument({ lang: 'de', title: 'x', body: '' })
      .split('<style>')
      .at(-1)
      ?.split('</style>')[0];
    expect(layout).toBeDefined();
    expect(layout).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(layout).not.toMatch(/\brgb|hsl\(/i);
    // Jede Farbe im Druck-Layout ist ein Token (Rahmen, Flächen, Text).
    const colorRules =
      layout?.match(/(?:^|[\s;{])(?:color|background|border(?:-(?:top|bottom))?):[^;]*/g) ?? [];
    expect(colorRules.length).toBeGreaterThan(5);
    for (const rule of colorRules) {
      expect(rule, rule).toMatch(/var\(--/);
    }
    // Status steht als Wort, nie nur als Farbe; die interne Notiz ist als „Intern“ markiert.
    expect(html).toContain('Offen');
    expect(html).toMatch(/Interne Notiz<span class="chip">Intern<\/span>/);
  });
});
