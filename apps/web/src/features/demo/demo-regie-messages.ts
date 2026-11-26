import { defineMessages } from '@/lib/i18n';

// DM-01 Demo-Regie (K1-g.4, Vorlage Demo-Regie)

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

export const demoScenarioKeys = [
  'morgen',
  'warum',
  'mail',
  'jbp',
  'monat',
  'deal',
  'privat',
  'autonomie',
  'strategie',
  'kanaele',
  'warengruppe',
] as const;
export type DemoScenarioKey = (typeof demoScenarioKeys)[number];

/** Bereit ist, was die Pakete bis heute bauen; sonst das Paket, mit dem das Drehbuch kommt */
export const demoScenarioPackage: Record<DemoScenarioKey, string | null> = {
  morgen: null,
  warum: 'K4',
  mail: 'K2',
  jbp: 'K3',
  monat: 'K4',
  deal: 'K5',
  privat: 'K5',
  autonomie: 'K5',
  strategie: 'K6',
  kanaele: 'K7',
  warengruppe: 'K8',
};

type Scenario = { title: string; detail: string };

export const demoRegieMessages = defineMessages({
  de: {
    title: 'Demo-Regie',
    where: 'Nur im Demo-Mandanten Nordwind · öffnet mit ⌥D über jeder Seite · Kunden sehen sie nie',
    loading: 'Die Regie wird geladen …',
    failed: 'Die Regie ließ sich nicht laden.',
    retry: 'Erneut versuchen',
    notDemo: 'Die Demo-Regie gibt es nur im Demo-Mandanten.',
    scenario: {
      label: 'Szenario',
      ready: 'bereit',
      follows: (pkg: string) => `folgt mit ${pkg}`,
      items: {
        morgen: { title: 'Morgen mit Reziproq', detail: 'Heute, Kurz prüfen, Erledigt · 5 Min.' },
        warum: { title: 'Warum 63 T€?', detail: 'Mappe und Herleitung · 2 Min.' },
        mail: {
          title: 'Mail rein, Zusage raus',
          detail: 'Mail von Kim Kaiser, Zusagen, Bestätigung · 5 Min.',
        },
        jbp: { title: 'JBP-Woche', detail: 'Briefing, Termin, Protokoll mit Zusagen · 10 Min.' },
        monat: {
          title: 'Monat vorspulen',
          detail: 'Wert-Engine bucht, Controlling bestätigt · 5 Min.',
        },
        deal: { title: 'Deal Rheintal', detail: 'Zwei Fenster, Kim Kaiser bestätigt · 10 Min.' },
        privat: {
          title: 'Privat bleibt privat',
          detail: 'Rolle wechseln, Zielpreis suchen · 3 Min.',
        },
        autonomie: {
          title: 'Autonomie wird verdient',
          detail: 'Annahmequote setzen, Angebot annehmen · 3 Min.',
        },
        strategie: {
          title: 'Strategie wirkt',
          detail: 'Freigabe festhalten, Mandat-Vorschläge bestätigen · 5 Min.',
        },
        kanaele: {
          title: 'Kanäle',
          detail: 'Freigabe im Chat, Briefing im Kalender, Mail prüfen, Sprache · 5 Min.',
        },
        warengruppe: {
          title: 'Warengruppe steuert sich',
          detail: 'Annahme kippt, Anteile, Vergabe mit Verhandlung der Agenten, Review · 8 Min.',
        },
      } satisfies Record<DemoScenarioKey, Scenario>,
    },
    signals: {
      label: 'Signale einspielen',
      mailKimKaiser: 'Mail von Kim Kaiser',
      note: 'Jedes Signal läuft durch dieselben Dienste wie im Betrieb: Triage, Worker, Entwürfe, Erledigt.',
      more: 'Lieferverzug Silesia Guss, Eilabruf Rheintal, Rheintal meldet Liefertreue, Rheintal schlägt Deal vor, Annahmequote setzen, Kupferpreis +8 %, Mail Kupferangebot, Erstmuster Moldau verschoben und Angebote Mehrlagen folgen mit ihren Kapiteln.',
      played: (where: 'filed' | 'review' | 'other'): string =>
        where === 'filed'
          ? 'Mail von Kim Kaiser ist da: Reziproq hat sie selbst zugeordnet (Erledigt).'
          : where === 'review'
            ? 'Mail von Kim Kaiser ist da: Die Zuordnung wartet in Kurz prüfen.'
            : 'Mail von Kim Kaiser ist da.',
      failed: 'Das Signal ließ sich nicht einspielen.',
    },
    time: {
      label: 'Zeit',
      clock: 'Demo-Uhr',
      newDay: 'Neuer Tag (06:00-Lauf)',
      hour: 'Eine Stunde weiter',
      jump: 'Auf Datum springen',
      station: 'Station',
      go: 'Springen',
      later: 'Termin beenden, Monat vorspulen und Stand laden folgen mit K3 und K4.',
      moved: (clock: string, runs: number) =>
        runs === 0
          ? `Uhr auf ${clock}, kein Lauf fällig.`
          : `Uhr auf ${clock}, ${runs} ${plural(runs, 'Lauf', 'Läufe')} ausgeführt.`,
      failed: 'Die Uhr ließ sich nicht vorstellen.',
    },
    role: {
      label: 'Rolle',
      janLuka: 'Jan-Luka · SRO',
      saraOst: 'Sara Ost · Lead',
      kimKaiser: 'Kim Kaiser · Rheintal',
      active: 'aktiv',
      note: 'Kim Kaiser hat eine eigene Akte mit eigener Seite. Die Rolle wechselt das Fenster, nicht die Daten.',
    },
    counterpart: {
      label: 'Gegenüber',
      one: 'Ein Fenster',
      later: 'Zwei Fenster und der Simulator für Kim Kaiser folgen mit K5 (SI-01).',
    },
    ai: {
      label: 'Antworten der KI',
      modes: { record: 'Aufzeichnen', replay: 'Abspielen', live: 'Live', fake: 'Testmodell' },
      note: 'Abspielen läuft jedes Mal gleich. Live beweist, dass nichts gestellt ist.',
      failed: 'Der Modus ließ sich nicht umstellen.',
    },
    reset: {
      label: 'Zurücksetzen',
      text: 'Demo auf Mo 23.11., 07:30 zurücksetzen. Alle eingespielten Signale und Entscheidungen gehen verloren.',
      action: 'Zurücksetzen',
      question: 'Wirklich zurücksetzen?',
      confirm: 'Ja, zurücksetzen',
      cancel: 'Abbrechen',
      done: (clock: string) => `Zurückgesetzt auf ${clock}.`,
      missing: 'Es gibt noch keinen Stand. Erst pnpm demo:nordwind ausführen.',
      failed: 'Das Zurücksetzen ist fehlgeschlagen.',
    },
  },
  en: {
    title: 'Demo control',
    where: 'Only in the Nordwind demo tenant · opens with ⌥D on any page · customers never see it',
    loading: 'Loading the demo control …',
    failed: 'The demo control could not be loaded.',
    retry: 'Try again',
    notDemo: 'The demo control only exists in the demo tenant.',
    scenario: {
      label: 'Scenario',
      ready: 'ready',
      follows: (pkg: string) => `comes with ${pkg}`,
      items: {
        morgen: { title: 'Morning with Reziproq', detail: 'Today, quick review, done · 5 min' },
        warum: { title: 'Why €63k?', detail: 'Folder and derivation · 2 min' },
        mail: {
          title: 'Mail in, commitment out',
          detail: 'Mail from Kim Kaiser, commitments, confirmation · 5 min',
        },
        jbp: { title: 'JBP week', detail: 'Briefing, meeting, minutes with commitments · 10 min' },
        monat: {
          title: 'Fast-forward a month',
          detail: 'Value engine books, controlling confirms · 5 min',
        },
        deal: { title: 'Deal with Rheintal', detail: 'Two windows, Kim Kaiser confirms · 10 min' },
        privat: {
          title: 'Private stays private',
          detail: 'Switch role, look for the target price · 3 min',
        },
        autonomie: {
          title: 'Autonomy is earned',
          detail: 'Set the acceptance rate, accept the offer · 3 min',
        },
        strategie: {
          title: 'Strategy works',
          detail: 'Record the approval, confirm mandate proposals · 5 min',
        },
        kanaele: {
          title: 'Channels',
          detail: 'Approval in chat, briefing in the calendar, check mail, voice · 5 min',
        },
        warengruppe: {
          title: 'Category steers itself',
          detail: 'Assumption flips, shares, award with agent negotiation, review · 8 min',
        },
      } satisfies Record<DemoScenarioKey, Scenario>,
    },
    signals: {
      label: 'Play signals',
      mailKimKaiser: 'Mail from Kim Kaiser',
      note: 'Every signal runs through the same services as in production: triage, workers, drafts, done.',
      more: 'Silesia Guss delivery delay, Rheintal rush call-off, Rheintal reports delivery performance, Rheintal proposes a deal, set acceptance rate, copper price +8 %, copper offer mail, Moldau first sample delayed and multilayer offers come with their chapters.',
      played: (where: 'filed' | 'review' | 'other'): string =>
        where === 'filed'
          ? 'Mail from Kim Kaiser is in: Reziproq assigned it itself (done).'
          : where === 'review'
            ? 'Mail from Kim Kaiser is in: the assignment waits in quick review.'
            : 'Mail from Kim Kaiser is in.',
      failed: 'The signal could not be played.',
    },
    time: {
      label: 'Time',
      clock: 'Demo clock',
      newDay: 'New day (06:00 run)',
      hour: 'One hour later',
      jump: 'Jump to a date',
      station: 'Station',
      go: 'Jump',
      later: 'End meeting, fast-forward a month and load state come with K3 and K4.',
      moved: (clock: string, runs: number) =>
        runs === 0
          ? `Clock at ${clock}, no run due.`
          : `Clock at ${clock}, ${runs} ${plural(runs, 'run', 'runs')} done.`,
      failed: 'The clock could not be moved.',
    },
    role: {
      label: 'Role',
      janLuka: 'Jan-Luka · SRO',
      saraOst: 'Sara Ost · Lead',
      kimKaiser: 'Kim Kaiser · Rheintal',
      active: 'active',
      note: 'Kim Kaiser has her own file with her own page. The role changes the window, not the data.',
    },
    counterpart: {
      label: 'Counterpart',
      one: 'One window',
      later: 'Two windows and the simulator for Kim Kaiser come with K5 (SI-01).',
    },
    ai: {
      label: 'AI answers',
      modes: { record: 'Record', replay: 'Replay', live: 'Live', fake: 'Test model' },
      note: 'Replay runs the same every time. Live proves that nothing is staged.',
      failed: 'The mode could not be changed.',
    },
    reset: {
      label: 'Reset',
      text: 'Reset the demo to Mon 23 Nov, 07:30. All played signals and decisions are lost.',
      action: 'Reset',
      question: 'Really reset?',
      confirm: 'Yes, reset',
      cancel: 'Cancel',
      done: (clock: string) => `Reset to ${clock}.`,
      missing: 'There is no state yet. Run pnpm demo:nordwind first.',
      failed: 'The reset failed.',
    },
  },
});
