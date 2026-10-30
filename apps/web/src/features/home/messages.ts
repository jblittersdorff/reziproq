import { defineMessages } from '@/lib/i18n';

export const homeMessages = defineMessages({
  de: {
    welcome: 'Melde dich mit deinem Firmenkonto an, um deine Lieferantenbeziehungen zu öffnen.',
    signIn: 'Anmelden',
    signOut: 'Abmelden',
    account: 'Dein Konto',
    name: 'Name',
    email: 'E-Mail',
    connection: 'Verbindung',
    loading: 'Lade …',
    apiOk: 'API: ok',
    apiChecking: 'API: wird geprüft …',
    apiDown: 'API: nicht erreichbar',
    meFailed: 'Dein Konto konnte nicht geladen werden.',
  },
  en: {
    welcome: 'Sign in with your company account to open your supplier relationships.',
    signIn: 'Sign in',
    signOut: 'Sign out',
    account: 'Your account',
    name: 'Name',
    email: 'Email',
    connection: 'Connection',
    loading: 'Loading …',
    apiOk: 'API: ok',
    apiChecking: 'API: checking …',
    apiDown: 'API: not reachable',
    meFailed: 'Your account could not be loaded.',
  },
});
