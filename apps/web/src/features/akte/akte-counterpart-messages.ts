import { defineMessages } from '@/lib/i18n';

// AK-01 (K2-c.4): Texte der Sicht Von <Gegenüber> (Vorlage K2-Akte-Geteilt). Rollen des Gegenübers
// kommen aus team.supplierRoles, Takte aus touchpoints.cadences in den Sprachdateien.

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** „A“, „A und B“, „A, B und C“ */
function listDe(parts: string[]): string {
  return parts.length <= 1
    ? (parts[0] ?? '')
    : `${parts.slice(0, -1).join(', ')} und ${parts.at(-1)}`;
}
function listEn(parts: string[]): string {
  return parts.length <= 1
    ? (parts[0] ?? '')
    : `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`;
}

export const akteCounterpartMessages = defineMessages({
  de: {
    failed: 'Konnte nicht geladen werden.',
    loading: 'Wird geladen',
    summary: {
      label: 'Das Wichtigste',
      heading: 'Zusammengefasst von Reziproq',
      sources: { shared: 'Geteiltes', rules: 'Spielregeln', team: 'Team' },
      kinds: {
        kpi_value: (n: number) => `${n} ${plural(n, 'Kennzahlwert', 'Kennzahlwerte')}`,
        topic: (n: number) => `${n} ${plural(n, 'Thema fürs JBP', 'Themen fürs JBP')}`,
        comment: (n: number) => `${n} ${plural(n, 'Kommentar', 'Kommentare')}`,
        signature: (n: number) => `${n} ${plural(n, 'Unterschrift', 'Unterschriften')}`,
        business_update: (n: number) => `${n} ${plural(n, 'Lagebericht', 'Lageberichte')}`,
      },
      shared: (name: string, kinds: string[], date: string) =>
        `${name} hat ${listDe(kinds)} mit euch geteilt, zuletzt am ${date}${date.endsWith('.') ? '' : '.'}`,
      nothing: (name: string) => `${name} hat noch nichts mit euch geteilt.`,
      waiting: (n: number) =>
        n === 1 ? 'Eins davon wartet auf euch.' : `${n} davon warten auf euch.`,
      duties: (name: string, n: number, type: string) =>
        `Aus den Spielregeln „${type}“ hat ${name} ${n} ${plural(n, 'Pflicht', 'Pflichten')}.`,
      awaiting: 'Wartet',
      proposed: 'Offen',
    },
    items: {
      label: (name: string, n: number) => `Von ${name} geteilt · ${n}`,
      kpi: (name: string, month: string, value: string) => `${name} ${month}: ${value}`,
      topic: (title: string) => `Thema fürs JBP: ${title}`,
      comment: (context: string) => `Kommentar zu „${context}“`,
      commentOn: {
        meeting: 'Kommentar zu einem Termin',
        commitment: 'Kommentar zu einer Zusage',
        task: 'Kommentar',
        topic: 'Kommentar zu einem Thema fürs JBP',
        initiative: 'Kommentar zu einer Initiative',
        rule_set: 'Kommentar zu den Spielregeln',
      },
      signature: (year: number | null) =>
        year ? `Scorecard ${year} unterschrieben` : 'Scorecard unterschrieben',
      update: (year: number | null) => (year ? `Lage fürs JBP ${year}` : 'Lage fürs JBP'),
      detail: (person: string | null, date: string) => (person ? `${person} · ${date}` : date),
      chips: {
        awaiting: 'Bestätigung fehlt',
        proposed: 'vorgeschlagen',
        merged: 'im JBP',
        parked: 'geparkt',
      },
      waitingKpi: (title: string) => `${title} · eure Bestätigung fehlt`,
      waitingTopic: (title: string) => `Thema fürs JBP „${title}“ ist noch offen`,
      empty: 'Noch nichts geteilt',
      emptyText: (name: string) =>
        `Was ${name} mit euch teilt, steht hier: Kennzahlwerte, Themen fürs JBP, Kommentare und Unterschriften.`,
      footnote: (name: string) =>
        `Hier steht nur, was ${name} aktiv mit euch geteilt hat. Die eigene Seite von ${name} bleibt bei ${name}.`,
    },
    sees: {
      label: (name: string) => `Was ${name} von euch sieht`,
      title: 'Alles unter Gemeinsam',
      detail:
        'Zusagen, Scorecard, Gemeinsamer Plan, Spielregeln, Termine mit Agenda, Feedback-Ergebnis',
    },
    never: {
      title: (name: string) => `Was ${name} nie sieht`,
      chip: 'nie',
      items: [
        'Beziehungsnetz',
        'Bewertung und Segment',
        'Wertpotenziale und Rechenwege',
        'Lieferantenplan',
        'eure Notizen, Mails und Transkripte',
      ],
    },
    duties: {
      label: (name: string) => `Pflichten von ${name}`,
      ongoing: 'laufend',
      rules: (type: string) => `Spielregeln „${type}“`,
      version: (version: number, date: string) => `Version ${version}, geteilt am ${date}`,
      none: 'Noch keine geteilten Spielregeln',
      noneText: (name: string) =>
        `Die Pflichten von ${name} stehen hier, sobald ihr Spielregeln geteilt habt.`,
    },
    people: {
      label: (name: string) => `${name} in Reziproq`,
      active: 'aktiv',
      invited: 'eingeladen',
      expired: 'abgelaufen',
      expires: (date: string) => `Einladung läuft am ${date} ab`,
      expiredOn: (date: string) => `Einladung am ${date} abgelaufen`,
      uninvited: (names: string[], more: number) =>
        more > 0 ? `${names.join(', ')} und ${more} weitere` : names.join(', '),
      uninvitedText: 'noch nicht eingeladen · im Team einladen',
      none: (name: string) => `Noch niemand von ${name} in Reziproq`,
      noneText: 'Im Team ladet ihr Personen ein.',
    },
  },
  en: {
    failed: 'Could not be loaded.',
    loading: 'Loading',
    summary: {
      label: 'Key points',
      heading: 'Summarised by Reziproq',
      sources: { shared: 'Shared items', rules: 'Ground rules', team: 'Team' },
      kinds: {
        kpi_value: (n: number) => `${n} ${plural(n, 'KPI value', 'KPI values')}`,
        topic: (n: number) => `${n} ${plural(n, 'topic for the JBP', 'topics for the JBP')}`,
        comment: (n: number) => `${n} ${plural(n, 'comment', 'comments')}`,
        signature: (n: number) => `${n} ${plural(n, 'signature', 'signatures')}`,
        business_update: (n: number) => `${n} ${plural(n, 'business update', 'business updates')}`,
      },
      shared: (name: string, kinds: string[], date: string) =>
        `${name} shared ${listEn(kinds)} with you, most recently on ${date}.`,
      nothing: (name: string) => `${name} has not shared anything with you yet.`,
      waiting: (n: number) =>
        n === 1 ? 'One of them is waiting for you.' : `${n} of them are waiting for you.`,
      duties: (name: string, n: number, type: string) =>
        `The ground rules “${type}” give ${name} ${n} ${plural(n, 'obligation', 'obligations')}.`,
      awaiting: 'Waiting',
      proposed: 'Open',
    },
    items: {
      label: (name: string, n: number) => `Shared by ${name} · ${n}`,
      kpi: (name: string, month: string, value: string) => `${name} ${month}: ${value}`,
      topic: (title: string) => `Topic for the JBP: ${title}`,
      comment: (context: string) => `Comment on “${context}”`,
      commentOn: {
        meeting: 'Comment on a meeting',
        commitment: 'Comment on a commitment',
        task: 'Comment',
        topic: 'Comment on a topic for the JBP',
        initiative: 'Comment on an initiative',
        rule_set: 'Comment on the ground rules',
      },
      signature: (year: number | null) =>
        year ? `Signed scorecard ${year}` : 'Signed the scorecard',
      update: (year: number | null) =>
        year ? `Business update for JBP ${year}` : 'Business update for the JBP',
      detail: (person: string | null, date: string) => (person ? `${person} · ${date}` : date),
      chips: {
        awaiting: 'confirmation missing',
        proposed: 'proposed',
        merged: 'in the JBP',
        parked: 'parked',
      },
      waitingKpi: (title: string) => `${title} · your confirmation is missing`,
      waitingTopic: (title: string) => `Topic for the JBP “${title}” is still open`,
      empty: 'Nothing shared yet',
      emptyText: (name: string) =>
        `What ${name} shares with you shows up here: KPI values, topics for the JBP, comments and signatures.`,
      footnote: (name: string) =>
        `This only shows what ${name} actively shared with you. ${name}'s own side stays with ${name}.`,
    },
    sees: {
      label: (name: string) => `What ${name} sees of you`,
      title: 'Everything under Shared',
      detail:
        'Commitments, scorecard, joint plan, ground rules, meetings with agenda, feedback result',
    },
    never: {
      title: (name: string) => `What ${name} never sees`,
      chip: 'never',
      items: [
        'Relationship network',
        'Rating and segment',
        'Value potentials and calculations',
        'Supplier plan',
        'your notes, mails and transcripts',
      ],
    },
    duties: {
      label: (name: string) => `Obligations of ${name}`,
      ongoing: 'ongoing',
      rules: (type: string) => `Ground rules “${type}”`,
      version: (version: number, date: string) => `Version ${version}, shared on ${date}`,
      none: 'No shared ground rules yet',
      noneText: (name: string) =>
        `The obligations of ${name} show up here once you have shared ground rules.`,
    },
    people: {
      label: (name: string) => `${name} in Reziproq`,
      active: 'active',
      invited: 'invited',
      expired: 'expired',
      expires: (date: string) => `Invitation expires on ${date}`,
      expiredOn: (date: string) => `Invitation expired on ${date}`,
      uninvited: (names: string[], more: number) =>
        more > 0 ? `${names.join(', ')} and ${more} others` : names.join(', '),
      uninvitedText: 'not invited yet · invite in the team',
      none: (name: string) => `Nobody from ${name} in Reziproq yet`,
      noneText: 'You invite people in the team.',
    },
  },
});
