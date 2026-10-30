import type { Messages } from './de';

// Englische Texte; die Schlüssel kommen aus de.ts. Die englische Oberfläche kommt mit PLT-09.
export const en: Messages = {
  app: {
    name: 'Reziproq',
    navigation: 'Main navigation',
    openNavigation: 'Open navigation',
    closeNavigation: 'Close navigation',
    skipToContent: 'Skip to content',
  },

  nav: {
    overview: 'Overview',
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
    backHome: 'Back to overview',
  },

  comingWith: (release: string) => `Coming with release ${release}`,

  overview: {
    title: 'Overview',
    greetingMorning: (firstName: string) => `Good morning, ${firstName}`,
    greetingDay: (firstName: string) => `Good afternoon, ${firstName}`,
    greetingEvening: (firstName: string) => `Good evening, ${firstName}`,
    greetingWithoutName: 'Welcome to Reziproq',
    areas: 'Areas',
  },

  areas: {
    suppliers: {
      title: 'Suppliers',
      sentence:
        'Which suppliers really matter – by business impact and relationship quality, not just spend.',
      emptyDescription:
        'This is where supplier segmentation by business impact and relationship quality will live.',
    },
    relationships: {
      title: 'Relationships',
      sentence: 'Rights and duties per relationship type, roles and contacts on both sides.',
      emptyDescription:
        'This is where playbooks per relationship type, with roles and contacts on both sides, will live.',
    },
    pulse: {
      title: 'Relationship pulse',
      sentence: 'How both sides see the relationship – today and as desired.',
      emptyDescription: 'This is where buyer and supplier will regularly assess the relationship.',
    },
    jointBusinessPlans: {
      title: 'Joint business plans',
      sentence: 'Shared goals, initiatives and KPIs with strategic suppliers.',
      emptyDescription:
        'This is where joint plans with goals, initiatives and KPIs for strategic suppliers will live.',
    },
    qbrs: {
      title: 'QBRs and actions',
      sentence: 'Review progress regularly, follow up on commitments, steer actions.',
      emptyDescription:
        'This is where quarterly reviews with progress, commitments and actions will live.',
    },
    pnlImpact: {
      title: 'P&L impact',
      sentence: 'Which value from the collaboration reaches the P&L – evidenced and signed off.',
      emptyDescription:
        'This is where you will trace which initiatives move which P&L line, up to sign-off by controlling.',
    },
  },

  settings: {
    title: 'Settings',
    purpose: 'Set up Reziproq the way it suits you.',
    display: 'Display',
    theme: 'Appearance',
    themeDescription: 'System follows your device setting.',
    themeSystem: 'System',
    themeLight: 'Light',
    themeDark: 'Dark',
    organization: 'Organization',
    organizationTitle: 'Nothing to set up yet',
    organizationDescription:
      'This is where you will manage your organization. Only admins see this section.',
  },

  suppliers: {
    count: (count: number) => (count === 1 ? '1 supplier' : `${count} suppliers`),
    totalSpend: (amount: string, year: number) => `${amount} annual spend ${year}`,
    search: 'Search supplier or category',
    searchPlaceholder: 'Name or category',
    sort: 'Sort',
    sortSpend: 'Spend, highest first',
    sortName: 'Name, A to Z',
    country: 'Country',
    category: 'Category',
    annualSpend: (year: number) => `Annual spend ${year}`,
    loading: 'Loading suppliers …',
    failed: 'The suppliers could not be loaded. Reload the page.',
    emptyTitle: 'No suppliers yet.',
    emptyDescription: 'With the import (coming in release 0.1) you load them from Excel.',
    noResults: (query: string) => `No suppliers matching “${query}”.`,
    noPermissionTitle: 'You are missing a role',
    noPermissionDescription:
      'To see suppliers, you need a buyer role in Reziproq. Contact your admin.',
    tileNoOrganization: 'Not assigned to an organization',
    tileNoPermission: 'No role for suppliers',
  },

  prompt: {
    title: 'Ask Reziproq',
    placeholder: 'Ask Reziproq …',
    question: 'Your question to Reziproq',
    send: 'Ask',
    shortcutMac: '⌘ K',
    shortcutOther: 'Ctrl K',
    suggestions: 'Suggestions',
    suggestionTopSpend: 'Show me the suppliers with the highest spend',
    suggestionElectronics: 'Which suppliers do we have in the electronics category?',
    suggestionPulse: 'Open the relationship pulse',
    answering: 'Reziproq is answering …',
    hits: 'Results',
    noHits: 'No results',
    failed: 'No answer possible right now. Please try again shortly.',
    rateLimited: 'You have asked a lot of questions just now. Please wait a minute.',
    restart: 'Start over',
    disclaimer: 'Answers are based only on data you are allowed to see. Please check.',
  },

  support: {
    switchCustomer: 'Switch customer',
    dialogTitle: 'Switch to a customer',
    dialogDescription: 'You then see Reziproq the way this customer does. Every access is logged.',
    loading: 'Loading customers …',
    failed: 'The customers could not be loaded.',
    empty: 'There are no customers yet.',
    banner: (customer: string) => `Operator view: ${customer}. Every access is logged.`,
    leave: 'Leave',
    chooseCustomer:
      'You are not assigned to an organization. As an operator, choose “Switch customer” in the account menu.',
  },

  organization: {
    missing: 'You are not assigned to an organization yet. Contact your admin.',
  },

  notFound: {
    title: 'This page does not exist',
    description: 'The address may have changed, or it contains a typo.',
    back: 'Back to overview',
  },
};
