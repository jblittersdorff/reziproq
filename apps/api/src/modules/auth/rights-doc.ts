import { actions, orgRoles } from '@reziproq/shared';
import { permissions } from './permissions.js';

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
      ...orgRoles.map((role) => cell(permission.roles.includes(role))),
      // Betreiber haben im Kunden die Rechte eines Lesers, dazu ihre eigenen Aktionen.
      cell(permission.operator === true || permission.roles.includes('viewer')),
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
  ].join('\n');
}
