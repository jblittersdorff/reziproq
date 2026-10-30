import { defineMessages } from '@/lib/i18n';

export const authMessages = defineMessages({
  de: {
    checking: 'Anmeldung wird geprüft …',
    failedTitle: 'Anmeldung fehlgeschlagen',
    failedDescription: 'Zitadel hat die Anmeldung nicht bestätigt. Versuche es noch einmal.',
    retry: 'Erneut anmelden',
    notConfiguredTitle: 'Login ist noch nicht eingerichtet',
    notConfiguredDescription:
      'Trage ZITADEL_ISSUER und ZITADEL_CLIENT_ID in die .env ein und starte die App neu.',
    backHome: 'Zur Startseite',
  },
  en: {
    checking: 'Checking sign-in …',
    failedTitle: 'Sign-in failed',
    failedDescription: 'Zitadel did not confirm the sign-in. Please try again.',
    retry: 'Sign in again',
    notConfiguredTitle: 'Sign-in is not set up yet',
    notConfiguredDescription:
      'Add ZITADEL_ISSUER and ZITADEL_CLIENT_ID to the .env file and restart the app.',
    backHome: 'Back to start page',
  },
});
