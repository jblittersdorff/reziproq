import type { Messages } from './de';

// Englische Texte; die Schlüssel kommen aus de.ts. Die englische Oberfläche kommt mit PLT-09.
export const en: Messages = {
  app: {
    name: 'Reziproq',
    navigation: 'Main navigation',
    openMenu: 'Open menu',
    skipToContent: 'Skip to content',
    path: 'Path',
    backTo: (page: string) => `Back to ${page}`,
  },

  nav: {
    start: 'Start',
    suppliers: 'Suppliers',
    portfolio: 'Portfolio',
    impact: 'Impact',
    questions: 'Questions',
    profile: 'Profile',
  },

  menu: {
    title: 'Menu',
    purpose: 'All areas of Reziproq.',
  },

  user: {
    loading: 'Loading account …',
    failed: 'Account not loaded',
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
    backHome: 'Go to Start',
    reauthTitle: 'Please sign in again',
    reauthDescription: 'Your session has expired. Everything you entered stays where it is.',
    reauthAction: 'Sign in again',
  },

  start: {
    title: 'Start',
    greetingMorning: (firstName: string) => `Good morning, ${firstName}`,
    greetingDay: (firstName: string) => `Good afternoon, ${firstName}`,
    greetingEvening: (firstName: string) => `Good evening, ${firstName}`,
    greetingWithoutName: 'Welcome to Reziproq',
    emptyTitle: 'Soon you will see what is due for you here',
    emptyDescription:
      'Open assessments, meetings and actions appear here as soon as there are any.',
  },

  portfolio: {
    title: 'Portfolio',
    purpose: 'All suppliers by business impact and relationship quality.',
    emptyTitle: 'No portfolio yet',
    emptyDescription:
      'Once suppliers are assessed, you will see the matrix and your focus suppliers here.',
  },

  impact: {
    title: 'Impact',
    purpose: 'Which value from the collaboration reaches the P&L.',
    emptyTitle: 'No impact yet',
    emptyDescription:
      'Once joint initiatives carry impact, you will see the pipeline and P&L bridge here.',
  },

  profile: {
    title: 'Profile',
    purpose: 'Your account, your display and the way to the settings.',
    account: 'Account',
    name: 'Name',
    email: 'Email',
    organization: 'Organization',
    noOrganization: 'Not assigned to an organization',
    display: 'Display',
    theme: 'Appearance',
    themeSystem: 'System',
    themeLight: 'Light',
    themeDark: 'Dark',
    settings: 'Settings',
    allSettings: 'All settings',
    roles: 'Your roles in Reziproq',
    rolesDescription: 'As they arrive in the token from Zitadel.',
    rolesNone: 'None',
    rolesNoneHint:
      'Zitadel sends no roles in the token. In the Zitadel project, check “Assert roles on authentication” and whether a role is assigned to you. Then sign out and in again.',
  },

  appearance: {
    title: 'Appearance',
    purpose: 'How Reziproq looks on this device.',
    description: 'System follows your device setting.',
    save: 'Save',
    cancel: 'Cancel',
  },

  settings: {
    title: 'Settings',
    purpose: 'Set up Reziproq for your organization.',
    adminOnly: 'Only an admin can change the settings. You can still view your organization.',
    organization: 'Organization',
    organizationHint: 'Name, country and members',
    organizationPurpose: 'Name, country and members of your organization. Read only.',
    organizationName: 'Name',
    organizationCountry: 'Country',
    members: 'Members',
    memberName: 'Name',
    memberEmail: 'Email',
    organizationLoading: 'Loading organization …',
    organizationFailed: 'The organization could not be loaded.',
    noOrganization: 'You are not assigned to an organization.',
  },

  audit: {
    title: 'History',
    loading: 'Loading history …',
    failed: 'The history could not be loaded.',
    emptyTitle: 'No changes yet',
    emptyDescription:
      'As soon as someone changes something, it appears here with date and organization.',
    change: (field: string, from: string, to: string) => `${field}: ${from} → ${to}`,
    actions: {
      created: 'Created',
      updated: 'Changed',
      ended: 'Ended',
      shared: 'Shared',
      approved: 'Approved',
    },
    fields: {
      status: 'Status',
    } as Record<string, string>,
    values: {
      status: { draft: 'draft', active: 'active', ended: 'ended' },
    } as Record<string, Record<string, string>>,
  },

  suppliers: {
    title: 'Suppliers',
    purpose:
      'Which suppliers really matter – by business impact and relationship quality, not just spend.',
    count: (count: number) => (count === 1 ? '1 supplier' : `${count} suppliers`),
    totalSpend: (amount: string, year: number) => `${amount} annual spend ${year}`,
    search: 'Search supplier or own number',
    searchPlaceholder: 'Name or own number',
    sort: 'Sort',
    sortSpend: 'Spend, highest first',
    sortName: 'Name, A to Z',
    country: 'Country',
    externalRef: 'Own number',
    annualSpend: (year: number) => `Annual spend ${year}`,
    showEnded: 'Show ended',
    statusDraft: 'Draft',
    statusEnded: 'Ended',
    loading: 'Loading suppliers …',
    failed: 'The suppliers could not be loaded. Reload the page.',
    emptyTitle: 'No suppliers yet.',
    emptyDescription: 'Add the first one or import a list.',
    noResults: (query: string) => `No suppliers matching “${query}”.`,
    noPermissionTitle: 'You are missing a role',
    noPermissionDescription:
      'To see suppliers, you need a buyer role in Reziproq. Contact your admin.',
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
    suggestionCountry: 'Which suppliers do we have in Poland?',
    suggestionPortfolio: 'Open the portfolio',
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
      'You are not assigned to an organization. As an operator, choose “Switch customer” on your profile.',
  },

  organization: {
    missing: 'Your organization has not been activated yet. Contact your account manager.',
    supplierAccessSoon: 'Supplier access is coming soon.',
  },

  notFound: {
    title: 'This page does not exist',
    description: 'The address may have changed, or it contains a typo.',
    back: 'Go to Start',
  },
};
