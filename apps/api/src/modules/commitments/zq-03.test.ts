import { randomUUID } from 'node:crypto';
import { currentTime, type Database, schema, sql } from '@reziproq/db';
import { doneListSchema, offsetCycleDate } from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';
import { renderEmail } from '../email/templates.js';
import { berlinDate } from '../today/berlin.js';
import { CommitmentFollowupService } from './commitment-followup.service.js';

// ZQ-01 Regel 5 (K2-b.6, E-K1-5): Die Aufgabe „Zusagen nachhalten“ erinnert den Lieferanten an seine
// fälligen Zusagen, als Nachricht von Reziproq im Auftrag des Kunden, und der Lauf steht in Erledigt
// der verantwortlichen Person des Käufers (T2-ZQ3). Gegen die echte Datenbank, mit den Rechten der
// Seiten: Die Adressen der Leute des Lieferanten liest nur der Lieferant selbst.

describe('ZQ-01 Zusagen nachhalten (T2-ZQ3)', () => {
  const run = randomUUID().slice(0, 8);
  const orgs = { buyer: randomUUID(), supplier: randomUUID() };
  const users = {
    sro: `zq3-sro-${run}`,
    kam: `zq3-kam-${run}`,
    owner: `zq3-owner-${run}`,
  };
  const rel = randomUUID();
  const buyerName = `Hagen Antriebe ${run} (Demo)`;
  const supplierName = `Rhein Platinen ${run} (Demo)`;
  let app: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  let followup: CommitmentFollowupService;
  let today: string;

  async function call(user: string, method: string, path: string) {
    const response = await fetch(`${app.baseUrl}/api${path}`, {
      method,
      headers: { authorization: `Bearer ${await app.signToken({ subject: user })}` },
    });
    const text = await response.text();
    let parsed: unknown = text;
    try {
      parsed = JSON.parse(text);
    } catch {}
    return { status: response.status, body: parsed };
  }

  /** Geteilte Zusage, direkt in der Datenbank; Frist in Tagen ab heute */
  async function commitment(input: {
    title: string;
    side?: 'buyer' | 'supplier';
    days: number;
    owner?: string | null;
    status?: 'open' | 'kept';
    confirm?: 'both_confirmed' | 'buyer_confirmed';
  }) {
    const side = input.side ?? 'supplier';
    const [row] = await db
      .insert(schema.commitment)
      .values({
        relationshipId: rel,
        ownerOrgId: side === 'supplier' ? orgs.supplier : orgs.buyer,
        visibility: 'shared',
        side,
        title: input.title,
        ownerName: 'Nina Ott',
        ownerUserId: input.owner === undefined ? users.owner : input.owner,
        dueOn: offsetCycleDate(today, input.days),
        status: input.status ?? 'open',
        fulfilledEvidence: input.status === 'kept' ? { kind: 'goods_receipt' } : null,
        confirmState: input.confirm ?? 'both_confirmed',
        createdBy: users.kam,
        createdByName: 'Kai Am',
      })
      .returning({ id: schema.commitment.id });
    if (!row) throw new Error('Zusage fehlt');
    return row.id;
  }

  const outbox = async () =>
    (
      await db.execute<{
        email_title: string;
        email_recipient: string;
        email_sender: string | null;
        email_link: string;
        email_template: string;
        email_deadline: string | null;
      }>(sql`
        select email_title, email_recipient, email_sender, email_link, email_template, email_deadline
        from outbox_event where org_id = ${orgs.supplier} and event_type = 'email.followup'
        order by email_title`)
    ).rows;

  beforeAll(async () => {
    app = await startTestApp();
    db = app.adminDb;
    followup = app.app.get(CommitmentFollowupService);
    today = berlinDate(currentTime());
    await db.insert(schema.organization).values([
      { id: orgs.buyer, name: buyerName },
      { id: orgs.supplier, name: supplierName },
    ]);
    await db
      .insert(schema.organizationFeature)
      .values({ organizationId: orgs.buyer, feature: 'buyer' });
    await db.insert(schema.appUser).values([
      {
        id: users.sro,
        name: 'Jana Lück',
        email: `jana.${run}@hagen.example`,
        organizationId: orgs.buyer,
        orgRole: 'member',
        rolesImportedAt: new Date(),
      },
      {
        id: users.kam,
        name: 'Kai Am',
        email: `kai.${run}@rhein.example`,
        organizationId: orgs.supplier,
        orgRole: 'admin',
        rolesImportedAt: new Date(),
      },
      {
        id: users.owner,
        name: 'Nina Ott',
        givenName: 'Nina',
        email: `nina.${run}@rhein.example`,
        organizationId: orgs.supplier,
        orgRole: 'member',
        rolesImportedAt: new Date(),
      },
    ]);
    await insertRelationships(db, [{ id: rel, buyer: orgs.buyer, supplier: orgs.supplier }]);
    await db.insert(schema.relationshipMember).values([
      { relationshipId: rel, orgId: orgs.buyer, userId: users.sro, teamRole: 'sro' },
      { relationshipId: rel, orgId: orgs.supplier, userId: users.kam, teamRole: 'sro' },
    ]);
  });

  afterAll(async () => {
    await db.execute(sql`delete from outbox_event where org_id in ${Object.values(orgs)}`);
    await db
      .execute(sql`delete from audit_event where owner_org_id in ${Object.values(orgs)}`)
      .catch(() => undefined);
    await db.execute(sql`delete from reminder_sent where relationship_id = ${rel}`);
    await db.execute(sql`delete from agent_run where org_id = ${orgs.buyer}`);
    await db.execute(sql`delete from agent_version where org_id = ${orgs.buyer}`);
    await db.execute(sql`delete from agent where org_id = ${orgs.buyer}`);
    await db.execute(sql`delete from worker_setting where org_id = ${orgs.buyer}`);
    await db.execute(sql`delete from org_setting where org_id = ${orgs.buyer}`);
    await db.execute(sql`delete from relationship_member where relationship_id = ${rel}`);
    await deleteRelationships(db, Object.values(orgs));
    await db.execute(sql`delete from app_user where id in ${Object.values(users)}`);
    await db.execute(sql`delete from organization where id in ${Object.values(orgs)}`);
    await app.close();
  });

  it('T2-ZQ3: Erinnerung an die fällige Zusage des Lieferanten, als Nachricht von Reziproq, steht in Erledigt', async () => {
    await commitment({ title: '8D-Bericht Charge 4711', days: -10 });
    // Ohne genannte Person beim Lieferanten geht die Erinnerung an seinen Key Account Manager
    await commitment({ title: 'Prüfbericht Gehäuse', days: -1, owner: null });
    // Nicht erinnert: noch nicht fällig, nur einseitig bestätigt, gehalten, Zusage des Käufers
    await commitment({ title: 'Muster Starrflex', days: 5 });
    await commitment({ title: 'Kapazitätsmeldung', days: -3, confirm: 'buyer_confirmed' });
    await commitment({ title: 'Lieferavis Q3', days: -20, status: 'kept' });
    await commitment({ title: 'Prognose teilen', side: 'buyer', days: -4 });

    expect(await followup.runDaily([orgs.buyer])).toBe(2);
    const mails = await outbox();
    expect(mails.map((mail) => [mail.email_title, mail.email_recipient])).toEqual([
      ['8D-Bericht Charge 4711', `nina.${run}@rhein.example`],
      ['Prüfbericht Gehäuse', `kai.${run}@rhein.example`],
    ]);
    const [mail] = mails;
    expect(mail).toMatchObject({
      email_template: 'commitment_followup',
      email_sender: buyerName,
      email_link: `/kunden/${rel}/umsetzung/massnahmen`,
    });
    // Die Mail trägt die Kennzeichnung: Nachricht von Reziproq im Auftrag des Kunden
    const rendered = renderEmail(
      {
        template: 'commitment_followup',
        locale: 'de',
        firstName: 'Nina',
        title: mail?.email_title ?? '',
        ...(mail?.email_deadline ? { deadline: mail.email_deadline } : {}),
        link: mail?.email_link ?? '/',
        sender: buyerName,
      },
      'https://app.reziproq.test',
    );
    expect(rendered.subject).toBe('Erinnerung von Reziproq: 8D-Bericht Charge 4711');
    expect(rendered.text).toContain(`Nachricht von Reziproq im Auftrag von ${buyerName}.`);
    expect(rendered.html).toContain('Nachricht von Reziproq im Auftrag von');
    // Im Verlauf des Lieferanten steht Reziproq als Absender
    const audit = await db.execute<{ actor_name: string }>(sql`
      select actor_name from audit_event
      where owner_org_id = ${orgs.supplier} and object_type = 'reminder_sent'`);
    expect(audit.rows.map((row) => row.actor_name)).toEqual(['Reziproq', 'Reziproq']);

    // Erledigt der verantwortlichen Person des Käufers, ohne Rücknahme (eine Mail lässt sich nicht
    // zurückholen), mit dem Weg zu den Zusagen der Beziehung
    const done = doneListSchema.parse((await call(users.sro, 'GET', '/erledigt')).body);
    const reminders = done.rows.filter((row) => row.action === 'commitment_remind');
    expect(reminders.map((row) => [row.subject, row.recipient]).sort()).toEqual([
      ['8D-Bericht Charge 4711', 'Nina Ott'],
      ['Prüfbericht Gehäuse', 'Kai Am'],
    ]);
    expect(reminders[0]).toMatchObject({
      task: 'commitment_followup',
      taskName: 'Zusagen nachhalten',
      status: 'done',
      href: `/lieferanten/${rel}/umsetzung/massnahmen`,
      undo: { possible: false, blocker: 'ohne' },
    });
    expect(
      await call(users.sro, 'POST', `/erledigt/${reminders[0]?.id}/zuruecknehmen`),
    ).toMatchObject({ status: 409, body: { code: 'ohne' } });
  });

  it('am selben Tag und innerhalb von sieben Tagen keine zweite Erinnerung an dieselbe Zusage', async () => {
    const before = (await outbox()).length;
    expect(await followup.runDaily([orgs.buyer])).toBe(0);
    expect(await outbox()).toHaveLength(before);
  });

  it('auf einer Stufe ohne Wirkung oder ausgeschaltet entsteht keine Erinnerung', async () => {
    await commitment({ title: 'Zeichnungsfreigabe', days: -2 });
    await db.insert(schema.workerSetting).values({
      orgId: orgs.buyer,
      userId: users.sro,
      agentKey: 'commitment_followup',
      level: 'prepare',
    });
    expect(await followup.runDaily([orgs.buyer])).toBe(0);
    await db.execute(sql`delete from worker_setting where org_id = ${orgs.buyer}`);
    await db.insert(schema.orgSetting).values({
      orgId: orgs.buyer,
      key: 'ai_workers',
      value: { commitment_followup: { enabled: false } },
      updatedBy: users.sro,
    });
    expect(await followup.runDaily([orgs.buyer])).toBe(0);
    await db.execute(sql`delete from org_setting where org_id = ${orgs.buyer}`);
    // Wieder an und auf Erledigen: Jetzt geht die Erinnerung
    expect(await followup.runDaily([orgs.buyer])).toBe(1);
    expect((await outbox()).map((mail) => mail.email_title)).toContain('Zeichnungsfreigabe');
  });
});
