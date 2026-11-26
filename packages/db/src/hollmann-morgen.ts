import { workers } from '@reziproq/shared';
import {
  action,
  agent,
  agentRun,
  agentVersion,
  aiDraft,
  aiSource,
  comment,
  commentMention,
  filedMail,
  inboundItem,
  jbp,
  meeting,
  meetingCapture,
  meetingParticipant,
  scorecard,
  scorecardKpi,
} from './schema/index.js';
import type { TenantTransaction } from './tenant.js';

// DM-01, Drehbuch K1 „Morgen mit Reziproq“ (K1-g.3): der Stand am Mo 23.11., 07:30 für Jan-Luka.
// - Fokus (3): Erwähnung von Nils Ott am JBP, Scorecard Nordwerk unterschreiben (morgen fällig),
//   Maßnahme „Kapazitätsplan 2028 mit Rheintal abstimmen“ (heute fällig).
// - Erledigt seit gestern 18:00 (14): zwölf Mails, die das Postfach selbst abgelegt hat (mit
//   Zurücknehmen), der QBR Nordwerk aus einer Einladung und das vorbereitete Briefing zum JBP.
// - Kurz prüfen (4): die Ziele des Briefings, zwei Punkte aus dem Rheintal-Termin vom 20.11. und die
//   Zusage von Alpen Kunststoff aus dem Termin vom 19.11. Nimmt Jan-Luka die Mail von Nils Ott
//   zurück (Schritt 3), steht sie als fünfter Eintrag dabei; so ergibt Schritt 4 „4 von 5“ (DM-01).
// Die Texte stehen hier, wie sie die Bildvorlagen zeigen (keine Modellantwort). Wertpotenzial,
// Wirkung freigeben und Zusagen kommen mit K2 und K4 (Entscheidung des Gründers, 26.11.2026).

export interface MorningRefs {
  nid: (n: number) => string;
  orgId: string;
  janLuka: { id: string; name: string };
  /** Organisation, Beziehung und Name eines Lieferanten von Hollmann */
  supplier: (key: string) => { orgId: string; relationshipId: string; name: string };
  rheintalPeople: Record<
    'nilsOtt' | 'tomWeber' | 'leaBrandt' | 'miaKuhn',
    { id: string; name: string; email: string }
  >;
  jbpMeetingId: string;
}

/** Zeitpunkt in Berlin (Winterzeit, UTC+1) */
const berlin = (date: string, time: string) => new Date(`${date}T${time}:00+01:00`);

/** Werkzeuge einer Aufgabe wie in der Registry (MA-01), für Warum und Rechte */
const toolsOf = (key: string) =>
  (workers.find((worker) => worker.key === key)?.tools ?? []).map((tool) => tool.key);

export async function seedMorning(tx: TenantTransaction, refs: MorningRefs) {
  const { nid, orgId, janLuka } = refs;
  const rheintal = refs.supplier('rheintal');
  const alpen = refs.supplier('alpenKunststoff');
  const nordwerk = refs.supplier('nordwerk');

  // ——— Termine: zwei vergangene mit Notizen, der QBR Nordwerk aus einer Einladung
  const pastRheintal = nid(600);
  const pastAlpen = nid(601);
  const qbrNordwerk = nid(602);
  await tx.insert(meeting).values([
    {
      id: pastRheintal,
      relationshipId: rheintal.relationshipId,
      ownerOrgId: orgId,
      visibility: 'shared',
      type: 'other',
      title: 'Abstimmung Liefertreue',
      startsAt: berlin('2026-11-20', '10:00'),
      durationMinutes: 60,
      status: 'planned',
      createdBy: janLuka.id,
      createdByName: janLuka.name,
      createdAt: berlin('2026-11-16', '09:00'),
    },
    {
      id: pastAlpen,
      relationshipId: alpen.relationshipId,
      ownerOrgId: orgId,
      visibility: 'shared',
      type: 'other',
      title: 'Monatsgespräch Alpen Kunststoff',
      startsAt: berlin('2026-11-19', '14:00'),
      durationMinutes: 45,
      status: 'planned',
      createdBy: janLuka.id,
      createdByName: janLuka.name,
      createdAt: berlin('2026-11-12', '09:00'),
    },
    {
      id: qbrNordwerk,
      relationshipId: nordwerk.relationshipId,
      ownerOrgId: orgId,
      visibility: 'shared',
      type: 'quarterly_review',
      title: 'QBR Nordwerk',
      startsAt: berlin('2026-12-02', '10:00'),
      durationMinutes: 90,
      status: 'planned',
      createdBy: janLuka.id,
      createdByName: janLuka.name,
      createdAt: berlin('2026-11-23', '06:58'),
    },
  ]);

  // Teilnehmer der vergangenen Termine: Verantwortlich für einen Punkt ist nur, wer dabei war
  const participant = (
    id: number,
    meetingId: string,
    relationshipId: string,
    ownerOrgId: string,
    name: string,
    position: number,
  ) => ({
    id: nid(id),
    meetingId,
    relationshipId,
    ownerOrgId,
    visibility: 'shared' as const,
    name,
    position,
  });
  await tx
    .insert(meetingParticipant)
    .values([
      participant(605, pastRheintal, rheintal.relationshipId, orgId, janLuka.name, 1),
      participant(
        606,
        pastRheintal,
        rheintal.relationshipId,
        rheintal.orgId,
        refs.rheintalPeople.nilsOtt.name,
        2,
      ),
      participant(
        607,
        pastRheintal,
        rheintal.relationshipId,
        rheintal.orgId,
        refs.rheintalPeople.tomWeber.name,
        3,
      ),
      participant(608, pastAlpen, alpen.relationshipId, orgId, janLuka.name, 1),
      participant(609, pastAlpen, alpen.relationshipId, alpen.orgId, 'Lukas Gruber', 2),
    ]);

  // ——— Fokus 1: Nils Ott erwähnt Jan-Luka am JBP, seit fünf Tagen ungelesen
  const mention = nid(620);
  await tx.insert(comment).values({
    id: mention,
    relationshipId: rheintal.relationshipId,
    ownerOrgId: rheintal.orgId,
    visibility: 'shared',
    objectType: 'meeting',
    objectId: refs.jbpMeetingId,
    authorId: refs.rheintalPeople.nilsOtt.id,
    authorName: refs.rheintalPeople.nilsOtt.name,
    body: `@${janLuka.name} Können wir die Kapazitätsplanung 2028 im JBP vorziehen? Der 8D-Bericht zur Charge 4711 folgt bis Freitag.`,
    mentions: [janLuka.id],
    createdAt: berlin('2026-11-18', '16:20'),
  });
  await tx.insert(commentMention).values({
    id: nid(621),
    commentId: mention,
    relationshipId: rheintal.relationshipId,
    orgId,
    userId: janLuka.id,
    createdAt: berlin('2026-11-18', '16:20'),
  });

  // ——— Fokus 2: Scorecard Nordwerk 2027 als Entwurf, ohne Unterschrift; fällig 14 Tage nach Anlage
  const plan = nid(622);
  const card = nid(623);
  await tx.insert(jbp).values({
    id: plan,
    relationshipId: nordwerk.relationshipId,
    ownerOrgId: orgId,
    visibility: 'shared',
    status: 'draft',
    createdBy: janLuka.id,
    createdByName: janLuka.name,
    createdAt: berlin('2026-11-10', '09:00'),
  });
  await tx.insert(scorecard).values({
    id: card,
    relationshipId: nordwerk.relationshipId,
    ownerOrgId: orgId,
    visibility: 'shared',
    jbpId: plan,
    status: 'draft',
    createdAt: berlin('2026-11-10', '09:00'),
  });
  await tx.insert(scorecardKpi).values({
    id: nid(624),
    relationshipId: nordwerk.relationshipId,
    ownerOrgId: orgId,
    visibility: 'shared',
    scorecardId: card,
    name: 'Liefertreue',
    unit: '%',
    direction: 'higher',
    baseline: '91',
    target: '96',
    targetDate: '2027-12-31',
    ownerSide: 'supplier',
    ownerName: nordwerk.name,
    benefitFor: 'both',
  });

  // ——— Fokus 3: eigene Maßnahme, heute fällig
  await tx.insert(action).values({
    id: nid(625),
    relationshipId: rheintal.relationshipId,
    ownerOrgId: orgId,
    visibility: 'internal',
    title: 'Kapazitätsplan 2028 mit Rheintal abstimmen',
    ownerSide: 'buyer',
    ownerUserId: janLuka.id,
    ownerName: janLuka.name,
    dueDate: '2026-11-23',
    sourceType: 'manual',
    createdBy: janLuka.id,
    createdByName: janLuka.name,
    createdAt: berlin('2026-11-17', '11:00'),
  });

  // ——— Aufgaben von Reziproq als Systemagenten (wie workerVersion in der API)
  const versions = { inbox: nid(631), meeting_brief: nid(633) } as const;
  await tx.insert(agent).values([
    {
      id: nid(630),
      orgId,
      key: 'inbox',
      name: 'Postfach',
      description: 'Ordnet Termine und Mails den Beziehungen zu.',
      kind: 'system',
      status: 'active',
    },
    {
      id: nid(632),
      orgId,
      key: 'meeting_brief',
      name: 'Termin-Briefing',
      description: 'Bereitet wichtige Termine vor.',
      kind: 'system',
      status: 'active',
    },
  ]);
  await tx.insert(agentVersion).values(
    (['inbox', 'meeting_brief'] as const).map((key) => ({
      id: versions[key],
      orgId,
      agentId: key === 'inbox' ? nid(630) : nid(632),
      version: 1,
      instructions: key === 'inbox' ? 'Ordnet Termine und Mails zu.' : 'Bereitet Termine vor.',
      tools: toolsOf(key),
      trigger: 'event' as const,
      eventKey: key,
      outputTarget: 'erledigt' as const,
      reviewerRule: 'none' as const,
      modelClass: 'small' as const,
      budgetCents: 1,
      maxSteps: 1,
    })),
  );

  // ——— Erledigt: zwölf Mails der Nacht, vom Postfach selbst abgelegt, mit Zurücknehmen
  const people = refs.rheintalPeople;
  const mails: { key: string; from: { name: string; email: string }; subject: string; at: Date }[] =
    [
      { key: 'rheintal', from: people.nilsOtt, subject: '', at: berlin('2026-11-23', '07:22') },
      {
        key: 'rheintal',
        from: people.tomWeber,
        subject: 'Kapazitätsplanung 2028',
        at: berlin('2026-11-23', '07:12'),
      },
      {
        key: 'rheintal',
        from: people.leaBrandt,
        subject: 'Musterteile Starrflex: Zeichnung Rev. C',
        at: berlin('2026-11-23', '06:48'),
      },
      {
        key: 'rheintal',
        from: people.miaKuhn,
        subject: 'Lieferavis KW 48',
        at: berlin('2026-11-23', '06:31'),
      },
      {
        key: 'silesia',
        from: { name: 'Marek Nowak', email: 'marek.nowak@silesia.example' },
        subject: 'Lieferplan Dezember',
        at: berlin('2026-11-23', '06:15'),
      },
      {
        key: 'silesia',
        from: { name: 'Marek Nowak', email: 'marek.nowak@silesia.example' },
        subject: 'Reklamation Charge 2231',
        at: berlin('2026-11-23', '05:58'),
      },
      {
        key: 'kessler',
        from: { name: 'Anja Kessler', email: 'anja.kessler@kessler.example' },
        subject: 'Zertifikat ISO 9001 erneuert',
        at: berlin('2026-11-23', '05:40'),
      },
      {
        key: 'kessler',
        from: { name: 'Anja Kessler', email: 'anja.kessler@kessler.example' },
        subject: 'Preisblatt 2027',
        at: berlin('2026-11-22', '23:05'),
      },
      {
        key: 'nordwerk',
        from: { name: 'Jens Brinkmann', email: 'jens.brinkmann@nordwerk.example' },
        subject: 'Bestätigung QBR-Termin',
        at: berlin('2026-11-22', '22:40'),
      },
      {
        key: 'nordwerk',
        from: { name: 'Jens Brinkmann', email: 'jens.brinkmann@nordwerk.example' },
        subject: 'Gussteile: Prüfbericht Oktober',
        at: berlin('2026-11-22', '21:15'),
      },
      {
        key: 'moravia',
        from: { name: 'Petra Dvořák', email: 'petra.dvorak@moravia.example' },
        subject: 'Werkzeugänderung Gehäuse',
        at: berlin('2026-11-22', '20:02'),
      },
      {
        key: 'alpenKunststoff',
        from: { name: 'Lukas Gruber', email: 'lukas.gruber@alpen-kunststoff.example' },
        subject: 'Transparenz: Kostenaufschlüsselung',
        at: berlin('2026-11-22', '18:45'),
      },
    ];
  for (const [index, entry] of mails.entries()) {
    const target = refs.supplier(entry.key);
    const mailId = nid(640 + index);
    const inboundId = nid(660 + index);
    const subject = entry.subject || '–';
    await tx.insert(filedMail).values({
      id: mailId,
      orgId,
      relationshipId: target.relationshipId,
      filedBy: janLuka.id,
      visibility: 'team',
      messageId: `<hollmann-${640 + index}@${entry.from.email.split('@')[1]}>`,
      fromEmail: entry.from.email,
      fromName: entry.from.name,
      toEmails: ['jan-luka@hollmann.example'],
      sentAt: new Date(entry.at.getTime() - 4 * 60_000),
      subject,
      bodyText: `${entry.subject || 'Kurze Rückfrage'} – siehe Anhang, Gruß ${entry.from.name}`,
      source: 'forward',
      createdAt: entry.at,
    });
    await tx.insert(inboundItem).values({
      id: inboundId,
      orgId,
      kind: 'mail',
      source: 'inbound_mail',
      fromEmail: entry.from.email,
      subject,
      details: {
        method: 'REQUEST',
        startsAt: entry.at.toISOString(),
        endsAt: null,
        location: null,
        onlineMeetingUrl: null,
        organizerEmail: entry.from.email,
        organizerName: null,
        attendees: [],
      },
      suggestedRelationshipIds: [target.relationshipId],
      suggestionKind: 'supplier',
      suggestionReason: `${target.name}: ${entry.from.email.split('@')[1]}.`,
      suggestedType: 'other',
      status: 'auto_assigned',
      ownerUserId: janLuka.id,
      assigneeUserId: janLuka.id,
      assignedAt: entry.at,
      objectType: 'filed_mail',
      objectIds: [mailId],
      receivedAt: entry.at,
    });
    await tx.insert(agentRun).values({
      id: nid(680 + index),
      orgId,
      agentVersionId: versions.inbox,
      actingUserId: janLuka.id,
      startedBy: 'system:inbox',
      trigger: 'event',
      contextRelationshipId: target.relationshipId,
      contextType: 'inbound_item',
      contextId: inboundId,
      status: 'done',
      startedAt: entry.at,
      finishedAt: entry.at,
      createdAt: entry.at,
      undoPayload: {
        kind: 'mail_assign',
        inboundItemId: inboundId,
        mailId,
        subject,
        sender: entry.from.name,
        relationshipId: target.relationshipId,
      },
    });
  }

  // ——— Erledigt: der QBR Nordwerk aus der Einladung an die Eingangsadresse
  const qbrInbound = nid(672);
  const qbrAt = berlin('2026-11-23', '06:58');
  await tx.insert(inboundItem).values({
    id: qbrInbound,
    orgId,
    kind: 'meeting',
    source: 'inbound_mail',
    fromEmail: 'jens.brinkmann@nordwerk.example',
    subject: 'QBR Nordwerk',
    icalUid: 'qbr-nordwerk-2026@nordwerk.example',
    sequence: 0,
    details: {
      method: 'REQUEST',
      startsAt: berlin('2026-12-02', '10:00').toISOString(),
      endsAt: berlin('2026-12-02', '11:30').toISOString(),
      location: 'Nordwerk Guss, Bremen',
      onlineMeetingUrl: null,
      organizerEmail: 'jens.brinkmann@nordwerk.example',
      organizerName: 'Jens Brinkmann',
      attendees: [],
    },
    suggestedRelationshipIds: [nordwerk.relationshipId],
    suggestionKind: 'supplier',
    suggestionReason: `${nordwerk.name}: nordwerk.example.`,
    suggestedType: 'quarterly_review',
    status: 'auto_assigned',
    ownerUserId: janLuka.id,
    assigneeUserId: janLuka.id,
    assignedAt: qbrAt,
    objectType: 'meeting',
    objectIds: [qbrNordwerk],
    receivedAt: qbrAt,
  });
  await tx.insert(agentRun).values({
    id: nid(692),
    orgId,
    agentVersionId: versions.inbox,
    actingUserId: janLuka.id,
    startedBy: 'system:inbox',
    trigger: 'event',
    contextRelationshipId: nordwerk.relationshipId,
    contextType: 'inbound_item',
    contextId: qbrInbound,
    status: 'done',
    startedAt: qbrAt,
    finishedAt: qbrAt,
    createdAt: qbrAt,
    undoPayload: {
      kind: 'inbound_assign',
      inboundItemId: qbrInbound,
      subject: 'QBR Nordwerk',
      relationshipId: nordwerk.relationshipId,
      meetings: [
        {
          id: qbrNordwerk,
          snapshot: {
            title: 'QBR Nordwerk',
            startsAt: berlin('2026-12-02', '10:00').toISOString(),
            durationMinutes: 90,
            location: null,
            status: 'planned',
            type: 'quarterly_review',
            visibility: 'shared',
            participants: 0,
            agendaItems: 0,
          },
        },
      ],
    },
  });

  // ——— Erledigt und Kurz prüfen: das Briefing zum JBP, vorbereitet um 06:10
  const briefRun = nid(693);
  const briefAt = berlin('2026-11-23', '06:10');
  await tx.insert(agentRun).values({
    id: briefRun,
    orgId,
    agentVersionId: versions.meeting_brief,
    actingUserId: janLuka.id,
    startedBy: 'system:meeting_brief',
    trigger: 'schedule',
    contextRelationshipId: rheintal.relationshipId,
    contextType: 'meeting',
    contextId: refs.jbpMeetingId,
    status: 'done',
    startedAt: berlin('2026-11-23', '06:02'),
    finishedAt: briefAt,
    createdAt: berlin('2026-11-23', '06:02'),
  });

  // ——— Notizen der beiden vergangenen Termine
  const captureRheintal = nid(603);
  const captureAlpen = nid(604);
  const notesRheintal =
    'Rheintal meldet für Oktober 94 % Liefertreue. Prognose ab Januar monatlich an Rheintal teilen.';
  const notesAlpen =
    'Alpen Kunststoff sagt zu, die Kostenaufschlüsselung bis 11.12. vorzulegen, damit die Lücke bei der Transparenz geschlossen ist.';
  await tx.insert(meetingCapture).values([
    {
      id: captureRheintal,
      orgId,
      relationshipId: rheintal.relationshipId,
      meetingId: pastRheintal,
      source: 'typed',
      text: notesRheintal,
      createdBy: janLuka.id,
      createdByName: janLuka.name,
      createdAt: berlin('2026-11-20', '11:10'),
    },
    {
      id: captureAlpen,
      orgId,
      relationshipId: alpen.relationshipId,
      meetingId: pastAlpen,
      source: 'typed',
      text: notesAlpen,
      createdBy: janLuka.id,
      createdByName: janLuka.name,
      createdAt: berlin('2026-11-19', '15:00'),
    },
  ]);

  // ——— Kurz prüfen: vier Entwürfe, die Jan-Luka als SRO entscheidet
  const capture = (
    item: {
      kind: 'action' | 'decision' | 'question' | 'commitment';
      title: string;
      quote: string;
      visibility: 'shared' | 'internal';
    } & Partial<{
      side: 'buyer' | 'supplier';
      owner: string;
      dueOn: string;
      addressee: string;
    }>,
  ) => ({
    kind: item.kind,
    title: item.title,
    visibility: item.visibility,
    quote: item.quote,
    side: item.side ?? null,
    owner: item.owner ?? null,
    ownerUnclear: false,
    dueOn: item.dueOn ?? null,
    dateUnclear: false,
    addressee: item.addressee ?? null,
    commitmentId: null,
    commitmentTitle: null,
    proposal: null,
    goalKey: null,
    goalStatus: null,
    reason: null,
    createdId: null,
  });
  const drafts = [
    {
      id: nid(610),
      relationshipId: rheintal.relationshipId,
      kind: 'brief_goals' as const,
      objectId: refs.jbpMeetingId,
      // Wie im Termin-Briefing: ohne Betreff, der Titel ist die Aussage
      subject: null,
      runId: briefRun,
      createdAt: briefAt,
      content: {
        goals: [
          {
            key: 'g1',
            title: 'Prognosetreue 2027 vereinbaren',
            reachedWhen: 'Rheintal sagt 85 % Prognosetreue ab Januar zu.',
            ref: { objectType: 'meeting', objectId: refs.jbpMeetingId, title: 'JBP Rheintal 2027' },
          },
          {
            key: 'g2',
            title: 'Kapazität 2028 klären',
            reachedWhen: 'Tom Weber legt die Kapazitätsplanung 2028 vor.',
            ref: { objectType: 'meeting', objectId: refs.jbpMeetingId, title: 'JBP Rheintal 2027' },
          },
          {
            key: 'g3',
            title: 'Musterteile Starrflex terminieren',
            reachedWhen: 'Termin für die Musterteile steht vor dem 11.12.',
            ref: { objectType: 'meeting', objectId: refs.jbpMeetingId, title: 'JBP Rheintal 2027' },
          },
        ],
      },
      claim: 'Briefing JBP: 3 Ziele',
      // Wie im Termin-Briefing: Beleg der Ziele ist der Termin selbst. Ohne Quelle gibt es keinen
      // Entwurf (KI-03), und Übernehmen scheitert an der Ansicht des Briefings.
      source: {
        objectType: 'meeting',
        objectId: refs.jbpMeetingId,
        meetingId: refs.jbpMeetingId,
        title: 'JBP Rheintal 2027',
      },
    },
    {
      id: nid(611),
      relationshipId: rheintal.relationshipId,
      kind: 'capture_action' as const,
      objectId: pastRheintal,
      subject: 'action',
      runId: null,
      createdAt: berlin('2026-11-20', '11:12'),
      content: capture({
        kind: 'action',
        title: 'Liefertreue Oktober: 94 % übernehmen',
        quote: 'Rheintal meldet für Oktober 94 % Liefertreue.',
        visibility: 'shared',
        owner: janLuka.name,
        dueOn: '2026-11-27',
      }),
      claim: 'Liefertreue Oktober: 94 % übernehmen',
      source: {
        objectType: 'meeting_capture',
        objectId: captureRheintal,
        meetingId: pastRheintal,
        title: 'Notizen vom 20.11.',
      },
    },
    {
      id: nid(612),
      relationshipId: rheintal.relationshipId,
      kind: 'capture_decision' as const,
      objectId: pastRheintal,
      subject: 'decision',
      runId: null,
      createdAt: berlin('2026-11-20', '11:12'),
      content: capture({
        kind: 'decision',
        title: 'Prognose ab Januar monatlich an Rheintal teilen',
        quote: 'Prognose ab Januar monatlich an Rheintal teilen.',
        visibility: 'internal',
      }),
      claim: 'Prognose ab Januar monatlich an Rheintal teilen',
      source: {
        objectType: 'meeting_capture',
        objectId: captureRheintal,
        meetingId: pastRheintal,
        title: 'Notizen vom 20.11.',
      },
    },
    {
      id: nid(614),
      relationshipId: alpen.relationshipId,
      kind: 'capture_commitment' as const,
      objectId: pastAlpen,
      subject: 'commitment',
      runId: null,
      createdAt: berlin('2026-11-19', '15:02'),
      content: capture({
        kind: 'commitment',
        title: 'Zusage zur Lücke Transparenz: Kostenaufschlüsselung bis 11.12.',
        quote:
          'Alpen Kunststoff sagt zu, die Kostenaufschlüsselung bis 11.12. vorzulegen, damit die Lücke bei der Transparenz geschlossen ist.',
        visibility: 'shared',
        side: 'supplier',
        owner: 'Lukas Gruber',
        dueOn: '2026-12-11',
      }),
      claim: 'Zusage zur Lücke Transparenz: Kostenaufschlüsselung bis 11.12.',
      source: {
        objectType: 'meeting_capture',
        objectId: captureAlpen,
        meetingId: pastAlpen,
        title: 'Notizen vom 19.11.',
      },
    },
  ];
  for (const [index, draft] of drafts.entries()) {
    await tx.insert(aiDraft).values({
      id: draft.id,
      orgId,
      relationshipId: draft.relationshipId,
      kind: draft.kind,
      objectType: 'meeting',
      objectId: draft.objectId,
      subject: draft.subject,
      content: JSON.stringify(draft.content),
      claims: [{ key: '1', text: draft.claim }],
      runId: draft.runId,
      model: draft.kind === 'brief_goals' ? 'meeting_brief' : 'meeting_capture',
      createdBy: janLuka.id,
      createdAt: draft.createdAt,
      reviewOrder: index + 1,
    });
    // Jede Aussage mit Quelle, wie createBuyerDraft sie verlangt (KI-03)
    await tx.insert(aiSource).values({
      id: nid(615 + index),
      orgId,
      draftId: draft.id,
      claimKey: '1',
      objectType: draft.source.objectType,
      objectId: draft.source.objectId,
      excerpt: 'quote' in draft.content ? draft.content.quote : null,
      targetType: 'meeting',
      targetId: draft.source.meetingId,
      kind: 'own_data',
      title: draft.source.title,
    });
  }
}
