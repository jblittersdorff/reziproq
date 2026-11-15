import type * as React from 'react';

import { cn } from '@/lib/utils';

export type LaneState = 'running' | 'planned' | 'done';

export interface LaneBar {
  key: string;
  /** Erste Spalte, ab 0 */
  start: number;
  /** Spalte nach dem Ende, z. B. start 1 und end 3 belegt die Spalten 1 und 2 */
  end: number;
  state: LaneState;
  label: string;
}

export interface LaneRow {
  key: string;
  title: React.ReactNode;
  detail?: React.ReactNode;
  bars: LaneBar[];
  /** Meilensteine an einer Stelle in Spalten, z. B. 2,5 für die Mitte der dritten Spalte */
  milestones?: { key: string; at: number; label: string }[];
}

const barLook: Record<LaneState, string> = {
  running: 'bg-petrol text-primary-foreground',
  planned: 'border border-mint-line bg-mint-soft text-petrol-dark',
  done: 'bg-line text-muted-strong',
};

/**
 * Zeitachse der Designsprache: Balken voll gerundet; läuft Petrol, geplant mint-soft mit
 * mint-line, fertig line; Meilenstein als Mint-Kreis mit Tinte-Rand. Der Stand jedes Balkens
 * steht für Screenreader als Text dabei. Scrollt auf schmalen Bildschirmen in ihrem Rahmen.
 */
function TimelineLanes({
  label,
  columns,
  rows,
  stateLabels,
  milestoneLabel,
  className,
}: {
  label: string;
  /** Spaltenköpfe, z. B. Quartale */
  columns: string[];
  rows: LaneRow[];
  stateLabels: Record<LaneState, string>;
  /** z. B. „Meilenstein“ */
  milestoneLabel: string;
  className?: string;
}) {
  const share = (value: number) => `${(value / columns.length) * 100}%`;
  return (
    <div data-slot="timeline-lanes" className={cn('overflow-x-auto', className)}>
      <table className="w-full min-w-160 table-fixed border-collapse">
        <caption className="sr-only">{label}</caption>
        <thead>
          <tr>
            <th scope="col" className="w-1/4">
              <span className="sr-only">{label}</span>
            </th>
            {columns.map((column) => (
              <th
                key={column}
                scope="col"
                className="pb-2 pl-2 text-left font-semibold text-chip text-muted-foreground"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-line-soft border-t">
              <th scope="row" className="py-2 pr-4 text-left align-middle font-normal text-sm">
                <span className="flex flex-col">
                  <strong className="font-semibold">{row.title}</strong>
                  {row.detail && <span className="text-muted-foreground">{row.detail}</span>}
                </span>
              </th>
              <td colSpan={columns.length} className="relative h-16 p-0">
                <span aria-hidden className="absolute inset-0 flex">
                  {columns.map((column) => (
                    <span key={column} className="flex-1 border-line-soft border-l" />
                  ))}
                </span>
                {row.bars.map((bar) => (
                  <span
                    key={bar.key}
                    data-state={bar.state}
                    className={cn(
                      'absolute top-4.25 flex h-7.5 items-center overflow-hidden whitespace-nowrap rounded-full px-3.5 font-semibold text-chip',
                      barLook[bar.state],
                    )}
                    style={{ left: share(bar.start), width: share(bar.end - bar.start) }}
                    title={`${bar.label} · ${stateLabels[bar.state]}`}
                  >
                    {bar.label}
                    <span className="sr-only"> · {stateLabels[bar.state]}</span>
                  </span>
                ))}
                {row.milestones?.map((milestone) => (
                  <span
                    key={milestone.key}
                    className="absolute top-5.75 size-4.5 -translate-x-1/2 rounded-full border-2 border-ink bg-mint shadow-ring-gap"
                    style={{ left: share(milestone.at) }}
                    title={milestone.label}
                  >
                    <span className="sr-only">
                      {milestoneLabel}: {milestone.label}
                    </span>
                  </span>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="mt-3 flex flex-wrap gap-4 text-muted-foreground text-sm">
        {(['running', 'planned', 'done'] as const).map((state) => (
          <li key={state} className="flex items-center gap-2">
            <span aria-hidden className={cn('h-3 w-6 rounded-full', barLook[state])} />
            {stateLabels[state]}
          </li>
        ))}
        <li className="flex items-center gap-2">
          <span aria-hidden className="size-3.5 rounded-full border-2 border-ink bg-mint" />
          {milestoneLabel}
        </li>
      </ul>
    </div>
  );
}

export { TimelineLanes };
