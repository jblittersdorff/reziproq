import { actions, orgRoles } from '@reziproq/shared';
import { permissions } from './permissions.js';

/**
 * Geplante Rechte des Warengruppenmanagements (Release 1.1), im Wortlaut aus
 * docs/reziproq-specs-warengruppen/ergaenzung-rechte.md. Noch nicht umgesetzt; es gibt dafür keine
 * Aktion in permissions.ts (docs/umsetzungsplan.md, Abschnitt 9).
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
    '## Geplant: Warengruppenmanagement (Release 1.1, noch nicht umgesetzt)',
    '',
    ...plannedCategoryRights,
    '',
  ].join('\n');
}
