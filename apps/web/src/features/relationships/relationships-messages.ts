import { defineMessages } from '@/lib/i18n';

// BZ-01 (K2-b.4): Texte der Seite Lieferanten, Linse Liste (Vorlagen Lieferanten, A-Lieferanten).

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

export const relationshipsMessages = defineMessages({
  de: {
    head: (active: number, spend: string | null, year: number, portfolio: number) =>
      [
        `${active} ${plural(active, 'Beziehung', 'Beziehungen')}`,
        ...(spend ? [`${spend} Spend ${year}`] : []),
        `${portfolio} ${plural(portfolio, 'Lieferant', 'Lieferanten')} im Portfolio`,
      ].join(' · '),
    headPhone: (active: number, spend: string | null) =>
      [`${active} ${plural(active, 'Beziehung', 'Beziehungen')}`, ...(spend ? [spend] : [])].join(
        ' · ',
      ),
    lenses: { label: 'Ansicht', list: 'Liste', segments: 'Segmente' },
    summary: {
      label: 'Das Wichtigste',
      heading: 'Zusammengefasst von Reziproq',
      sources: { commitments: 'Zusagen', hints: 'Hinweise', segments: 'Segmente' },
      keptBetter: (n: number) =>
        n === 1
          ? 'Bei einer Beziehung haltet ihr eure Zusagen deutlich besser als der Lieferant.'
          : `Bei ${n} Beziehungen haltet ihr eure Zusagen deutlich besser als der Lieferant.`,
      unratedLargest: (name: string) => `${name}, euer größter Lieferant, hat noch kein Segment.`,
      unrated: (name: string) => `${name} hat noch kein Segment.`,
      counterpartLow: (name: string, kept: number, due: number) =>
        `${name} hält ${kept} von ${due} Zusagen`,
      hintLine: (what: string, inProgress: boolean) =>
        `${what} · ${inProgress ? 'Hinweis in Arbeit' : 'Hinweis offen'}`,
      noHint: 'gehaltene Zusagen des Lieferanten in diesem Jahr',
      unratedRow: (name: string) => `${name} ohne Segment`,
      quotaGap: (name: string, own: number, counterpart: number) =>
        `${name}: ${own} zu ${counterpart} % gehaltene Zusagen`,
      overdue: (count: number, title: string) =>
        count === 1
          ? `1 Zusage überfällig: ${title}`
          : `${count} Zusagen überfällig, zuerst ${title}`,
      noOverdue: 'keine Zusage überfällig',
      chips: { counterpart_low: 'Hakt', unrated: 'Fehlt', quota_gap: 'Info' },
    },
    chips: {
      label: 'Filter',
      all: 'Alle',
      mine: 'Meine',
      focus: 'Strategisch',
      open: 'Offene Zusagen',
      more: 'Mehr Filter',
    },
    sort: {
      label: 'Sortierung',
      attention: 'sortiert nach Aufmerksamkeit',
      spend: 'sortiert nach Spend',
    },
    more: {
      label: 'Mehr Filter',
      portfolio: (n: number) =>
        `Auch ${n} ${plural(n, 'importierten Lieferanten', 'importierte Lieferanten')} ohne Anbindung zeigen`,
      segment: 'Segment',
      unrated: 'ohne Segment',
      disputed: 'strittig',
    },
    heads: { relationship: 'Beziehung', segment: 'Segment', quota: 'Zusagen gehalten' },
    row: {
      overdue: (n: number) => (n === 1 ? '1 Zusage überfällig' : `${n} Zusagen überfällig`),
      disputed: 'Segment strittig',
      unrated: 'ohne Bewertung',
      draft: 'ohne Anbindung',
      ended: 'beendet',
      chipDisputed: 'strittig',
      chipUnrated: 'ohne Segment',
      noCommitments: 'noch keine Zusagen',
      mirror: (own: number | null, counterpart: number | null, name: string) =>
        `Zusagen gehalten: ihr ${own === null ? 'noch keine fälligen' : `${own} %`}, ${name} ${
          counterpart === null ? 'noch keine fälligen' : `${counterpart} %`
        }`,
      open: (name: string) => `${name} öffnen`,
    },
    rest: {
      title: (n: number) => (n === 1 ? '1 weitere Beziehung' : `${n} weitere Beziehungen`),
      names: (names: string[], others: number, spend: string | null) =>
        [
          others > 0 ? `${names.join(', ')} und ${others} weitere` : names.join(', '),
          ...(spend ? [spend] : []),
        ].join(' · '),
      less: 'Weniger zeigen',
    },
    footnote: (year: number) =>
      `Gehaltene Zusagen ${year}, links eure Seite, rechts der Lieferant. Beide Seiten sehen ihre Quote gleich. Mehr Filter: Segment, Soll-Typ, Warengruppe, Business Unit.`,
    footnotePhone: 'Balken: gehaltene Zusagen, links ihr, rechts der Lieferant.',
    aside: {
      background: 'Im Hintergrund',
      mails: (n: number) => (n === 1 ? '1 Mail zugeordnet' : `${n} Mails zugeordnet`),
      mailsSub: 'seit gestern · Postfach',
      import: 'Lieferanten importieren',
      importSub: 'Einstellungen · Import',
      add: 'Lieferant hinzufügen',
      addSub: 'von Hand anlegen',
      tools: 'Lieferanten pflegen',
    },
    noMatch: 'Kein Lieferant passt zu diesen Filtern.',
  },
  en: {
    head: (active: number, spend: string | null, year: number, portfolio: number) =>
      [
        `${active} ${plural(active, 'relationship', 'relationships')}`,
        ...(spend ? [`${spend} spend ${year}`] : []),
        `${portfolio} ${plural(portfolio, 'supplier', 'suppliers')} in the portfolio`,
      ].join(' · '),
    headPhone: (active: number, spend: string | null) =>
      [
        `${active} ${plural(active, 'relationship', 'relationships')}`,
        ...(spend ? [spend] : []),
      ].join(' · '),
    lenses: { label: 'View', list: 'List', segments: 'Segments' },
    summary: {
      label: 'The main point',
      heading: 'Summarized by Reziproq',
      sources: { commitments: 'Commitments', hints: 'Hints', segments: 'Segments' },
      keptBetter: (n: number) =>
        n === 1
          ? 'In one relationship you keep your commitments clearly better than the supplier.'
          : `In ${n} relationships you keep your commitments clearly better than the supplier.`,
      unratedLargest: (name: string) => `${name}, your largest supplier, has no segment yet.`,
      unrated: (name: string) => `${name} has no segment yet.`,
      counterpartLow: (name: string, kept: number, due: number) =>
        `${name} keeps ${kept} of ${due} commitments`,
      hintLine: (what: string, inProgress: boolean) =>
        `${what} · ${inProgress ? 'hint in progress' : 'hint open'}`,
      noHint: 'commitments kept by the supplier this year',
      unratedRow: (name: string) => `${name} without a segment`,
      quotaGap: (name: string, own: number, counterpart: number) =>
        `${name}: ${own} to ${counterpart} % of commitments kept`,
      overdue: (count: number, title: string) =>
        count === 1
          ? `1 commitment overdue: ${title}`
          : `${count} commitments overdue, first ${title}`,
      noOverdue: 'no commitment overdue',
      chips: { counterpart_low: 'Stuck', unrated: 'Missing', quota_gap: 'Info' },
    },
    chips: {
      label: 'Filters',
      all: 'All',
      mine: 'Mine',
      focus: 'Strategic',
      open: 'Open commitments',
      more: 'More filters',
    },
    sort: {
      label: 'Sort order',
      attention: 'sorted by attention',
      spend: 'sorted by spend',
    },
    more: {
      label: 'More filters',
      portfolio: (n: number) =>
        `Also show ${n} imported ${plural(n, 'supplier', 'suppliers')} without a connection`,
      segment: 'Segment',
      unrated: 'without a segment',
      disputed: 'disputed',
    },
    heads: { relationship: 'Relationship', segment: 'Segment', quota: 'Commitments kept' },
    row: {
      overdue: (n: number) => (n === 1 ? '1 commitment overdue' : `${n} commitments overdue`),
      disputed: 'segment disputed',
      unrated: 'not rated',
      draft: 'no connection',
      ended: 'ended',
      chipDisputed: 'disputed',
      chipUnrated: 'no segment',
      noCommitments: 'no commitments yet',
      mirror: (own: number | null, counterpart: number | null, name: string) =>
        `Commitments kept: you ${own === null ? 'none due yet' : `${own} %`}, ${name} ${
          counterpart === null ? 'none due yet' : `${counterpart} %`
        }`,
      open: (name: string) => `Open ${name}`,
    },
    rest: {
      title: (n: number) => (n === 1 ? '1 more relationship' : `${n} more relationships`),
      names: (names: string[], others: number, spend: string | null) =>
        [
          others > 0 ? `${names.join(', ')} and ${others} more` : names.join(', '),
          ...(spend ? [spend] : []),
        ].join(' · '),
      less: 'Show fewer',
    },
    footnote: (year: number) =>
      `Commitments kept in ${year}, your side on the left, the supplier on the right. Both sides see the same rates. More filters: segment, target type, material group, business unit.`,
    footnotePhone: 'Bars: commitments kept, you on the left, the supplier on the right.',
    aside: {
      background: 'In the background',
      mails: (n: number) => (n === 1 ? '1 mail assigned' : `${n} mails assigned`),
      mailsSub: 'since yesterday · Inbox',
      import: 'Import suppliers',
      importSub: 'Settings · Import',
      add: 'Add supplier',
      addSub: 'create by hand',
      tools: 'Maintain suppliers',
    },
    noMatch: 'No supplier matches these filters.',
  },
});
