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

  notFound: {
    title: 'This page does not exist',
    description: 'The address may have changed, or it contains a typo.',
    back: 'Back to overview',
  },
};
