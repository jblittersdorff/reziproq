import { randomUUID } from 'node:crypto';
import { type Database, schema, sql, withTenant } from '@reziproq/db';
import { inboxSchema, integrationsSchema } from '@reziproq/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { deleteRelationships, insertRelationships } from '../../testing/relationships.js';
import { startTestApp } from '../../testing/test-app.js';
import { FakeProvider } from '../integrations/fake-provider.js';
import { FakeGraphClient } from '../integrations/graph-client.js';
import { IntegrationQueue } from '../integrations/integration-queue.js';
import {
  IntegrationsService,
  signatureHeader,
  signPayload,
} from '../integrations/integrations.service.js';
import { CalendarIntakeService } from './calendar.service.js';
import { agendaEnd, agendaStart, replaceAgendaBlock } from './calendar-rules.js';
import { parseIcs } from './ics.js';

// Tests zu docs/specs/IN-03.md mit Anbieter fake: Eingangsadresse legt einen internen Termin an,
// UID/SEQUENCE und CANCEL, fremde Absender und fehlendes DKIM abgelehnt, nur eigene Teilnehmer
// nicht gespeichert, zwei Lieferanten zur Prüfung, Add-in verknüpft, Agenda nur im Block,
// Kalenderabgleich nie automatisch, gelernte Domains, ohne Zugriff zum SRO, nichts für Lieferanten.
describe('IN-03 Termine aus Outlook und Google', () => {
  const run = randomUUID().slice(0, 8);
  const own = `oem-${run}.example`;
  const domains = { rheintal: `rheintal-${run}.example`, silesia: `silesia-${run}.example` };
  const orgs = {
    a: randomUUID(),
    rheintal: randomUUID(),
    silesia: randomUUID(),
    neu: randomUUID(),
  };
  const users = {
    admin: `in03-adm-${run}`,
    anna: `in03-anna-${run}`,
    bert: `in03-bert-${run}`,
    carla: `in03-carla-${run}`,
    supplier: `in03-sup-${run}`,
  };
  const mail = (user: keyof typeof users) => `${user}@${own}`;
  const rel = { rheintal: randomUUID(), silesia: randomUUID(), neu: randomUUID() };
  let app: Awaited<ReturnType<typeof startTestApp>>;
  let db: Database;
  let integrations: IntegrationsService;
  let queue: IntegrationQueue;
  let intake: CalendarIntakeService;
  let fake: FakeProvider;
  let graph: FakeGraphClient;
  let hook: { path: string; secret: string; connectionId: string };

  async function call(user: string, method: string, path: string, body?: unknown) {
    const response = await fetch(`${app.baseUrl}/api${path}`, {
      method,
      headers: {
        authorization: `Bearer ${await app.signToken({ subject: user })}`,
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    return { status: response.status, body: (await response.json().catch(() => null)) as unknown };
  }
  const stamp = (date: Date) =>
    date
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}/, '');
  function ics(input: {
    uid: string;
    sequence?: number;
    method?: string;
    summary: string;
    start: Date;
    organizer: string;
    attendees: string[];
  }) {
    const end = new Date(input.start.getTime() + 3_600_000);
    return [
      'BEGIN:VCALENDAR',
      `METHOD:${input.method ?? 'REQUEST'}`,
      'BEGIN:VEVENT',
      `UID:${input.uid}`,
      `SEQUENCE:${input.sequence ?? 0}`,
      `SUMMARY:${input.summary}`,
      `DTSTART:${stamp(input.start)}`,
      `DTEND:${stamp(end)}`,
      `ORGANIZER;CN=Organisator:mailto:${input.organizer}`,
      ...input.attendees.map(
        (email) => `ATTENDEE;CN=${email.split('@')[0]};PARTSTAT=NEEDS-ACTION:mailto:${email}`,
      ),
      `ATTENDEE:mailto:termine@kunde-${run}.reziproq.de`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
  }
  /** Eine Mail an die Eingangsadresse, wie sie der Maildienst per Webhook liefert */
  async function deliver(
    externalId: string,
    body: string,
    auth: { from?: string; spf?: string; dkim?: string } = {},
  ) {
    const payload = JSON.stringify({
      items: [
        {
          externalId,
          kind: 'calendar_invite',
          data: {
            from: auth.from ?? mail('anna'),
            spf: auth.spf ?? 'pass',
            dkim: auth.dkim ?? 'pass',
            ics: body,
          },
        },
      ],
    });
    const response = await fetch(`${app.baseUrl}${hook.path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        [signatureHeader]: signPayload(hook.secret, payload),
      },
      body: payload,
    });
    expect(response.status).toBe(202);
    await queue.drain();
  }
  const meetingsWith = async (uid: string) =>
    (
      await db.execute<{
        id: string;
        relationship_id: string;
        status: string;
        title: string;
        visibility: string;
        source: string;
        type: string;
        brief_opt_in: boolean;
        transcript_opt_in: boolean;
        insert_agenda: boolean;
        sequence: number;
      }>(sql`select * from meeting where ical_uid = ${uid} order by created_at`)
    ).rows;
  const itemsWith = async (uid: string) =>
    (
      await db.execute<{
        status: string;
        suggested_relationship_ids: string[];
        assignee_user_id: string | null;
      }>(
        sql`select status, suggested_relationship_ids, assignee_user_id from inbound_item where ical_uid = ${uid}`,
      )
    ).rows;
  const tomorrow = (hour: number) => {
    const date = new Date(Date.now() + 2 * 86_400_000);
    date.setUTCHours(hour, 0, 0, 0);
    return date;
  };

  beforeAll(async () => {
    app = await startTestApp();
    db = app.adminDb;
    integrations = app.app.get(IntegrationsService);
    queue = app.app.get(IntegrationQueue);
    intake = app.app.get(CalendarIntakeService);
    fake = app.app.get(FakeProvider);
    graph = app.app.get(FakeGraphClient);
    await db.insert(schema.organization).values([
      { id: orgs.a, name: `Kunde ${run}` },
      { id: orgs.rheintal, name: `IN03 Rheintal ${run}` },
      { id: orgs.silesia, name: `IN03 Silesia ${run}` },
      { id: orgs.neu, name: `IN03 Neu ${run}` },
    ]);
    await db
      .insert(schema.organizationFeature)
      .values({ organizationId: orgs.a, feature: 'buyer' });
    await db.insert(schema.appUser).values(
      (['admin', 'anna', 'bert', 'carla'] as const).map((key) => ({
        id: users[key],
        name: key,
        email: mail(key),
        organizationId: orgs.a,
        orgRole: key === 'admin' ? ('admin' as const) : ('member' as const),
        rolesImportedAt: new Date(),
      })),
    );
    await db.insert(schema.appUser).values({
      id: users.supplier,
      name: 'Lieferant',
      email: `kam@${domains.rheintal}`,
      organizationId: orgs.rheintal,
      orgRole: 'admin',
      rolesImportedAt: new Date(),
    });
    await insertRelationships(db, [
      { id: rel.rheintal, buyer: orgs.a, supplier: orgs.rheintal },
      { id: rel.silesia, buyer: orgs.a, supplier: orgs.silesia },
      { id: rel.neu, buyer: orgs.a, supplier: orgs.neu },
    ]);
    // Anna ist im Team aller Lieferanten, Carla SRO bei Rheintal, Bert in keinem Team
    await db.insert(schema.relationshipMember).values([
      { relationshipId: rel.rheintal, orgId: orgs.a, userId: users.anna, teamRole: 'member' },
      { relationshipId: rel.silesia, orgId: orgs.a, userId: users.anna, teamRole: 'member' },
      { relationshipId: rel.neu, orgId: orgs.a, userId: users.anna, teamRole: 'member' },
      { relationshipId: rel.rheintal, orgId: orgs.a, userId: users.carla, teamRole: 'sro' },
    ]);
    // Domains: Rheintal gepflegt, Silesia über einen Kontakt
    await db.insert(schema.supplierDomain).values({
      orgId: orgs.a,
      relationshipId: rel.rheintal,
      domain: domains.rheintal,
      source: 'manual',
    });
    await db.insert(schema.supplierContact).values({
      relationshipId: rel.silesia,
      name: 'Jan Kowalski',
      email: `jan@${domains.silesia}`,
    });
    // Eingangsadresse verbinden und eigene Domain zulassen
    const connected = integrationsSchema.parse(
      (await call(users.admin, 'POST', '/einstellungen/anbindungen/inbound_mail/verbinden', {}))
        .body,
    );
    const connection = connected.connectors.find(
      (entry) => entry.key === 'inbound_mail',
    )?.connection;
    if (!connection?.hookPath) throw new Error('keine Eingangsadresse');
    const saved = integrationsSchema.parse(
      (
        await call(
          users.admin,
          'PUT',
          `/einstellungen/anbindungen/${connection.id}/einstellungen`,
          {
            allowedDomains: [own],
          },
        )
      ).body,
    );
    expect(
      saved.connectors.find((entry) => entry.key === 'inbound_mail')?.connection,
    ).toMatchObject({
      inboundAddress: expect.stringMatching(/^termine@kunde-.*\.reziproq\.de$/),
      allowedDomains: [own],
    });
    const [secret] = (
      await db.execute<{ ciphertext: string; key_ref: string }>(sql`
        select s.ciphertext, s.key_ref from inbound_hook h join connection_secret s on s.id = h.secret_ref
        where h.connection_id = ${connection.id}`)
    ).rows;
    hook = {
      path: connection.hookPath,
      secret: integrations.box.open(secret?.ciphertext ?? '', secret?.key_ref ?? '') ?? '',
      connectionId: connection.id,
    };
  });

  afterAll(async () => {
    const ids = Object.values(rel);
    await db.execute(sql`delete from inbound_item where org_id = ${orgs.a}`);
    await db.execute(sql`delete from addin_registration where org_id = ${orgs.a}`);
    await db.execute(sql`delete from supplier_domain where org_id = ${orgs.a}`);
    await db.execute(sql`delete from meeting_attendee where org_id = ${orgs.a}`);
    await db.execute(sql`delete from audit_event where org_id = ${orgs.a}`).catch(() => undefined);
    await db.execute(
      sql`delete from meeting_agenda_item where meeting_id in (select id from meeting where relationship_id in ${ids})`,
    );
    await db.execute(
      sql`delete from meeting_participant where meeting_id in (select id from meeting where relationship_id in ${ids})`,
    );
    await db.execute(sql`delete from meeting where relationship_id in ${ids}`);
    await db.execute(sql`delete from supplier_contact where relationship_id in ${ids}`);
    await db.execute(sql`delete from relationship_member where relationship_id in ${ids}`);
    await db.execute(sql`delete from connection where org_id = ${orgs.a}`);
    await deleteRelationships(db, [orgs.a]);
    await db.execute(sql`delete from outbox_event where org_id = ${orgs.a}`);
    await db.execute(sql`delete from app_user where id in ${Object.values(users)}`);
    await db.execute(sql`delete from organization where id in ${Object.values(orgs)}`);
    await app.close();
  });

  it('eine Einladung an die Eingangsadresse mit Teilnehmern eines Lieferanten legt genau einen Termin und eine Aktivität an', async () => {
    const uid = `uid-eins-${run}`;
    const body = ics({
      uid,
      summary: 'QBR Rheintal Q4',
      start: tomorrow(9),
      organizer: mail('anna'),
      attendees: [`kam@${domains.rheintal}`, mail('carla')],
    });
    await deliver(`msg-eins-${run}`, body);
    await deliver(`msg-eins-${run}`, body);
    const rows = await meetingsWith(uid);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      relationship_id: rel.rheintal,
      visibility: 'internal',
      source: 'inbound_mail',
      type: 'quarterly_review',
      status: 'planned',
    });
    const feed = (await call(users.anna, 'GET', `/suppliers/${rel.rheintal}/aktivitaeten`))
      .body as {
      items: { kind: string; title: string; code: string | null }[];
    };
    expect(
      feed.items.filter((item) => item.kind === 'meeting' && item.title === 'QBR Rheintal Q4'),
    ).toEqual([expect.objectContaining({ code: 'inbound_mail' })]);
    const attendees = await db.execute<{ email: string; side: string }>(
      sql`select email, side from meeting_attendee where meeting_id = ${rows[0]?.id} order by email`,
    );
    expect(attendees.rows).toContainEqual({ email: `kam@${domains.rheintal}`, side: 'supplier' });
    expect(attendees.rows.some((row) => row.email.endsWith('reziproq.de'))).toBe(false);
  });

  it('eine zweite Einladung mit gleicher UID und höherer SEQUENCE aktualisiert den Termin; CANCEL setzt ihn auf abgesagt', async () => {
    const uid = `uid-update-${run}`;
    const base = { uid, organizer: mail('anna'), attendees: [`kam@${domains.rheintal}`] };
    await deliver(
      `msg-u1-${run}`,
      ics({ ...base, summary: 'Abstimmung Liefertermine', start: tomorrow(10) }),
    );
    await deliver(
      `msg-u2-${run}`,
      ics({ ...base, sequence: 1, summary: 'Abstimmung Liefertermine (neu)', start: tomorrow(11) }),
    );
    let [row] = await meetingsWith(uid);
    expect(row).toMatchObject({ title: 'Abstimmung Liefertermine (neu)', sequence: 1 });
    // Eine ältere SEQUENCE ändert nichts mehr
    await deliver(`msg-u3-${run}`, ics({ ...base, summary: 'Alt', start: tomorrow(10) }));
    [row] = await meetingsWith(uid);
    expect(row?.title).toBe('Abstimmung Liefertermine (neu)');
    await deliver(
      `msg-u4-${run}`,
      ics({ ...base, method: 'CANCEL', sequence: 2, summary: 'x', start: tomorrow(11) }),
    );
    expect((await meetingsWith(uid))[0]?.status).toBe('cancelled');
  });

  it('eine Mail von einer fremden Domain oder ohne gültiges DKIM wird abgelehnt und protokolliert', async () => {
    const uid = `uid-fremd-${run}`;
    const body = ics({
      uid,
      summary: 'Fremd',
      start: tomorrow(12),
      organizer: mail('anna'),
      attendees: [`kam@${domains.rheintal}`],
    });
    await deliver(`msg-f1-${run}`, body, { from: `boss@fremd-${run}.example` });
    await deliver(`msg-f2-${run}`, body, { dkim: 'fail' });
    expect(await meetingsWith(uid)).toEqual([]);
    expect(await itemsWith(uid)).toEqual([]);
    const events = await db.execute<{ external_id: string; status: string; reason: string }>(sql`
      select external_id, status, reason from sync_event
      where connection_id = ${hook.connectionId} and external_id in ${[`msg-f1-${run}`, `msg-f2-${run}`]}
      order by external_id`);
    expect(events.rows).toEqual([
      { external_id: `msg-f1-${run}`, status: 'rejected', reason: 'absender_nicht_zugelassen' },
      { external_id: `msg-f2-${run}`, status: 'rejected', reason: 'absender_nicht_geprueft' },
    ]);
  });

  it('ein Termin nur mit eigenen Teilnehmern wird nicht gespeichert', async () => {
    const uid = `uid-intern-${run}`;
    await deliver(
      `msg-i-${run}`,
      ics({
        uid,
        summary: 'Interne Runde',
        start: tomorrow(13),
        organizer: mail('anna'),
        attendees: [mail('carla')],
      }),
    );
    expect(await meetingsWith(uid)).toEqual([]);
    expect(await itemsWith(uid)).toEqual([]);
  });

  it('Teilnehmer von zwei Lieferanten führen zu needs_review mit beiden Vorschlägen', async () => {
    const uid = `uid-zwei-${run}`;
    await deliver(
      `msg-z-${run}`,
      ics({
        uid,
        summary: 'Lieferantenrunde Gehäuse',
        start: tomorrow(14),
        organizer: mail('anna'),
        attendees: [`kam@${domains.rheintal}`, `jan@${domains.silesia}`],
      }),
    );
    expect(await meetingsWith(uid)).toEqual([]);
    const [item] = await itemsWith(uid);
    expect(item?.status).toBe('needs_review');
    expect([...(item?.suggested_relationship_ids ?? [])].sort()).toEqual(
      [rel.rheintal, rel.silesia].sort(),
    );
    // Anna ordnet „Bei beiden“ zu: je Lieferant ein eigener interner Termin
    const inbox = inboxSchema.parse((await call(users.anna, 'GET', '/mein-tag/eingang')).body);
    const open = inbox.open.find((entry) => entry.subject === 'Lieferantenrunde Gehäuse');
    expect(open?.suggestionKind).toBe('several');
    const decided = await call(users.anna, 'POST', `/mein-tag/eingang/${open?.id}/entscheiden`, {
      action: 'assign',
      relationshipIds: [rel.rheintal, rel.silesia],
      type: 'other',
    });
    expect(decided.status).toBe(200);
    const meetings = await meetingsWith(uid);
    expect(meetings.map((row) => row.relationship_id).sort()).toEqual(
      [rel.rheintal, rel.silesia].sort(),
    );
    expect(meetings.every((row) => row.visibility === 'internal')).toBe(true);
  });

  it('eine Registrierung aus dem Add-in wird mit der eingehenden Einladung verknüpft; Termintyp und Schalter gelten', async () => {
    const start = tomorrow(15);
    const detect = await call(users.anna, 'POST', '/termine/addin/erkennen', {
      attendees: [`kam@${domains.rheintal}`, mail('carla')],
      subject: 'Preisrunde 2027',
    });
    expect(detect.body).toMatchObject({ supplier: { relationshipId: rel.rheintal } });
    const registered = await call(users.anna, 'POST', '/termine/addin', {
      organizerEmail: mail('anna'),
      subject: 'Preisrunde 2027',
      startAt: start.toISOString(),
      relationshipId: rel.rheintal,
      type: 'negotiation',
      briefOptIn: false,
      transcriptOptIn: true,
      insertAgenda: true,
      eventId: `evt-${run}`,
    });
    expect(registered.status).toBe(201);
    expect(registered.body).toMatchObject({
      inboundAddress: expect.stringMatching(/reziproq\.de$/),
      transcriptNotice: expect.stringContaining('Transkript'),
    });
    const uid = `uid-addin-${run}`;
    await deliver(
      `msg-a-${run}`,
      ics({
        uid,
        summary: 'AW: Preisrunde 2027',
        start,
        organizer: mail('anna'),
        attendees: [`kam@${domains.rheintal}`],
      }),
    );
    const [meeting] = await meetingsWith(uid);
    expect(meeting).toMatchObject({
      source: 'outlook_addin',
      type: 'negotiation',
      brief_opt_in: false,
      transcript_opt_in: true,
      insert_agenda: true,
    });
    const registration = await db.execute<{ matched_meeting_id: string }>(
      sql`select matched_meeting_id from addin_registration where event_id = ${`evt-${run}`}`,
    );
    expect(registration.rows[0]?.matched_meeting_id).toBe(meeting?.id);
  });

  it('„Agenda einfügen“ ändert nur den markierten Block der Beschreibung (Anbieter fake für Graph)', async () => {
    const before = `Hallo zusammen,<br>bitte vorab lesen.\n${agendaStart}<p>alte Agenda</p>${agendaEnd}\nViele Grüße`;
    const after = replaceAgendaBlock(
      before,
      [{ title: '10:00 Lieferplan', detail: '20 Min. · Anna' }],
      'Agenda',
    );
    expect(after.startsWith('Hallo zusammen,<br>bitte vorab lesen.\n')).toBe(true);
    expect(after.endsWith('\nViele Grüße')).toBe(true);
    expect(after).toContain('10:00 Lieferplan – 20 Min. · Anna');
    expect(after).not.toContain('alte Agenda');
    // Über den Dienst: mit Annas eigener Verbindung zu Microsoft 365
    expect(
      (await call(users.anna, 'POST', '/profil/verbindungen/microsoft365/verbinden')).status,
    ).toBe(200);
    graph.events.set(`evt-${run}`, before);
    const [meeting] = await meetingsWith(`uid-addin-${run}`);
    const pushed = await intake.pushAgenda({
      orgId: orgs.a,
      meetingId: meeting?.id ?? '',
      items: [{ title: '10:00 Lieferplan', detail: '20 Min. · Anna' }],
    });
    expect(pushed).toBe(true);
    const body = graph.events.get(`evt-${run}`) ?? '';
    expect(body.slice(0, body.indexOf(agendaStart))).toBe(
      before.slice(0, before.indexOf(agendaStart)),
    );
    expect(body.slice(body.indexOf(agendaEnd))).toBe(before.slice(before.indexOf(agendaEnd)));
    expect(body).toContain('Lieferplan');
  });

  it('ein Termin aus dem Kalenderabgleich landet immer in „Neu eingegangen“, nie automatisch', async () => {
    const mine = await call(users.anna, 'GET', '/profil/verbindungen');
    const connectionId =
      (mine.body as { connections: { connection: { id: string } }[] }).connections[0]?.connection
        .id ?? '';
    const uid = `uid-kalender-${run}`;
    fake.nextItems = [
      {
        externalId: `kal-${run}`,
        kind: 'calendar_event',
        relationshipId: null,
        text: '',
        data: {
          uid,
          subject: 'Werksbesuch Rheintal',
          startsAt: tomorrow(16).toISOString(),
          attendees: [{ email: `kam@${domains.rheintal}`, name: null, response: null }],
        },
      },
      {
        externalId: `kal-privat-${run}`,
        kind: 'calendar_event',
        relationshipId: null,
        text: '',
        data: {
          uid: `uid-privat-${run}`,
          subject: 'Zahnarzt',
          startsAt: tomorrow(17).toISOString(),
          attendees: [],
        },
      },
    ];
    const jobId = await withTenant(
      db,
      { userId: users.anna, organizationId: orgs.a },
      async (tx) => {
        const [job] = await tx
          .insert(schema.syncJob)
          .values({ orgId: orgs.a, connectionId, kind: 'sync' })
          .returning({ id: schema.syncJob.id });
        return job?.id ?? '';
      },
    );
    await integrations.runJob({ orgId: orgs.a, jobId });
    expect(await meetingsWith(uid)).toEqual([]);
    expect(await itemsWith(uid)).toMatchObject([
      { status: 'needs_review', suggested_relationship_ids: [rel.rheintal] },
    ]);
    // Ohne Lieferant: weder Termin noch Betreff gespeichert
    const privat = await db.execute(sql`select 1 from inbound_item where subject = 'Zahnarzt'`);
    expect(privat.rows).toEqual([]);
  });

  it('eine Entscheidung in „Neu eingegangen“ legt eine gelernte Domain an; der nächste Termin mit dieser Domain wird automatisch zugeordnet', async () => {
    const domain = `neu-gmbh-${run}.example`;
    const first = `uid-lernen-1-${run}`;
    await deliver(
      `msg-l1-${run}`,
      ics({
        uid: first,
        summary: 'Kennenlernen',
        start: tomorrow(8),
        organizer: mail('anna'),
        attendees: [`info@${domain}`],
      }),
    );
    const inbox = inboxSchema.parse((await call(users.anna, 'GET', '/mein-tag/eingang')).body);
    const open = inbox.open.find((entry) => entry.subject === 'Kennenlernen');
    expect(open).toMatchObject({ suggestionKind: 'none', suggestions: [] });
    await call(users.anna, 'POST', `/mein-tag/eingang/${open?.id}/entscheiden`, {
      action: 'assign',
      relationshipIds: [rel.neu],
      type: 'other',
    });
    const learned = await db.execute<{ source: string }>(
      sql`select source from supplier_domain where relationship_id = ${rel.neu} and domain = ${domain}`,
    );
    expect(learned.rows).toEqual([{ source: 'learned' }]);
    const second = `uid-lernen-2-${run}`;
    await deliver(
      `msg-l2-${run}`,
      ics({
        uid: second,
        summary: 'Folgetermin',
        start: tomorrow(9),
        organizer: mail('anna'),
        attendees: [`info@${domain}`],
      }),
    );
    expect(await meetingsWith(second)).toMatchObject([{ relationship_id: rel.neu }]);
    expect(await itemsWith(second)).toMatchObject([{ status: 'auto_assigned' }]);
  });

  it('eine Person ohne Zugriff auf einen Lieferanten kann keinen Termin bei ihm anlegen, auch nicht über die Eingangsadresse; der Eingang landet beim SRO', async () => {
    // Über das Add-in: abgelehnt
    const direct = await call(users.bert, 'POST', '/termine/addin', {
      organizerEmail: mail('bert'),
      subject: 'Ohne Zugriff',
      startAt: tomorrow(7).toISOString(),
      relationshipId: rel.rheintal,
      type: 'other',
    });
    expect(direct.status).toBe(403);
    const uid = `uid-ohne-${run}`;
    await deliver(
      `msg-o-${run}`,
      ics({
        uid,
        summary: 'Ohne Zugriff',
        start: tomorrow(7),
        organizer: mail('bert'),
        attendees: [`kam@${domains.rheintal}`],
      }),
      { from: mail('bert') },
    );
    expect(await meetingsWith(uid)).toEqual([]);
    expect(await itemsWith(uid)).toMatchObject([
      { status: 'needs_review', assignee_user_id: users.carla },
    ]);
    const carla = inboxSchema.parse((await call(users.carla, 'GET', '/mein-tag/eingang')).body);
    const open = carla.open.find((entry) => entry.subject === 'Ohne Zugriff');
    expect(open).toBeDefined();
    // Bert selbst kann es auch über „Neu eingegangen“ nicht anlegen
    const tried = await call(users.bert, 'POST', `/mein-tag/eingang/${open?.id}/entscheiden`, {
      action: 'assign',
      relationshipIds: [rel.rheintal],
      type: 'other',
    });
    expect(tried.status).toBe(403);
    const done = await call(users.carla, 'POST', `/mein-tag/eingang/${open?.id}/entscheiden`, {
      action: 'assign',
      relationshipIds: [rel.rheintal],
      type: 'other',
    });
    expect(done.status).toBe(200);
    expect(await meetingsWith(uid)).toHaveLength(1);
  });

  it('der Test-Lieferant sieht weder Termine noch Eingänge noch Aktivitäten', async () => {
    expect((await call(users.supplier, 'GET', '/mein-tag/eingang')).status).toBe(403);
    expect(
      (await call(users.supplier, 'POST', '/termine/addin/erkennen', { attendees: [] })).status,
    ).toBe(403);
    const seen = await withTenant(
      db,
      { userId: users.supplier, organizationId: orgs.rheintal, customerOrganizationId: orgs.a },
      async (tx) => ({
        meetings: await tx
          .select()
          .from(schema.meeting)
          .where(sql`${schema.meeting.icalUid} is not null`),
        attendees: await tx.select().from(schema.meetingAttendee),
        items: await tx.select().from(schema.inboundItem),
        domains: await tx.select().from(schema.supplierDomain),
        registrations: await tx.select().from(schema.addinRegistration),
      }),
    );
    expect(seen).toEqual({
      meetings: [],
      attendees: [],
      items: [],
      domains: [],
      registrations: [],
    });
    const meetings = await call(users.supplier, 'GET', `/kunden/${rel.rheintal}/termine`);
    expect(JSON.stringify(meetings.body ?? '')).not.toContain('QBR Rheintal Q4');
  });

  it('liest Einladungen aus Outlook mit Zeitzone und Faltung', () => {
    const text = [
      'BEGIN:VCALENDAR',
      'METHOD:REQUEST',
      'BEGIN:VEVENT',
      'UID:abc',
      'SUMMARY:Lange Zeile, die',
      ' umbricht',
      'DTSTART;TZID=W. Europe Standard Time:20270115T100000',
      'ORGANIZER;CN="Anna, Einkauf":mailto:Anna@OEM.example',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
    const [event] = parseIcs(text).events;
    expect(event?.summary).toBe('Lange Zeile, dieumbricht');
    expect(event?.startsAt.toISOString()).toBe('2027-01-15T09:00:00.000Z');
    expect(event?.organizer).toEqual({
      email: 'anna@oem.example',
      name: 'Anna, Einkauf',
      response: null,
    });
  });
});
