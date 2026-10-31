// Alle Texte der App auf Deutsch. Diese Datei ist die Quelle: en.ts muss dieselben Schlüssel haben,
// sonst schlagen pnpm typecheck und der Test in locales.test.ts fehl.

export const de = {
  app: {
    name: 'Reziproq',
    navigation: 'Hauptnavigation',
    openMenu: 'Menü öffnen',
    skipToContent: 'Zum Inhalt springen',
    path: 'Pfad',
    backTo: (page: string) => `Zurück zu ${page}`,
  },

  // Ziele der globalen Leiste (PLT-11)
  nav: {
    start: 'Start',
    suppliers: 'Lieferanten',
    portfolio: 'Portfolio',
    impact: 'Wirkung',
    questions: 'Fragen',
    profile: 'Profil',
  },

  menu: {
    title: 'Menü',
    purpose: 'Alle Bereiche von Reziproq.',
  },

  user: {
    loading: 'Konto wird geladen …',
    failed: 'Konto nicht geladen',
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
    backHome: 'Zu Start',
    reauthTitle: 'Bitte melde dich neu an',
    reauthDescription: 'Deine Sitzung ist abgelaufen. Was du eingegeben hast, bleibt erhalten.',
    reauthAction: 'Neu anmelden',
  },

  start: {
    title: 'Start',
    greetingMorning: (firstName: string) => `Guten Morgen, ${firstName}`,
    greetingDay: (firstName: string) => `Guten Tag, ${firstName}`,
    greetingEvening: (firstName: string) => `Guten Abend, ${firstName}`,
    greetingWithoutName: 'Willkommen bei Reziproq',
    emptyTitle: 'Hier steht bald, was bei dir fällig ist',
    emptyDescription: 'Offene Bewertungen, Termine und Maßnahmen erscheinen hier, sobald es sie gibt.',
  },

  // Seiten, deren Inhalt eine spätere Spec liefert (PLT-11)
  portfolio: {
    title: 'Portfolio',
    purpose: 'Alle Lieferanten nach Business Impact und Beziehungsqualität.',
    emptyTitle: 'Noch kein Portfolio',
    emptyDescription:
      'Sobald Lieferanten bewertet sind, siehst du hier die Matrix und deine Fokuslieferanten.',
  },

  impact: {
    title: 'Wirkung',
    purpose: 'Welcher Wert aus der Zusammenarbeit in der GuV ankommt.',
    emptyTitle: 'Noch keine Wirkung',
    emptyDescription:
      'Sobald gemeinsame Initiativen Wirkung tragen, siehst du hier Pipeline und P&L-Brücke.',
  },

  profile: {
    title: 'Profil',
    purpose: 'Dein Konto, deine Darstellung und der Weg zu den Einstellungen.',
    account: 'Konto',
    name: 'Name',
    email: 'E-Mail',
    organization: 'Organisation',
    noOrganization: 'Keiner Organisation zugeordnet',
    display: 'Darstellung',
    theme: 'Erscheinungsbild',
    themeSystem: 'System',
    themeLight: 'Hell',
    themeDark: 'Dunkel',
    settings: 'Einstellungen',
    allSettings: 'Alle Einstellungen',
    roles: 'Deine Rollen in Reziproq',
    rolesDescription: 'So, wie sie im Token von Zitadel ankommen.',
    rolesNone: 'Keine',
    rolesNoneHint:
      'Zitadel schickt keine Rollen im Token. Prüfe im Zitadel-Projekt „Rollen bei Authentifizierung mitgeben“ und ob dir eine Rolle zugewiesen ist. Danach ab- und wieder anmelden.',
  },

  appearance: {
    title: 'Erscheinungsbild',
    purpose: 'Wie Reziproq auf diesem Gerät aussieht.',
    description: 'System folgt der Einstellung deines Geräts.',
    save: 'Speichern',
    cancel: 'Abbrechen',
  },

  settings: {
    title: 'Einstellungen',
    purpose: 'Reziproq für deine Organisation einrichten.',
    adminOnly: 'Die Einstellungen kann nur ein Admin ändern. Deine Organisation siehst du trotzdem.',
    organization: 'Organisation',
    organizationHint: 'Name, Land und Mitglieder',
    organizationPurpose: 'Name, Land und Mitglieder deiner Organisation. Nur zum Lesen.',
    organizationName: 'Name',
    organizationCountry: 'Land',
    members: 'Mitglieder',
    memberName: 'Name',
    memberEmail: 'E-Mail',
    organizationLoading: 'Organisation wird geladen …',
    organizationFailed: 'Die Organisation konnte nicht geladen werden.',
    noOrganization: 'Du bist keiner Organisation zugeordnet.',
  },

  // Lieferantenliste (PLT-02)
  suppliers: {
    title: 'Lieferanten',
    purpose:
      'Welche Lieferanten wirklich zählen – nach Business Impact und Beziehungsqualität, nicht nur nach Spend.',
    count: (count: number) => (count === 1 ? '1 Lieferant' : `${count} Lieferanten`),
    totalSpend: (amount: string, year: number) => `${amount} Jahresspend ${year}`,
    search: 'Lieferant oder Warengruppe suchen',
    searchPlaceholder: 'Name oder Warengruppe',
    sort: 'Sortieren',
    sortSpend: 'Spend, höchster zuerst',
    sortName: 'Name, A bis Z',
    country: 'Land',
    category: 'Warengruppe',
    annualSpend: (year: number) => `Jahresspend ${year}`,
    loading: 'Lieferanten werden geladen …',
    failed: 'Die Lieferanten konnten nicht geladen werden. Lade die Seite neu.',
    emptyTitle: 'Noch keine Lieferanten.',
    emptyDescription: 'Mit dem Import (kommt in Release 0.1) lädst du sie aus Excel.',
    noResults: (query: string) => `Keine Lieferanten zu „${query}“.`,
    noPermissionTitle: 'Dir fehlt eine Rolle',
    noPermissionDescription:
      'Um Lieferanten zu sehen, brauchst du in Reziproq eine Käufer-Rolle. Wende dich an deinen Admin.',
  },

  // Fragen (PLT-12), seit PLT-11 als Seite /fragen
  prompt: {
    title: 'Frag Reziproq',
    placeholder: 'Frag Reziproq …',
    question: 'Deine Frage an Reziproq',
    send: 'Fragen',
    shortcutMac: '⌘ K',
    shortcutOther: 'Strg K',
    suggestions: 'Vorschläge',
    suggestionTopSpend: 'Zeig mir die Lieferanten mit dem höchsten Spend',
    suggestionElectronics: 'Welche Lieferanten haben wir in der Warengruppe Elektronik?',
    suggestionPortfolio: 'Öffne das Portfolio',
    answering: 'Reziproq antwortet …',
    hits: 'Treffer',
    noHits: 'Keine Treffer',
    failed: 'Gerade keine Antwort möglich. Versuch es gleich noch einmal.',
    rateLimited: 'Du hast gerade sehr viele Fragen gestellt. Warte eine Minute.',
    restart: 'Neu beginnen',
    disclaimer: 'Antworten beruhen nur auf Daten, die du sehen darfst. Bitte prüfen.',
  },

  // Betreiber-Zugang (PLT-13)
  support: {
    switchCustomer: 'Kunde wechseln',
    dialogTitle: 'In einen Kunden wechseln',
    dialogDescription:
      'Du siehst Reziproq dann so wie dieser Kunde. Jeder Zugriff wird protokolliert.',
    loading: 'Kunden werden geladen …',
    failed: 'Die Kunden konnten nicht geladen werden.',
    empty: 'Es gibt noch keine Kunden.',
    banner: (customer: string) =>
      `Betreiber-Ansicht: ${customer}. Alle Zugriffe werden protokolliert.`,
    leave: 'Verlassen',
    chooseCustomer:
      'Du bist keiner Organisation zugeordnet. Wähle als Betreiber auf deinem Profil „Kunde wechseln“.',
  },

  organization: {
    missing:
      'Deine Organisation ist noch nicht freigeschaltet. Wende dich an deinen Ansprechpartner.',
    // PLT-02: Organisation ohne Feature buyer; die Lieferantenansicht kommt mit Release 0.2.
    supplierAccessSoon: 'Der Lieferantenzugang kommt bald.',
  },

  notFound: {
    title: 'Diese Seite gibt es nicht',
    description: 'Vielleicht hat sich die Adresse geändert, oder sie enthält einen Tippfehler.',
    back: 'Zu Start',
  },
};

export type Messages = typeof de;
