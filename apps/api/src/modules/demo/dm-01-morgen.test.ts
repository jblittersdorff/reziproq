import { type Database, nordwind, nordwindPeople, seedNordwind, sql } from '@reziproq/db';
import { doneListSchema, inboxSchema, reviewStackSchema, todayPageSchema } from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp } from '../../testing/test-app.js';

// DM-01, Drehbuch K1 „Morgen mit Reziproq“ (K1-g.3): Der Seed von Nordwind ergibt um Mo 23.11.,
// 07:30 über die echten Dienste genau den Stand für Jan-Luka: drei Fokus-Themen, vier Entwürfe in
// Kurz prüfen, 14 Vorgänge in Erledigt (zwölf Mails mit Zurücknehmen, ein Termin, ein Briefing).
// Nach dem Zurücknehmen der Mail (Schritt 3) stehen fünf Einträge in Kurz prüfen: „4 von 5“.
// Schritte 5 bis 7 (Wertpotenzial, Eilabrufe) und die Scorecard mit Herkunft folgen mit K4.
describe('DM-01 Drehbuch K1: Stand am Mo 23.11., 07:30 (K1-g.3)', () => {
  let app: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  const janLuka = nordwindPeople.janLuka.id;

  async function call(method: string, path: string, body?: unknown) {
    const response = await fetch(`${app.baseUrl}/api${path}`, {
      method,
      headers: {
        authorization: `Bearer ${await app.signToken({ subject: janLuka })}`,
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: (await response.json().catch(() => null)) as unknown };
  }
  const today = async () => todayPageSchema.parse((await call('GET', '/heute')).body);
  const done = async () => doneListSchema.parse((await call('GET', '/erledigt')).body);

  beforeAll(async () => {
    app = await startTestApp();
    db = app.adminDb;
    await seedNordwind(db, { nodeEnv: 'test' });
  });

  afterAll(async () => {
    const orgs = (
      await db.execute<{ id: string }>(
        sql`select app_demo_orgs_von(${nordwind.org.id}::uuid) as id`,
      )
    ).rows.map((row) => row.id);
    await db.execute(sql`select app_demo_leeren(${nordwind.org.id}::uuid)`);
    if (orgs.length > 0) await db.execute(sql`delete from organization where id in ${orgs}`);
    await app.close();
  });

  it('Schritt 1: Heute zeigt drei Fokus-Themen, vier Entwürfe und 14 Vorgänge im Hintergrund', async () => {
    const page = await today();
    expect(page.today).toBe('2026-11-23');
    expect(page.openFocus).toBe(3);
    expect(page.review.count).toBe(4);
    expect(page.done.count).toBe(14);
  });

  it('Schritt 2: Erledigt nennt zwölf Mails, darunter die von Nils Ott, den QBR und das Briefing', async () => {
    const list = await done();
    const mails = list.rows.filter((row) => row.action === 'mail_assign');
    expect(mails).toHaveLength(12);
    expect(mails.find((row) => row.sender === 'Nils Ott')).toMatchObject({
      subject: null,
      counterpart: 'Rheintal Elektronik',
      undo: { possible: true, blocker: null },
    });
    expect(list.rows.find((row) => row.action === 'inbound_assign')?.subject).toBe('QBR Nordwerk');
    expect(list.rows.find((row) => row.action === 'prepared')?.openDrafts).toBe(1);
  });

  it('Schritt 3: Zurücknehmen legt die Mail von Nils Ott wieder unter „Zuordnen“', async () => {
    const mail = (await done()).rows.find((row) => row.sender === 'Nils Ott');
    expect((await call('POST', `/erledigt/${mail?.id}/zuruecknehmen`)).status).toBeLessThan(300);
    const inbox = inboxSchema.parse((await call('GET', '/mein-tag/eingang')).body);
    expect(inbox.open.some((entry) => entry.kind === 'mail')).toBe(true);
    expect((await done()).rows.find((row) => row.id === mail?.id)?.status).toBe('undone');
  });

  it('Schritt 4: Kurz prüfen mit den vier Entwürfen und der Mail, vier übernehmen, einen verwerfen', async () => {
    const stack = reviewStackSchema.parse((await call('GET', '/kurz-pruefen')).body);
    expect(stack.items.map((item) => item.title)).toEqual(
      expect.arrayContaining([
        'Liefertreue Oktober: 94 % übernehmen',
        'Prognose ab Januar monatlich an Rheintal teilen',
      ]),
    );
    expect(stack.items.filter((item) => item.source === 'ai_draft')).toHaveLength(4);
    expect(stack.items.filter((item) => item.source === 'inbound')).toHaveLength(1);
    const discard = stack.items.find((item) => item.source === 'ai_draft');
    for (const item of stack.items.filter((entry) => entry.id !== discard?.id)) {
      expect(
        (await call('POST', `/kurz-pruefen/${item.id}`, { decision: 'uebernehmen' })).status,
      ).toBeLessThan(300);
    }
    expect(
      (
        await call('POST', `/kurz-pruefen/${discard?.id}`, {
          decision: 'verwerfen',
          reason: 'Passt nicht zum JBP',
        })
      ).status,
    ).toBeLessThan(300);
    const after = reviewStackSchema.parse((await call('GET', '/kurz-pruefen')).body);
    expect(after.items).toHaveLength(0);
  });

  it('Schritt 10: Zurücksetzen stellt den Stand von Schritt 1 wieder her', async () => {
    expect((await call('POST', '/demo/regie/zuruecksetzen')).status).toBe(200);
    const page = await today();
    expect(page.openFocus).toBe(3);
    expect(page.review.count).toBe(4);
    expect(page.done.count).toBe(14);
  });
});
