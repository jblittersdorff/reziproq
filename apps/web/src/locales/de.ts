// Alle Texte der App auf Deutsch. Diese Datei ist die Quelle: en.ts muss dieselben Schlüssel haben,
// sonst schlägt pnpm typecheck fehl.

export const de = {
  app: {
    name: 'Reziproq',
    navigation: 'Hauptnavigation',
    openNavigation: 'Navigation öffnen',
    closeNavigation: 'Navigation schließen',
  },

  nav: {
    overview: 'Übersicht',
    suppliers: 'Lieferanten',
    relationships: 'Beziehungen',
    pulse: 'Beziehungspuls',
    jointBusinessPlans: 'Joint Business Plans',
    qbrs: 'QBRs und Maßnahmen',
    pnlImpact: 'P&L-Impact',
    settings: 'Einstellungen',
  },

  user: {
    menu: 'Konto-Menü',
    loading: 'Konto wird geladen …',
    failed: 'Konto nicht geladen',
    settings: 'Einstellungen',
    signOut: 'Abmelden',
  },

  auth: {
    welcome: 'Melde dich mit deinem Firmenkonto an, um deine Lieferantenbeziehungen zu öffnen.',
    signIn: 'Anmelden',
    checking: 'Anmeldung wird geprüft …',
    failedTitle: 'Anmeldung fehlgeschlagen',
    failedDescription: 'Zitadel hat die Anmeldung nicht bestätigt. Versuche es noch einmal.',
    retry: 'Erneut anmelden',
    notConfiguredTitle: 'Login ist noch nicht eingerichtet',
    notConfiguredDescription:
      'Trage ZITADEL_ISSUER und ZITADEL_CLIENT_ID in die .env ein und starte die App neu.',
    backHome: 'Zur Startseite',
  },

  comingWith: (release: string) => `Kommt mit Release ${release}`,

  pages: {
    overview: {
      title: 'Übersicht',
      purpose: 'Alles Wichtige zu deinen strategischen Lieferantenbeziehungen auf einen Blick.',
      emptyTitle: 'Noch nichts zu zeigen',
      emptyDescription: 'Die Übersicht füllt sich, sobald die ersten Lieferanten angelegt sind.',
    },
    suppliers: {
      title: 'Lieferanten',
      purpose: 'Lieferanten nach Warengruppe und strategischer Bedeutung segmentieren.',
      emptyTitle: 'Noch keine Lieferanten',
      emptyDescription: 'Hier legst du Lieferanten an und ordnest sie Segmenten zu.',
    },
    relationships: {
      title: 'Beziehungen',
      purpose: 'Jede Beziehung mit Playbook und klaren Rollen auf beiden Seiten führen.',
      emptyTitle: 'Noch keine Beziehungen',
      emptyDescription: 'Hier richtest du je Lieferant das Playbook und die Rollen ein.',
    },
    pulse: {
      title: 'Beziehungspuls',
      purpose: 'Regelmäßig messen, wie Käufer und Lieferant die Zusammenarbeit erleben.',
      emptyTitle: 'Noch kein Puls',
      emptyDescription:
        'Hier siehst du, wie sich die Zusammenarbeit aus beiden Sichten entwickelt.',
    },
    jointBusinessPlans: {
      title: 'Joint Business Plans',
      purpose: 'Gemeinsame Ziele und Initiativen mit dem Lieferanten planen.',
      emptyTitle: 'Noch keine Joint Business Plans',
      emptyDescription: 'Hier plant ihr gemeinsame Ziele und Initiativen für das Jahr.',
    },
    qbrs: {
      title: 'QBRs und Maßnahmen',
      purpose: 'Quartalsgespräche vorbereiten und Maßnahmen bis zum Abschluss verfolgen.',
      emptyTitle: 'Noch keine QBRs',
      emptyDescription:
        'Hier bereitet ihr Quartalsgespräche vor und verfolgt die vereinbarten Maßnahmen.',
    },
    pnlImpact: {
      title: 'P&L-Impact',
      purpose:
        'Die GuV-Wirkung gemeinsamer Initiativen nachvollziehen, von der Baseline bis zur Freigabe durch Controlling.',
      emptyTitle: 'Noch keine Wirkung erfasst',
      emptyDescription: 'Hier siehst du, welche Initiativen welche GuV-Zeile wie stark bewegen.',
    },
    settings: {
      title: 'Einstellungen',
      purpose: 'Darstellung und Konto verwalten.',
    },
  },

  settings: {
    display: 'Darstellung',
    theme: 'Erscheinungsbild',
    themeDescription: 'System folgt der Einstellung deines Geräts.',
    themeSystem: 'System',
    themeLight: 'Hell',
    themeDark: 'Dunkel',
    language: 'Sprache',
    // Sprachnamen stehen immer in der eigenen Sprache.
    languageDe: 'Deutsch',
    languageEn: 'English',
    account: 'Konto',
    name: 'Name',
    email: 'E-Mail',
    connection: 'Verbindung',
    loading: 'Lade …',
    accountFailed: 'Dein Konto konnte nicht geladen werden.',
    apiOk: 'API: ok',
    apiChecking: 'API: wird geprüft …',
    apiDown: 'API: nicht erreichbar',
  },
};

export type Messages = typeof de;
