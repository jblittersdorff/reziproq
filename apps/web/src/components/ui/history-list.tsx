import { HistoryIcon } from 'lucide-react';

import { EmptyState } from './empty-state';
import { LoadingState } from './loading-state';

export interface HistoryEntry {
  id: string;
  /** schon formatiert, z. B. „12.11.2026, 14:05“ */
  when: string;
  actor: string;
  organization: string;
  /** z. B. „Status: angelegt → aktiv“ */
  change: string;
}

/**
 * Baustein Verlauf (PLT-08): ruhige Liste, neueste zuerst. Personen erscheinen mit Namen, weil
 * Nachvollziehbarkeit das verlangt; es gibt keine Auswertung je Person.
 */
function HistoryList({
  entries,
  loading,
  loadingLabel,
  empty,
}: {
  entries: HistoryEntry[];
  loading?: boolean;
  loadingLabel: string;
  empty: { title: string; description: string };
}) {
  if (loading) return <LoadingState label={loadingLabel} />;
  if (entries.length === 0) {
    return (
      <EmptyState icon={<HistoryIcon />} title={empty.title} description={empty.description} />
    );
  }
  return (
    <ol data-slot="history-list" className="flex flex-col gap-4">
      {entries.map((entry) => (
        <li key={entry.id} className="flex flex-col gap-1">
          <span className="text-muted-foreground text-sm tabular-nums">{entry.when}</span>
          <span className="text-base">{entry.change}</span>
          <span className="text-muted-foreground text-sm">
            {entry.actor} · {entry.organization}
          </span>
        </li>
      ))}
    </ol>
  );
}

export { HistoryList };
