import type { AuditEntry } from '@reziproq/shared';
import type { HistoryEntry } from '@/components/ui/history-list';
import type { Messages } from '@/locales/de';

// PLT-08: Verlaufseinträge lesbar machen, z. B. „Status: Entwurf → aktiv“. Feld- und Wertnamen
// stehen in der Übersetzungsdatei; unbekannte Felder erscheinen mit ihrem Namen.

const when = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function valueText(t: Messages, field: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '–';
  // Team (PLT-05b): Liste von Personen mit Teamrolle.
  if (Array.isArray(value)) {
    if (value.length === 0) return '–';
    return value
      .map((entry: { name?: string; team_role?: string }) => {
        const role = entry.team_role as keyof Messages['team']['roles'] | undefined;
        return role ? `${entry.name} (${t.team.roles[role] ?? role})` : String(entry.name);
      })
      .join(', ');
  }
  const text = String(value);
  return t.audit.values[field]?.[text] ?? text;
}

export function formatAuditEntry(entry: AuditEntry, t: Messages): HistoryEntry {
  const changes = Object.entries(entry.changes).map(([field, { from, to }]) =>
    t.audit.change(
      t.audit.fields[field] ?? field,
      valueText(t, field, from),
      valueText(t, field, to),
    ),
  );
  return {
    id: entry.id,
    when: when.format(new Date(entry.occurredAt)),
    actor: entry.actorName,
    organization: entry.organization,
    change: changes.length > 0 ? changes.join(' · ') : t.audit.actions[entry.action],
  };
}
