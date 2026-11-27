import { defineMessages } from '@/lib/i18n';

// AK-01 (K2-c.5): Texte der Blätter Profil (Vorlage K2-Profil), Spielregeln und Kennzahl-Verlauf
// (E-K4-4). Allgemeine Texte (Gruppen der Spielregeln, Takte, Ebenen, Rollen) kommen aus den
// Sprachdateien.

/** „A“, „A und B“, „A, B und C“ */
function listDe(parts: string[]): string {
  return parts.length <= 1
    ? (parts[0] ?? '')
    : `${parts.slice(0, -1).join(', ')} und ${parts.at(-1)}`;
}
function listEn(parts: string[]): string {
  return parts.length <= 1
    ? (parts[0] ?? '')
    : `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`;
}

const ordinalsDe = ['größter', 'zweitgrößter', 'drittgrößter', 'viertgrößter', 'fünftgrößter'];
const ordinalsEn = [
  'largest',
  'second-largest',
  'third-largest',
  'fourth-largest',
  'fifth-largest',
];

export const akteSheetMessages = defineMessages({
  de: {
    close: 'Schließen',
    failed: 'Konnte nicht geladen werden.',
    loading: 'Wird geladen',
    profile: {
      title: 'Profil',
      subtitle: (legalName: string) => `${legalName} · Stammdaten aus dem Import`,
      heading: 'Zusammengefasst von Reziproq',
      /** „Rheintal Elektronik wächst seit 2024 jedes Jahr und ist mit 4,2 Mio. € euer zweitgrößter Lieferant.“ */
      statement: (name: string, since: number | null, amount: string, rank: number) => {
        const place =
          rank <= ordinalsDe.length
            ? `euer ${ordinalsDe[rank - 1]} Lieferant`
            : `nach Spend euer Lieferant Nr. ${rank}`;
        return since
          ? `${name} wächst seit ${since} jedes Jahr und ist mit ${amount} ${place}.`
          : `${name} ist mit ${amount} ${place}.`;
      },
      noWire: (names: string[]) => `Zu ${listDe(names)} fehlt der direkte Draht`,
      masterData: 'Stammdaten',
      groups: 'Warengruppen',
      units: 'Business Units',
      externalRef: (ref: string | null) => (ref ? `Externe Nummer ${ref}` : 'Ohne externe Nummer'),
      since: (date: string) => `in Reziproq seit ${date}`,
      vat: (id: string) => `USt-IdNr. ${id}`,
      duns: (id: string) => `DUNS ${id}`,
      spend: 'Spend je Jahr',
      noSpend: 'Noch kein Spend erfasst',
      contacts: (name: string, n: number) => `Kontakte bei ${name} · ${n}`,
      noContacts: 'Noch keine Kontakte',
      noContactsText: 'Kontakte kommen mit dem Import.',
      team: 'Team in Reziproq',
      ownTeam: (n: number) => `Euer Team · ${n}`,
      ownTeamDetail: (names: string) => `${names} · Rollen sieht nur ihr`,
      edit: 'Bearbeiten',
      import: 'Import öffnen',
    },
    rules: {
      title: 'Spielregeln',
      subtitle: (type: string, version: number, state: string) =>
        `„${type}“ · Version ${version} · ${state}`,
      sharedOn: (date: string) => `geteilt am ${date}`,
      unshared: 'Änderungen noch nicht geteilt',
      draft: 'noch nicht geteilt',
      rights: (name: string) => `Rechte von ${name}`,
      duties: (name: string) => `Pflichten von ${name}`,
      formats: 'Formate',
      ongoing: 'laufend',
      targetChanged: (type: string) => `Der Soll-Typ ist jetzt „${type}“`,
      targetChangedText: 'Reziproq schlägt Spielregeln für den neuen Typ vor.',
      share: 'Änderungen teilen',
      edit: 'Bearbeiten',
      approve: 'Freigeben',
      none: 'Noch keine Spielregeln',
      noneText: 'Spielregeln folgen aus dem Segment. Reziproq hat einen Vorschlag.',
    },
    kpi: {
      title: 'Kennzahl',
      subtitle: (side: string, target: string, date: string, owner: string | null) =>
        [side, `Ziel ${target} bis ${date}`, owner].filter(Boolean).join(' · '),
      ownSide: 'eure Seite',
      line: (baseline: string | null, target: string) =>
        baseline ? `Basis ${baseline}, Ziel ${target}` : `Ziel ${target}`,
      latest: (month: string, value: string) => `zuletzt ${value} im ${month}`,
      noValue: 'noch kein Wert',
      chartTitle: (track: string) => `Verlauf · ${track}`,
      chartHint: (tolerance: number) =>
        `Linie von der Basis zum Ziel; „knapp“ heißt bis zu ${tolerance} % dahinter.`,
      actual: 'Ist',
      plan: 'Linie zum Ziel',
      chartEmpty: 'Noch keine Werte',
      chartEmptyHint: 'Werte erfasst die verantwortliche Seite.',
      values: 'Werte',
      valueDetail: (by: string, when: string, source: string) => `${by}, ${when} · ${source}`,
      enter: 'Wert erfassen',
      onlyOwner: (side: string) => `Werte erfasst ${side}.`,
    },
  },
  en: {
    close: 'Close',
    failed: 'Could not be loaded.',
    loading: 'Loading',
    profile: {
      title: 'Profile',
      subtitle: (legalName: string) => `${legalName} · master data from the import`,
      heading: 'Summarised by Reziproq',
      statement: (name: string, since: number | null, amount: string, rank: number) => {
        const place =
          rank <= ordinalsEn.length
            ? `your ${ordinalsEn[rank - 1]} supplier`
            : `your supplier no. ${rank} by spend`;
        return since
          ? `${name} has grown every year since ${since} and is ${place} with ${amount}.`
          : `${name} is ${place} with ${amount}.`;
      },
      noWire: (names: string[]) => `No direct line to ${listEn(names)}`,
      masterData: 'Master data',
      groups: 'Categories',
      units: 'Business units',
      externalRef: (ref: string | null) => (ref ? `External number ${ref}` : 'No external number'),
      since: (date: string) => `in Reziproq since ${date}`,
      vat: (id: string) => `VAT ID ${id}`,
      duns: (id: string) => `DUNS ${id}`,
      spend: 'Spend per year',
      noSpend: 'No spend recorded yet',
      contacts: (name: string, n: number) => `Contacts at ${name} · ${n}`,
      noContacts: 'No contacts yet',
      noContactsText: 'Contacts come with the import.',
      team: 'Team in Reziproq',
      ownTeam: (n: number) => `Your team · ${n}`,
      ownTeamDetail: (names: string) => `${names} · only you see the roles`,
      edit: 'Edit',
      import: 'Open import',
    },
    rules: {
      title: 'Ground rules',
      subtitle: (type: string, version: number, state: string) =>
        `“${type}” · version ${version} · ${state}`,
      sharedOn: (date: string) => `shared on ${date}`,
      unshared: 'changes not shared yet',
      draft: 'not shared yet',
      rights: (name: string) => `Rights of ${name}`,
      duties: (name: string) => `Obligations of ${name}`,
      formats: 'Formats',
      ongoing: 'ongoing',
      targetChanged: (type: string) => `The target type is now “${type}”`,
      targetChangedText: 'Reziproq suggests ground rules for the new type.',
      share: 'Share changes',
      edit: 'Edit',
      approve: 'Approve',
      none: 'No ground rules yet',
      noneText: 'Ground rules follow from the segment. Reziproq has a suggestion.',
    },
    kpi: {
      title: 'KPI',
      subtitle: (side: string, target: string, date: string, owner: string | null) =>
        [side, `target ${target} by ${date}`, owner].filter(Boolean).join(' · '),
      ownSide: 'your side',
      line: (baseline: string | null, target: string) =>
        baseline ? `Baseline ${baseline}, target ${target}` : `Target ${target}`,
      latest: (month: string, value: string) => `latest ${value} in ${month}`,
      noValue: 'no value yet',
      chartTitle: (track: string) => `History · ${track}`,
      chartHint: (tolerance: number) =>
        `Line from baseline to target; “close” means up to ${tolerance} % behind.`,
      actual: 'Actual',
      plan: 'Line to target',
      chartEmpty: 'No values yet',
      chartEmptyHint: 'The responsible side enters values.',
      values: 'Values',
      valueDetail: (by: string, when: string, source: string) => `${by}, ${when} · ${source}`,
      enter: 'Enter value',
      onlyOwner: (side: string) => `${side} enters the values.`,
    },
  },
});
