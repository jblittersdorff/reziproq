import { defineMessages } from '@/lib/i18n';
import type { ShareFraction } from './segments-view';

// BZ-01 (K2-b.5): Texte der Seite Lieferanten, Linse Segmente (Vorlage K2-Segmente).

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

export const segmentsMessages = defineMessages({
  de: {
    head: (portfolio: number, rated: number, round: string | null) =>
      [
        `${portfolio} ${plural(portfolio, 'Lieferant', 'Lieferanten')} im Portfolio`,
        `${rated} bewertet`,
        ...(round ? [round] : []),
      ].join(' · '),
    headPhone: (portfolio: number, rated: number) =>
      `${portfolio} im Portfolio · ${rated} bewertet`,
    round: (name: string, until: string | null) =>
      until ? `${name} läuft bis ${until}` : `${name} läuft`,
    summary: {
      label: 'Das Wichtigste',
      heading: 'Zusammengefasst von Reziproq',
      sources: { round: 'Bewertungsrunde', spend: 'Spend', model: 'Segmentmodell' },
      top: (count: number, name: string, spend: string, share: string | null) =>
        `${count} ${plural(count, 'Lieferant', 'Lieferanten')} im Segment „${name}“ ${plural(
          count,
          'trägt',
          'tragen',
        )} ${spend}${share ? `, ${share} des bewerteten Spend` : ''}.`,
      fractions: {
        quarter: 'ein Viertel',
        third: 'ein Drittel',
        half: 'die Hälfte',
        twoThirds: 'zwei Drittel',
        threeQuarters: 'drei Viertel',
      } satisfies Record<ShareFraction, string>,
      approx: {
        almost: (words: string) => `fast ${words}`,
        exact: (words: string) => words,
        over: (words: string) => `gut ${words}`,
      },
      percent: (share: number) => `${share} %`,
      clarify: (name: string, points: number, criterion: string, decides: boolean) =>
        `${name}: Spanne ${points} Punkte bei ${criterion}, ${
          decides ? 'entscheidet über das Segment' : 'ändert das Segment nicht'
        }`,
      missing: (count: number, name: string, largest: boolean) =>
        count === 1
          ? `1 Lieferant ohne Bewertung: ${name}`
          : largest
            ? `${count} Lieferanten ohne Bewertung, darunter der größte: ${name}`
            : `${count} Lieferanten ohne Bewertung, der größte davon: ${name}`,
      chips: { clarify: 'Klären', missing: 'Fehlt' },
    },
    matrix: {
      label: 'Portfolio · nur eure Seite',
      title: (rated: number, portfolio: number, disputed: number) =>
        `${rated} von ${portfolio} ${plural(portfolio, 'Lieferant', 'Lieferanten')} bewertet${
          disputed > 0 ? `, ${disputed} strittig` : ''
        }`,
      name: 'Matrix der Segmente',
      rest: (n: number) => `und ${n} weitere`,
      disputed: 'strittig',
      levels: { low: 'gering', mid: 'mittel', high: 'hoch' },
      position: (impact: string, impactLevel: string, quality: string, qualityLevel: string) =>
        `${impact} ${impactLevel}, ${quality} ${qualityLevel}`,
      source: (impact: string, quality: string) =>
        `Matrix nach ${impact} und ${quality}, aus der letzten Entscheidung je Lieferant. Gelber Rand: Segment strittig.`,
      unrated: (n: number) => `Ohne Bewertung · ${n}`,
      unratedDetail: (name: string, spend: string | null) =>
        spend ? `darunter ${name}, ${spend}` : `darunter ${name}`,
      unratedChip: 'Fehlt',
    },
    spend: {
      label: (year: number) => `Spend ${year} nach Segment`,
      title: (rated: number, total: string) =>
        `${rated} bewertete ${plural(rated, 'Lieferant trägt', 'Lieferanten tragen')} ${total}`,
      source: 'Spend des laufenden Jahres, Segment aus der letzten Entscheidung',
    },
    aside: {
      rounds: 'Bewertungsrunden',
      roundOpen: 'läuft',
      roundUntil: (date: string) => `läuft bis ${date}`,
      allRounds: 'Alle Bewertungsrunden',
      allRoundsSub: 'anlegen, verfolgen, abschließen',
      privateTitle: 'Nur für euch',
      privateChip: 'privat',
      privateText:
        'Lieferanten sehen weder Bewertung noch Segment, nur die Spielregeln, die daraus folgen. Liegen Bewertungen weit auseinander, legt ihr das Segment mit Begründung fest.',
      detail: 'Portfolio im Detail',
      matrix: 'Matrix mit Filtern',
      matrixSub: 'Business Unit, Warengruppe, Ist und Soll',
      open: 'Offene Entscheidungen',
      openSub: (n: number) =>
        n === 0 ? 'nichts offen' : `${n} ${plural(n, 'Lieferant wartet', 'Lieferanten warten')}`,
      focus: 'Fokuslieferanten',
      focusSub: (n: number) => `${n} im Fokus`,
      cycles: 'Stand der Zyklen',
      cyclesSub: (n: number) => (n === 0 ? 'nichts im Verzug' : `${n} im Verzug`),
      model: 'Segmentmodell',
      criteria: 'Kriterien und Gewicht',
      criteriaSub: (impact: string, quality: string, size: number) =>
        `${impact} × ${quality} · ${size} × ${size}`,
    },
    states: {
      deniedTitle: 'Dir fehlt eine Rolle',
      deniedText: 'Die Segmente sieht, wer das Portfolio sehen darf. Wende dich an deinen Admin.',
      noModelTitle: 'Noch kein Segmentmodell',
      noModelText:
        'Sobald ein Segmentmodell aktiv ist, zeigt die Matrix, wo jeder Lieferant steht.',
      noModelAction: 'Segmentmodell einrichten',
      emptyTitle: 'Noch keine Lieferanten im Portfolio',
      emptyText: 'Sobald Lieferanten angelegt oder importiert sind, stehen sie hier in der Matrix.',
      failed: 'Die Segmente konnten nicht geladen werden.',
      loading: 'Segmente werden geladen',
    },
  },
  en: {
    head: (portfolio: number, rated: number, round: string | null) =>
      [
        `${portfolio} ${plural(portfolio, 'supplier', 'suppliers')} in the portfolio`,
        `${rated} rated`,
        ...(round ? [round] : []),
      ].join(' · '),
    headPhone: (portfolio: number, rated: number) =>
      `${portfolio} in the portfolio · ${rated} rated`,
    round: (name: string, until: string | null) =>
      until ? `${name} runs until ${until}` : `${name} is running`,
    summary: {
      label: 'The main point',
      heading: 'Summarized by Reziproq',
      sources: { round: 'Rating round', spend: 'Spend', model: 'Segment model' },
      top: (count: number, name: string, spend: string, share: string | null) =>
        `${count} ${plural(count, 'supplier', 'suppliers')} in the segment “${name}” ${plural(
          count,
          'carries',
          'carry',
        )} ${spend}${share ? `, ${share} of rated spend` : ''}.`,
      fractions: {
        quarter: 'a quarter',
        third: 'a third',
        half: 'half',
        twoThirds: 'two thirds',
        threeQuarters: 'three quarters',
      } satisfies Record<ShareFraction, string>,
      approx: {
        almost: (words: string) => `almost ${words}`,
        exact: (words: string) => words,
        over: (words: string) => `just over ${words}`,
      },
      percent: (share: number) => `${share} %`,
      clarify: (name: string, points: number, criterion: string, decides: boolean) =>
        `${name}: spread of ${points} points on ${criterion}, ${
          decides ? 'decides the segment' : 'does not change the segment'
        }`,
      missing: (count: number, name: string, largest: boolean) =>
        count === 1
          ? `1 supplier without a rating: ${name}`
          : largest
            ? `${count} suppliers without a rating, including the largest: ${name}`
            : `${count} suppliers without a rating, the largest of them: ${name}`,
      chips: { clarify: 'Clarify', missing: 'Missing' },
    },
    matrix: {
      label: 'Portfolio · your side only',
      title: (rated: number, portfolio: number, disputed: number) =>
        `${rated} of ${portfolio} ${plural(portfolio, 'supplier', 'suppliers')} rated${
          disputed > 0 ? `, ${disputed} disputed` : ''
        }`,
      name: 'Segment matrix',
      rest: (n: number) => `and ${n} more`,
      disputed: 'disputed',
      levels: { low: 'low', mid: 'medium', high: 'high' },
      position: (impact: string, impactLevel: string, quality: string, qualityLevel: string) =>
        `${impact} ${impactLevel}, ${quality} ${qualityLevel}`,
      source: (impact: string, quality: string) =>
        `Matrix by ${impact} and ${quality}, from the latest decision per supplier. Yellow border: segment disputed.`,
      unrated: (n: number) => `Without a rating · ${n}`,
      unratedDetail: (name: string, spend: string | null) =>
        spend ? `including ${name}, ${spend}` : `including ${name}`,
      unratedChip: 'Missing',
    },
    spend: {
      label: (year: number) => `Spend ${year} by segment`,
      title: (rated: number, total: string) =>
        `${rated} rated ${plural(rated, 'supplier carries', 'suppliers carry')} ${total}`,
      source: 'Spend of the current year, segment from the latest decision',
    },
    aside: {
      rounds: 'Rating rounds',
      roundOpen: 'running',
      roundUntil: (date: string) => `runs until ${date}`,
      allRounds: 'All rating rounds',
      allRoundsSub: 'create, follow, close',
      privateTitle: 'Only for you',
      privateChip: 'private',
      privateText:
        'Suppliers see neither rating nor segment, only the ground rules that follow from them. If ratings are far apart, you set the segment with a reason.',
      detail: 'Portfolio in detail',
      matrix: 'Matrix with filters',
      matrixSub: 'Business unit, category, actual and target',
      open: 'Open decisions',
      openSub: (n: number) =>
        n === 0 ? 'nothing open' : `${n} ${plural(n, 'supplier waits', 'suppliers wait')}`,
      focus: 'Focus suppliers',
      focusSub: (n: number) => `${n} in focus`,
      cycles: 'Status of cycles',
      cyclesSub: (n: number) => (n === 0 ? 'nothing overdue' : `${n} overdue`),
      model: 'Segment model',
      criteria: 'Criteria and weights',
      criteriaSub: (impact: string, quality: string, size: number) =>
        `${impact} × ${quality} · ${size} × ${size}`,
    },
    states: {
      deniedTitle: 'You are missing a role',
      deniedText: 'Segments are visible to people who may see the portfolio. Contact your admin.',
      noModelTitle: 'No segment model yet',
      noModelText: 'Once a segment model is active, the matrix shows where each supplier stands.',
      noModelAction: 'Set up the segment model',
      emptyTitle: 'No suppliers in the portfolio yet',
      emptyText: 'Once suppliers are created or imported, they appear here in the matrix.',
      failed: 'The segments could not be loaded.',
      loading: 'Loading segments',
    },
  },
});
