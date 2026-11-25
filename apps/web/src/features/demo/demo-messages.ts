import { defineMessages } from '@/lib/i18n';

// DM-01, E-K0-05 (K1-b.2): Demo-Sitzung je Person

export const demoMessages = defineMessages({
  de: {
    starting: 'Die Demo-Sitzung wird gestartet …',
    failedTitle: 'Keine Demo-Sitzung',
    failedText:
      'Diese Person gibt es im Demo-Mandanten nicht, oder Demo-Sitzungen sind ausgeschaltet. Sie laufen nur lokal mit DEMO_SESSIONS=true.',
    started: (name: string, organization: string) => `Angemeldet als ${name} · ${organization}`,
    open: 'Weiter',
    home: 'Zur Startseite',
  },
  en: {
    starting: 'Starting the demo session …',
    failedTitle: 'No demo session',
    failedText:
      'This person does not exist in the demo tenant, or demo sessions are switched off. They only run locally with DEMO_SESSIONS=true.',
    started: (name: string, organization: string) => `Signed in as ${name} · ${organization}`,
    open: 'Continue',
    home: 'To the start page',
  },
});
