import { defineMessages } from '@/lib/i18n';

// AK-01 (K2-c.3): Texte der Sicht Nur für dich (Vorlage K2-Akte-Privat). Allgemeine Texte des
// Verlaufs (Arten, Mails, Notiz-Formular) kommen aus activities in den Sprachdateien.

/** „Kim Kaiser und Nils Ott“, „A, B, C und 2 weiteren“ */
function listDe(names: string[], more: number): string {
  const all = more > 0 ? [...names, `${more} weiteren`] : names;
  return all.length <= 1 ? (all[0] ?? '') : `${all.slice(0, -1).join(', ')} und ${all.at(-1)}`;
}
function listEn(names: string[], more: number): string {
  const all = more > 0 ? [...names, `${more} others`] : names;
  return all.length <= 1 ? (all[0] ?? '') : `${all.slice(0, -1).join(', ')} and ${all.at(-1)}`;
}

export const aktePrivateMessages = defineMessages({
  de: {
    failed: 'Konnte nicht geladen werden.',
    loading: 'Wird geladen',
    summary: {
      label: 'Das Wichtigste',
      title: 'Nur für dich und euer Team',
      chip: 'privat',
      points: (value: string, one: boolean) => (one ? `${value} Punkt` : `${value} Punkte`),
      distance: (name: string, segment: string, points: string) =>
        `${name} steht im Segment „${segment}“, ${points} über der Grenze.`,
      close: (name: string, segment: string, points: string) =>
        `${name} steht im Segment „${segment}“, aber knapp: ${points} über der Grenze.`,
      plain: (name: string, segment: string) => `${name} steht im Segment „${segment}“.`,
      unrated: (name: string) => `${name} ist noch nicht bewertet.`,
      gaps: (count: number) =>
        count === 1
          ? 'Zu einem vereinbarten Format fehlt noch ein Gesprächspaar.'
          : `Zu ${count} vereinbarten Formaten fehlen noch Gesprächspaare.`,
      unpaired: (names: string[], more: number) =>
        `Mit ${listDe(names, more)} spricht bei euch noch niemand direkt.`,
      empty: (name: string) =>
        `Wer bei euch mit wem bei ${name} spricht, ist noch nicht eingetragen.`,
    },
    tasks: {
      label: 'Aufgaben · nur euer Team',
      detail: (owner: string, due: string) => `${owner} · bis ${due}`,
      chips: { open: 'offen', in_progress: 'in Arbeit', overdue: 'überfällig' },
    },
    history: {
      label: 'Verlauf · nur euer Team',
      ask: (name: string) => `Frag Reziproq zu ${name}`,
      askExample: (name: string) => `zum Beispiel: „Was hat ${name} zuletzt zugesagt?“`,
      filterLabel: 'Verlauf filtern',
      newNote: 'Neue Notiz',
      cancel: 'Abbrechen',
      titles: {
        ownNote: 'Deine Notiz',
        ownCall: 'Dein Telefonat',
        note: (name: string) => `Notiz von ${name}`,
        call: (name: string) => `Telefonat von ${name}`,
        pinned: (name: string) => `Angeheftet · ${name}`,
        mailFrom: (name: string) => `Mail von ${name}`,
      },
      onlyYou: 'nur du',
      filedBy: (name: string) => `abgelegt von ${name}`,
      removeNote: 'Diese Notiz löschen?',
      chips: {
        meeting: 'Termin',
        note: 'Notiz',
        call: 'Telefonat',
        mail: 'Mail',
        hint: 'Hinweis',
        agent: 'Reziproq',
      },
      all: 'Alles anzeigen',
      allDetail: (count: number, since: string) =>
        `${count} Einträge seit ${since} · Mails, Termine, Notizen und was Reziproq getan hat`,
      less: 'Weniger anzeigen',
      pinned: 'Angeheftet',
      empty: 'Noch nichts im Verlauf.',
      emptyFilter: 'Dazu steht noch nichts im Verlauf.',
      loading: 'Verlauf wird geladen',
    },
    network: {
      label: 'Beziehungsnetz',
      pair: (own: string, counterpart: string) => `${own} ↔ ${counterpart}`,
      shared: 'geteilt',
      gap: 'in den Spielregeln vereinbart, noch ohne Gesprächspaar',
      gapChip: 'fehlt',
      empty: 'Noch keine Gesprächspaare',
      emptyText: (name: string) => `Tragt ein, wer bei euch mit wem bei ${name} spricht.`,
      footnote: (name: string) =>
        `Gesprächspaare pflegt ihr unter Kontaktpunkte. Als geteilt markierte sieht ${name} auch, die übrigen nur ihr.`,
    },
    segment: {
      label: 'Segment und Bewertung',
      title: (segment: string, points: string | null) =>
        points ? `${segment} · ${points} über der Grenze` : segment,
      ratings: (n: number) => (n === 1 ? 'eine Bewertung' : `${n} Bewertungen`),
      decided: (date: string) => `festgelegt ${date}`,
      provisional: 'vorläufig',
      close: 'knapp',
      spread: (value: string, name: string) => `Spanne ${value} bei ${name}`,
      none: 'Noch nicht bewertet',
      noneText: (name: string) => `Die nächste Bewertungsrunde ordnet ${name} ein.`,
    },
    plan: {
      label: 'Lieferantenplan',
      version: (version: number, status: string) => `Version ${version} · ${status}`,
      statuses: {
        draft: 'Entwurf',
        in_review: 'in Freigabe',
        approved: 'freigegeben',
        superseded: 'abgelöst',
      },
      current: 'gilt',
      approved: (name: string, date: string) => `${name}, ${date}`,
      contributions: (done: number, total: number) => `${done} von ${total} Beiträgen`,
      topics: (n: number) => (n === 1 ? '1 Thema geht ins JBP' : `${n} Themen gehen ins JBP`),
      internal: (n: number) => (n === 1 ? '1 Ziel bleibt intern' : `${n} Ziele bleiben intern`),
      none: 'Noch kein Lieferantenplan',
      noneText: 'Den Plan legt ihr im Jahreszyklus an.',
    },
    groups: {
      label: 'Warengruppen',
      title: (name: string, spend: string | null) => (spend ? `${name} · ${spend}` : name),
      up: 'will stärken',
      down: 'will zurückfahren',
      ended: 'beendet die Beziehung',
      strategy: (state: string) => `Strategie ${state}`,
      conflict: 'widerspricht',
      none: 'Keine Warengruppe zugeordnet',
    },
    value: {
      label: 'Wert',
      results: (year: number) => `Ergebnisse ${year}`,
      secured: (secured: string, target: string | null) =>
        target ? `${secured} von ${target} gesichert` : `${secured} gesichert`,
      nothing: 'noch nichts gesichert',
      potential: (low: string, high: string) => `${low} bis ${high} Potenzial`,
      opportunities: 'Wertpotenziale',
      opportunitiesDetail: (fresh: number, adopted: number) =>
        `${fresh} neu, ${adopted} übernommen`,
    },
  },
  en: {
    failed: 'Could not be loaded.',
    loading: 'Loading',
    summary: {
      label: 'Key points',
      title: 'Only for you and your team',
      chip: 'private',
      points: (value: string, one: boolean) => (one ? `${value} point` : `${value} points`),
      distance: (name: string, segment: string, points: string) =>
        `${name} is in the segment “${segment}”, ${points} above the boundary.`,
      close: (name: string, segment: string, points: string) =>
        `${name} is in the segment “${segment}”, but only just: ${points} above the boundary.`,
      plain: (name: string, segment: string) => `${name} is in the segment “${segment}”.`,
      unrated: (name: string) => `${name} has not been rated yet.`,
      gaps: (count: number) =>
        count === 1
          ? 'One agreed format still has no conversation pair.'
          : `${count} agreed formats still have no conversation pairs.`,
      unpaired: (names: string[], more: number) =>
        `Nobody on your side talks directly with ${listEn(names, more)} yet.`,
      empty: (name: string) => `Who on your side talks to whom at ${name} is not recorded yet.`,
    },
    tasks: {
      label: 'Tasks · your team only',
      detail: (owner: string, due: string) => `${owner} · due ${due}`,
      chips: { open: 'open', in_progress: 'in progress', overdue: 'overdue' },
    },
    history: {
      label: 'History · your team only',
      ask: (name: string) => `Ask Reziproq about ${name}`,
      askExample: (name: string) => `for example: “What did ${name} commit to last?”`,
      filterLabel: 'Filter history',
      newNote: 'New note',
      cancel: 'Cancel',
      titles: {
        ownNote: 'Your note',
        ownCall: 'Your call',
        note: (name: string) => `Note by ${name}`,
        call: (name: string) => `Call by ${name}`,
        pinned: (name: string) => `Pinned · ${name}`,
        mailFrom: (name: string) => `Mail from ${name}`,
      },
      onlyYou: 'only you',
      filedBy: (name: string) => `filed by ${name}`,
      removeNote: 'Delete this note?',
      chips: {
        meeting: 'Meeting',
        note: 'Note',
        call: 'Call',
        mail: 'Mail',
        hint: 'Hint',
        agent: 'Reziproq',
      },
      all: 'Show all',
      allDetail: (count: number, since: string) =>
        `${count} entries since ${since} · mails, meetings, notes and what Reziproq did`,
      less: 'Show less',
      pinned: 'Pinned',
      empty: 'Nothing in the history yet.',
      emptyFilter: 'Nothing of this kind in the history yet.',
      loading: 'Loading history',
    },
    network: {
      label: 'Relationship network',
      pair: (own: string, counterpart: string) => `${own} ↔ ${counterpart}`,
      shared: 'shared',
      gap: 'agreed in the ground rules, no conversation pair yet',
      gapChip: 'missing',
      empty: 'No conversation pairs yet',
      emptyText: (name: string) => `Record who on your side talks to whom at ${name}.`,
      footnote: (name: string) =>
        `You maintain conversation pairs under touchpoints. ${name} also sees those marked as shared; only you see the rest.`,
    },
    segment: {
      label: 'Segment and rating',
      title: (segment: string, points: string | null) =>
        points ? `${segment} · ${points} above the boundary` : segment,
      ratings: (n: number) => (n === 1 ? 'one rating' : `${n} ratings`),
      decided: (date: string) => `decided ${date}`,
      provisional: 'provisional',
      close: 'only just',
      spread: (value: string, name: string) => `spread ${value} on ${name}`,
      none: 'Not rated yet',
      noneText: (name: string) => `The next rating round will place ${name}.`,
    },
    plan: {
      label: 'Supplier plan',
      version: (version: number, status: string) => `Version ${version} · ${status}`,
      statuses: {
        draft: 'draft',
        in_review: 'in approval',
        approved: 'approved',
        superseded: 'superseded',
      },
      current: 'current',
      approved: (name: string, date: string) => `${name}, ${date}`,
      contributions: (done: number, total: number) => `${done} of ${total} contributions`,
      topics: (n: number) =>
        n === 1 ? '1 topic goes into the JBP' : `${n} topics go into the JBP`,
      internal: (n: number) => (n === 1 ? '1 goal stays internal' : `${n} goals stay internal`),
      none: 'No supplier plan yet',
      noneText: 'You create the plan in the annual cycle.',
    },
    groups: {
      label: 'Categories',
      title: (name: string, spend: string | null) => (spend ? `${name} · ${spend}` : name),
      up: 'wants to strengthen',
      down: 'wants to scale back',
      ended: 'ends the relationship',
      strategy: (state: string) => `strategy ${state}`,
      conflict: 'conflicts',
      none: 'No category assigned',
    },
    value: {
      label: 'Value',
      results: (year: number) => `Results ${year}`,
      secured: (secured: string, target: string | null) =>
        target ? `${secured} of ${target} secured` : `${secured} secured`,
      nothing: 'nothing secured yet',
      potential: (low: string, high: string) => `${low} to ${high} potential`,
      opportunities: 'Value potentials',
      opportunitiesDetail: (fresh: number, adopted: number) => `${fresh} new, ${adopted} adopted`,
    },
  },
});
