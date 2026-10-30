import type { Messages } from './de';

// Englische Texte; die Schlüssel kommen aus de.ts.
export const en: Messages = {
  app: {
    name: 'Reziproq',
    navigation: 'Main navigation',
    openNavigation: 'Open navigation',
    closeNavigation: 'Close navigation',
  },

  nav: {
    overview: 'Overview',
    suppliers: 'Suppliers',
    relationships: 'Relationships',
    pulse: 'Relationship pulse',
    jointBusinessPlans: 'Joint business plans',
    qbrs: 'QBRs and actions',
    pnlImpact: 'P&L impact',
    settings: 'Settings',
  },

  user: {
    menu: 'Account menu',
    loading: 'Loading account …',
    failed: 'Account not loaded',
    settings: 'Settings',
    signOut: 'Sign out',
  },

  auth: {
    welcome: 'Sign in with your company account to open your supplier relationships.',
    signIn: 'Sign in',
    checking: 'Checking sign-in …',
    failedTitle: 'Sign-in failed',
    failedDescription: 'Zitadel did not confirm the sign-in. Please try again.',
    retry: 'Sign in again',
    notConfiguredTitle: 'Sign-in is not set up yet',
    notConfiguredDescription:
      'Add ZITADEL_ISSUER and ZITADEL_CLIENT_ID to the .env file and restart the app.',
    backHome: 'Back to start page',
  },

  comingWith: (release: string) => `Coming with release ${release}`,

  pages: {
    overview: {
      title: 'Overview',
      purpose: 'Everything important about your strategic supplier relationships at a glance.',
      emptyTitle: 'Nothing to show yet',
      emptyDescription: 'The overview fills up as soon as the first suppliers are added.',
    },
    suppliers: {
      title: 'Suppliers',
      purpose: 'Segment suppliers by category and strategic importance.',
      emptyTitle: 'No suppliers yet',
      emptyDescription: 'This is where you add suppliers and assign them to segments.',
    },
    relationships: {
      title: 'Relationships',
      purpose: 'Run every relationship with a playbook and clear roles on both sides.',
      emptyTitle: 'No relationships yet',
      emptyDescription: 'This is where you set up the playbook and roles for each supplier.',
    },
    pulse: {
      title: 'Relationship pulse',
      purpose: 'Regularly measure how buyer and supplier experience the collaboration.',
      emptyTitle: 'No pulse yet',
      emptyDescription: 'This is where you see how the collaboration develops from both sides.',
    },
    jointBusinessPlans: {
      title: 'Joint business plans',
      purpose: 'Plan shared goals and initiatives with the supplier.',
      emptyTitle: 'No joint business plans yet',
      emptyDescription: 'This is where you plan shared goals and initiatives for the year.',
    },
    qbrs: {
      title: 'QBRs and actions',
      purpose: 'Prepare quarterly business reviews and track actions until they are done.',
      emptyTitle: 'No QBRs yet',
      emptyDescription: 'This is where you prepare quarterly reviews and track the agreed actions.',
    },
    pnlImpact: {
      title: 'P&L impact',
      purpose:
        'Trace the P&L effect of joint initiatives, from the baseline to sign-off by controlling.',
      emptyTitle: 'No impact recorded yet',
      emptyDescription:
        'This is where you see which initiatives move which P&L line, and by how much.',
    },
    settings: {
      title: 'Settings',
      purpose: 'Manage display and account.',
    },
  },

  settings: {
    display: 'Display',
    theme: 'Appearance',
    themeDescription: 'System follows your device setting.',
    themeSystem: 'System',
    themeLight: 'Light',
    themeDark: 'Dark',
    language: 'Language',
    languageDe: 'Deutsch',
    languageEn: 'English',
    account: 'Account',
    name: 'Name',
    email: 'Email',
    connection: 'Connection',
    loading: 'Loading …',
    accountFailed: 'Your account could not be loaded.',
    apiOk: 'API: ok',
    apiChecking: 'API: checking …',
    apiDown: 'API: not reachable',
  },
};
