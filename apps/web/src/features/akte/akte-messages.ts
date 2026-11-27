import { defineMessages } from '@/lib/i18n';

// AK-01 (K2-c.2): Texte der Akte, Kopf und Sicht Gemeinsam (Vorlagen L-Ueberblick, A-Lieferant).

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

const meetingTypesDe: Record<string, string> = {
  jbp: 'JBP',
  quarterly_review: 'QBR',
  strategy_dialogue: 'Strategiedialog',
  negotiation: 'Verhandlung',
  site_visit: 'Besuch',
  escalation: 'Eskalation',
  format: 'Termin',
};
const meetingTypesEn: Record<string, string> = {
  jbp: 'JBP',
  quarterly_review: 'QBR',
  strategy_dialogue: 'strategy dialogue',
  negotiation: 'negotiation',
  site_visit: 'visit',
  escalation: 'escalation',
  format: 'meeting',
};

export const akteMessages = defineMessages({
  de: {
    back: 'Lieferanten',
    meta: {
      spend: (amount: string, year: number) => `${amount} Spend ${year}`,
      lead: (name: string) => `Lead ${name}`,
      step: (label: string) => `im Jahreszyklus: ${label}`,
      unrated: 'ohne Segment',
    },
    views: {
      label: 'Sicht auf die Beziehung',
      shared: 'Gemeinsam',
      private: 'Nur für dich',
      privateShort: 'Für dich',
      counterpart: (name: string) => `Von ${name}`,
    },
    actions: {
      label: 'Aktionen von Reziproq',
      value: 'Wert finden',
      briefing: (type: string) => `Briefing ${meetingTypesDe[type] ?? 'Termin'}`,
      more: 'Profil, Team und Mandat',
    },
    states: {
      loading: 'Akte wird geladen',
      failed: 'Die Akte konnte nicht geladen werden.',
      notFoundTitle: 'Diese Beziehung gibt es hier nicht',
      notFoundText: 'Vielleicht ist sie beendet oder gehört zu einer anderen Organisation.',
      deniedTitle: 'Dir fehlt eine Rolle',
      deniedText: 'Die Akte sieht, wer Lieferanten sehen darf. Wende dich an deinen Admin.',
    },
    summary: {
      label: 'Das Wichtigste',
      heading: 'Zusammengefasst von Reziproq',
      sources: { commitments: 'Zusagen', scorecard: 'Scorecard', feedback: 'Feedback' },
      more: (name: string) => `Ihr haltet mehr Zusagen als ${name}.`,
      less: (name: string) => `${name} hält mehr Zusagen als ihr.`,
      equal: 'Beide Seiten halten ihre Zusagen gleich gut.',
      none: (year: number) => `In ${year} war noch keine Zusage fällig.`,
      overdueOne: (title: string) => `Überfällig ist „${title}“.`,
      overdueMany: (n: number, name: string) => `${n} Zusagen von ${name} sind überfällig.`,
      ownOverdue: (n: number) =>
        n === 1 ? 'Bei euch ist eine Zusage überfällig.' : `Bei euch sind ${n} Zusagen überfällig.`,
    },
    mirror: {
      label: (year: number, own: string, name: string, counterpart: string) =>
        `Gehaltene Zusagen ${year}: ihr ${own}, ${name} ${counterpart}`,
      none: 'noch keine fälligen',
      own: (kept: number, due: number) => `ihr · ${kept} von ${due}`,
      counterpart: (name: string, kept: number, due: number) => `${name} · ${kept} von ${due}`,
      caption: (year: number, name: string) =>
        `Gehaltene Zusagen ${year}. ${name} sieht dieselben Zahlen.`,
    },
    commitments: {
      label: (n: number) => `Zusagen · ${n} offen`,
      ownSide: 'eure Seite',
      due: (date: string) => `bis ${date}`,
      overdue: (date: string) => `war bis ${date}`,
      origin: {
        mail: 'aus einer Mail',
        meeting: 'aus einem Termin',
        feedback: 'aus der Feedback-Lücke',
        hint: 'aus einem Hinweis',
        deal: 'aus einem Deal',
        initiative: 'aus einer Initiative',
      } as Record<string, string>,
      plan: (year: number) => `aus dem JBP ${year}`,
      enteredByOwn: 'von euch eingetragen',
      enteredByCounterpart: (name: string) => `von ${name} eingetragen`,
      chips: {
        open: 'offen',
        overdue: 'überfällig',
        awaiting_counterpart: (name: string) => `${name} bestätigt noch`,
        /** Auf dem Telefon und in Nächste Wochen, wo die Seite schon davor steht */
        awaitingShort: 'bestätigt noch',
        awaiting_own: 'Bestätigung fehlt',
      },
      kept: (n: number, year: number) => `${n} gehaltene ${plural(n, 'Zusage', 'Zusagen')} ${year}`,
      lastKept: (title: string, side: string) => `zuletzt: ${title}, ${side}`,
      noneKept: 'noch keine gehalten',
      empty: 'Keine offenen Zusagen.',
    },
    scorecard: {
      label: (year: number | null, month: string | null) =>
        [year === null ? 'Scorecard' : `Scorecard ${year}`, month ? `Kennzahlen ${month}` : null]
          .filter(Boolean)
          .join(' · '),
      line: (side: string, value: string, target: string) => `${side} · ${value}, Ziel ${target}`,
      noValue: (side: string, target: string) => `${side} · Ziel ${target}`,
      tracks: {
        on_track: 'im Plan',
        close: 'knapp',
        off: 'hinter Plan',
        none: 'noch kein Wert',
      },
      signature: 'Unterschrift',
      signedBoth: 'von beiden Seiten unterschrieben',
      ownMissing: (name: string) => `${name} hat unterschrieben, eure fehlt`,
      counterpartMissing: (name: string) => `Eure Unterschrift steht, ${name} fehlt noch`,
      noneSigned: 'noch nicht unterschrieben',
      sign: 'Unterschreiben',
      empty: 'Noch keine Scorecard',
      emptyText: 'Kennzahlen legt ihr im Gemeinsamen Plan fest.',
    },
    aside: {
      weeks: 'Nächste Wochen',
      weeksEmpty: 'In den nächsten vier Wochen steht nichts an.',
      meeting: (when: string, location: string | null) =>
        location ? `${when} · ${location}` : when,
      commitment: (side: string, state: string) => `Zusage ${side} · ${state}`,
      plan: 'Plan und Spielregeln',
      planTitle: (year: number) => `Gemeinsamer Plan ${year}`,
      planStatus: { draft: 'Entwurf', in_review: 'in Freigabe', approved: 'freigegeben' },
      planDetail: (version: number) => `Version ${version}`,
      rules: (type: string) => `Spielregeln „${type}“`,
      rulesSince: (date: string) => `gelten seit ${date}`,
      rulesUnshared: 'Änderungen noch nicht geteilt',
      rulesDraft: 'noch nicht geteilt',
      rulesNone: 'Noch keine Spielregeln',
      rulesNoneText: 'Spielregeln folgen aus dem Segment.',
      feedback: 'Feedback',
      wave: { pulse: 'Puls', annual: 'Jahres-Feedback' } as Record<string, string>,
      waveRunning: (date: string) => `läuft bis ${date}`,
      waveClosed: (date: string) => `abgeschlossen, Frist ${date}`,
      turnout: (own: string, name: string, counterpart: string) =>
        `ihr ${own}, ${name} ${counterpart}`,
      ofTotal: (done: number, total: number) => `${done} von ${total}`,
      feedbackNone: 'Noch kein Feedback',
      team: 'Team beider Seiten',
      teamTitle: (own: number, counterpart: number, name: string) =>
        `${own} bei euch, ${counterpart} bei ${name}`,
      footnote: (name: string) =>
        `Was hier steht, sieht ${name} genauso. Die eigenen Notizen von ${name} siehst du nie, und ${name} deine nicht.`,
    },
    bridge: {
      counterpart: (name: string) => `Mit ${name} geteilt`,
      rules: 'Spielregeln',
      rulesSub: 'Rechte, Pflichten und Formate',
      team: 'Team',
      teamSub: 'Personen beider Seiten und Einladungen',
      feedback: 'Feedback',
      feedbackSub: 'Wellen und Ergebnisse',
    },
  },
  en: {
    back: 'Suppliers',
    meta: {
      spend: (amount: string, year: number) => `${amount} spend ${year}`,
      lead: (name: string) => `Lead ${name}`,
      step: (label: string) => `in the annual cycle: ${label}`,
      unrated: 'no segment',
    },
    views: {
      label: 'View of the relationship',
      shared: 'Shared',
      private: 'Only for you',
      privateShort: 'For you',
      counterpart: (name: string) => `From ${name}`,
    },
    actions: {
      label: 'Actions by Reziproq',
      value: 'Find value',
      briefing: (type: string) => `Briefing ${meetingTypesEn[type] ?? 'meeting'}`,
      more: 'Profile, team and mandate',
    },
    states: {
      loading: 'Loading the file',
      failed: 'The file could not be loaded.',
      notFoundTitle: 'This relationship does not exist here',
      notFoundText: 'It may have ended or belong to another organisation.',
      deniedTitle: 'You are missing a role',
      deniedText: 'The file is visible to people who may see suppliers. Contact your admin.',
    },
    summary: {
      label: 'The main point',
      heading: 'Summarized by Reziproq',
      sources: { commitments: 'Commitments', scorecard: 'Scorecard', feedback: 'Feedback' },
      more: (name: string) => `You keep more commitments than ${name}.`,
      less: (name: string) => `${name} keeps more commitments than you.`,
      equal: 'Both sides keep their commitments equally well.',
      none: (year: number) => `No commitment was due in ${year} yet.`,
      overdueOne: (title: string) => `“${title}” is overdue.`,
      overdueMany: (n: number, name: string) => `${n} commitments of ${name} are overdue.`,
      ownOverdue: (n: number) =>
        n === 1 ? 'One of your commitments is overdue.' : `${n} of your commitments are overdue.`,
    },
    mirror: {
      label: (year: number, own: string, name: string, counterpart: string) =>
        `Commitments kept ${year}: you ${own}, ${name} ${counterpart}`,
      none: 'none due yet',
      own: (kept: number, due: number) => `you · ${kept} of ${due}`,
      counterpart: (name: string, kept: number, due: number) => `${name} · ${kept} of ${due}`,
      caption: (year: number, name: string) =>
        `Commitments kept ${year}. ${name} sees the same numbers.`,
    },
    commitments: {
      label: (n: number) => `Commitments · ${n} open`,
      ownSide: 'your side',
      due: (date: string) => `due ${date}`,
      overdue: (date: string) => `was due ${date}`,
      origin: {
        mail: 'from a mail',
        meeting: 'from a meeting',
        feedback: 'from the feedback gap',
        hint: 'from a hint',
        deal: 'from a deal',
        initiative: 'from an initiative',
      } as Record<string, string>,
      plan: (year: number) => `from the JBP ${year}`,
      enteredByOwn: 'entered by you',
      enteredByCounterpart: (name: string) => `entered by ${name}`,
      chips: {
        open: 'open',
        overdue: 'overdue',
        awaiting_counterpart: (name: string) => `${name} still to confirm`,
        awaitingShort: 'still to confirm',
        awaiting_own: 'confirmation missing',
      },
      kept: (n: number, year: number) =>
        `${n} ${plural(n, 'commitment', 'commitments')} kept ${year}`,
      lastKept: (title: string, side: string) => `latest: ${title}, ${side}`,
      noneKept: 'none kept yet',
      empty: 'No open commitments.',
    },
    scorecard: {
      label: (year: number | null, month: string | null) =>
        [year === null ? 'Scorecard' : `Scorecard ${year}`, month ? `figures ${month}` : null]
          .filter(Boolean)
          .join(' · '),
      line: (side: string, value: string, target: string) => `${side} · ${value}, target ${target}`,
      noValue: (side: string, target: string) => `${side} · target ${target}`,
      tracks: {
        on_track: 'on track',
        close: 'close',
        off: 'behind plan',
        none: 'no value yet',
      },
      signature: 'Signature',
      signedBoth: 'signed by both sides',
      ownMissing: (name: string) => `${name} has signed, yours is missing`,
      counterpartMissing: (name: string) => `You have signed, ${name} is missing`,
      noneSigned: 'not signed yet',
      sign: 'Sign',
      empty: 'No scorecard yet',
      emptyText: 'You set the figures in the joint plan.',
    },
    aside: {
      weeks: 'Next weeks',
      weeksEmpty: 'Nothing is due in the next four weeks.',
      meeting: (when: string, location: string | null) =>
        location ? `${when} · ${location}` : when,
      commitment: (side: string, state: string) => `Commitment ${side} · ${state}`,
      plan: 'Plan and ground rules',
      planTitle: (year: number) => `Joint plan ${year}`,
      planStatus: { draft: 'draft', in_review: 'in approval', approved: 'approved' },
      planDetail: (version: number) => `Version ${version}`,
      rules: (type: string) => `Ground rules “${type}”`,
      rulesSince: (date: string) => `valid since ${date}`,
      rulesUnshared: 'changes not shared yet',
      rulesDraft: 'not shared yet',
      rulesNone: 'No ground rules yet',
      rulesNoneText: 'Ground rules follow from the segment.',
      feedback: 'Feedback',
      wave: { pulse: 'Pulse', annual: 'Annual feedback' } as Record<string, string>,
      waveRunning: (date: string) => `runs until ${date}`,
      waveClosed: (date: string) => `closed, deadline ${date}`,
      turnout: (own: string, name: string, counterpart: string) =>
        `you ${own}, ${name} ${counterpart}`,
      ofTotal: (done: number, total: number) => `${done} of ${total}`,
      feedbackNone: 'No feedback yet',
      team: 'Team of both sides',
      teamTitle: (own: number, counterpart: number, name: string) =>
        `${own} with you, ${counterpart} with ${name}`,
      footnote: (name: string) =>
        `${name} sees what is here exactly the same way. You never see the own notes of ${name}, and ${name} never sees yours.`,
    },
    bridge: {
      counterpart: (name: string) => `Shared with ${name}`,
      rules: 'Ground rules',
      rulesSub: 'Rights, duties and formats',
      team: 'Team',
      teamSub: 'People of both sides and invitations',
      feedback: 'Feedback',
      feedbackSub: 'Waves and results',
    },
  },
});
