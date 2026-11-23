import { actions, orgRoles } from '@reziproq/shared';
import { permissions } from './permissions.js';

/**
 * Geplante Rechte des Warengruppenmanagements (Release 1.1), im Wortlaut aus
 * docs/eingang/reziproq-specs-warengruppen/ergaenzung-rechte.md. Bereits eingeführte Rechte stehen als
 * Aktionen in permissions.ts.
 */
const plannedCategoryRights = [
  'Die Rollen Lead, Commodity Manager, Einkauf im Team und Funktion im Team gelten je Warengruppe (`category_member.role`).',
  '',
  '| Objekt | Admin | Lead | Commodity Manager | Einkauf im Team | Funktion im Team | SRO der Beziehung | Käufer mit Zugriff | Lieferant |',
  '|---|---|---|---|---|---|---|---|---|',
  '| Warengruppe, Produktgruppe, Team | schreiben | Team und Produktgruppen schreiben | lesen | lesen | lesen | lesen | lesen | nie |',
  '| Strategie im Entwurf | lesen | schreiben | schreiben | Schritte 2 bis 9 schreiben | zugewiesene Sichten kommentieren | nur Zeile seines Lieferanten in der Supplier Map | nie | nie |',
  '| Strategie freigegeben | lesen | lesen | lesen | lesen | lesen | lesen | lesen | nie |',
  '| Kostensicht | lesen | schreiben | schreiben | schreiben | nie | nie | nie | nie |',
  '| Bewertungsrunde der Warengruppe | lesen | starten, entscheiden | starten, entscheiden | bewerten | bewerten | lesen | lesen | nie |',
  '| Freigabe | Wege einstellen | vorlegen, unterschreiben | unterschreiben | lesen | lesen | lesen | lesen | nie |',
  '| Zusammenführung, Widersprüche | lesen | Widersprüche seiner Warengruppe lösen | Widersprüche lösen | lesen | nie | Gesamtsegment entscheiden, Widersprüche lösen | lesen | nie |',
  '| KI-Entwurf | Einstellungen | wie Zielobjekt | wie Zielobjekt | wie Zielobjekt | nie | wie Zielobjekt | nie | nie |',
  '',
  'Freigebende nach Freigabeweg lesen die ganze Strategie im Entwurf einschließlich Kostensicht und geben frei oder zurück.',
  '',
  'Für alle Tabellen des Moduls gilt:',
  '',
  '- Art `org_private`, keine Freigabe-Policy.',
  '- Kein Fremdschlüssel von einer geteilten Tabelle auf eine dieser Tabellen.',
  '- Je Tabelle ein Test, dass der Test-Lieferant nichts erhält, und ein Test, dass Kunde A nichts von Kunde B erhält.',
];

const roleNames = { admin: 'Admin', member: 'Nutzer', viewer: 'Leser' } as const;

/**
 * docs/rechte.md aus der Rechte-Matrix (PLT-05). Nie von Hand ändern: `pnpm rechte` erzeugt die
 * Datei neu; ein Test schlägt fehl, wenn sie veraltet ist.
 */
export function renderRightsDoc(): string {
  const header = ['Aktion', 'Was', ...orgRoles.map((role) => roleNames[role]), 'Betreiber'];
  const rows = actions.map((action) => {
    const permission = permissions[action];
    const cell = (allowed: boolean) => (allowed ? 'ja' : 'nein');
    return [
      `\`${action}\``,
      permission.description,
      ...orgRoles.map((role) =>
        permission.controlling && permission.roles.includes(role)
          ? 'mit Controlling'
          : cell(permission.roles.includes(role)),
      ),
      // Betreiber haben im Kunden die Rechte eines Lesers, dazu ihre eigenen Aktionen.
      cell(
        !permission.controlling &&
          (permission.operator === true || permission.roles.includes('viewer')),
      ),
    ];
  });
  const line = (cells: string[]) => `| ${cells.join(' | ')} |`;
  return [
    '# Rechte',
    '',
    'Erzeugt aus `apps/api/src/modules/auth/permissions.ts` mit `pnpm rechte`. Nicht von Hand ändern.',
    '',
    'Jeder Nutzer hat genau eine Rolle in seiner Organisation (PLT-05). Die Zusatzrolle Controlling',
    'gibt später GuV-Wirkungen frei (PNL-06). Entschieden wird allein im Backend über `can()`.',
    '',
    line(header),
    line(header.map(() => '---')),
    ...rows.map(line),
    '',
    '## Warengruppenmanagement (Zielmatrix)',
    '',
    ...plannedCategoryRights,
    '',
    '## KI und Agenten (Planung)',
    '',
    'Vorgabe für die Umsetzung. Offene Rollenfragen stehen im [Prüfbericht](eingang/PRUEFBERICHT.md).',
    '',
    '| Objekt | Admin | Besitzer eines eigenen Agenten | SRO der Beziehung | Käufer mit Zugriff | Lieferant |',
    '|---|---|---|---|---|---|',
    '| Einstellungen KI | schreiben | lesen | lesen | Kontingent lesen | nie |',
    '| Verbrauch je Agent | lesen | eigene Agenten lesen | lesen | nie | nie |',
    '| Agent von Reziproq | ein- und ausschalten | lesen, starten | lesen, starten | lesen, starten | nie |',
    '| Eigener Agent | freigeben, pausieren | schreiben, testen, löschen | lesen, starten | lesen, starten, wenn die Daten sichtbar sind | nie |',
    '| Lauf und Protokoll | Metadaten aller regulären Läufe, Inhalte mit Quellenzugriff | eigene Läufe mit Quellenzugriff | eigene Läufe mit Quellenzugriff | eigene Läufe mit Quellenzugriff | nie |',
    '| Entwurf | lesen | wie Zielobjekt | wie Zielobjekt | wie Zielobjekt | nie |',
    '| Wertpotenzial, Rechenweg, Marktsignal, Datenlücke | lesen | – | übernehmen, verwerfen, Annahmen ändern | lesen, wenn Zugriff auf die Beziehung | nie |',
    '| Frage an das Team | lesen | – | – | beantworten, wenn an sie gerichtet; Lead und Commodity Manager alle | nie |',
    '',
    'KI-03 speichert Aussagen und Quellen in der Käuferorganisation. Die Fachberechtigung des Zielobjekts gilt auch für Übernahme, Bearbeitung und Verwerfen. QBR-07 führt die eigene Lieferantenvorbereitung getrennt in der Lieferantenorganisation weiter.',
    '',
    'Manuelle Systemläufe handeln mit den Rechten der startenden Person. Bei späteren Fremdstarts eigener Agenten gilt die Schnittmenge der Rechte von Starter und Besitzer. Testläufe sieht ausschließlich die startende Person mit Zugriff auf die Quelle.',
    '',
    'Für alle Tabellen aus KI-01 bis KI-13 gilt:',
    '',
    '- Art `org_private`, keine Freigabe-Policy.',
    '- Kein Fremdschlüssel von einer geteilten Tabelle auf eine dieser Tabellen.',
    '- Je Tabelle ein Test, dass der Test-Lieferant nichts erhält, und ein Test, dass Kunde A nichts von Kunde B erhält.',
    '- Ein Werkzeug liefert nie mehr, als die Person sehen darf, in deren Namen der Lauf handelt.',
    '',
    'Ergänzung ab KI-15:',
    '',
    '| Objekt | Admin | Lead | Commodity Manager | SRO der Beziehung | Käufer mit Zugriff | Controlling | Lieferant |',
    '|---|---|---|---|---|---|---|---|',
    '| Import, Alias, Regel | schreiben, rückgängig | lesen | Prüfung für eigene Warengruppen | – | – | – | nie |',
    '| Hinweis (Ergänzung zu FS-01) | Regeln und Schwellen | alle lesen | eigene Warengruppen bearbeiten | eigene Beziehungen bearbeiten | – | – | nie |',
    '| Ergebnisse nach dem Termin | – | – | – | übernehmen, Protokoll teilen | Teilnehmer: erfassen, lesen | – | nur geteiltes Protokoll und geteilte Zusagen |',
    '| Dokument, Feld | löschen | lesen | eigene Warengruppen schreiben, bestätigen | schreiben, bestätigen | lesen | – | nie |',
    '| Vertragsleck, Bestellzeile, Gutschrift | lesen | lesen | eigene Warengruppen lesen | klären, Rückfluss erfassen | – | Rückfluss bestätigen | nur gesendete Klärung |',
    '| Szenario | lesen | entscheiden | eigene Warengruppen schreiben, entscheiden | schreiben, entscheiden ohne Warengruppe | lesen | – | nie |',
    '| Verhandlungsplan, Probe | – | lesen | – | schreiben | nur Mitglieder | – | nie |',
    '| Quartalsbericht | anlegen | anlegen, freigeben, exportieren | lesen | lesen | freigegebene lesen | freigegebene lesen | nie |',
    '| Hilfe für Lieferanten | ein- und ausschalten, Verbrauch je Lieferant | – | – | – | – | – | eigene Läufe und Entwürfe |',
    '',
    '## Anbindungen (Planung)',
    '',
    'Vorgabe für die Umsetzung. Offene Rollenfragen stehen im [Prüfbericht](eingang/PRUEFBERICHT.md).',
    '',
    '| Recht | Admin | SRO | Commodity Manager | Käufer | Lieferant |',
    '|---|---|---|---|---|---|',
    '| `integration.manage` | ✓ | – | – | – | – |',
    '| `integration.connect_own` (Kalender, Add-in) | ✓ | ✓ | ✓ | ✓ | – |',
    '| `inbound.assign` (eigene Eingänge) | ✓ | ✓ | ✓ | ✓ | – |',
    '| `inbound.assign_relationship` (Eingänge zu eigenen Lieferanten) | ✓ | ✓ | – | – | – |',
    '| `mail.file` | ✓ | ✓ | ✓ | ✓ | – |',
    '| `transcript.settings` | ✓ | – | – | – | – |',
    '| `transcript.opt_in` (je Termin) | – | ✓ | – | Organisator | – |',
    '| `transcript.read_raw` | – | ✓ | – | nach Freigabe | – |',
    '| `api_key.manage` | ✓ | – | – | – | – |',
    '',
    'Regeln: Daten aus Anbindungen sind immer `org_private`. Der Lieferant sieht nur, was ein Mensch teilt.',
    '',
  ].join('\n');
}
