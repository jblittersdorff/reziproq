import type { WorkspaceHead as Head } from '@reziproq/shared';
import { useFormat } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/**
 * Kopf des Arbeitsbereichs (NAV-06): Segment Ist → Soll, SRO, nächster Termin. Auf dem Überblick
 * groß und zentriert, sonst als schmale Zeile. Der Name steht nur in der lokalen Leiste. Fehlt
 * Segment oder SRO, steht „noch offen“; ohne Termin entfällt die Angabe.
 */
export function WorkspaceHead({ head, size }: { head: Head; size: 'lg' | 'line' }) {
  const t = useT();
  const format = useFormat();
  const entries = [
    {
      key: 'segment',
      label: t.workspace.head.segment,
      value: head.segment ? `${head.segment.current} → ${head.segment.target}` : null,
    },
    { key: 'sro', label: t.workspace.head.sro, value: head.sro?.name ?? null },
    ...(head.nextMeeting
      ? [
          {
            key: 'nextMeeting',
            label: t.workspace.head.nextMeeting,
            value: format.date(head.nextMeeting.date),
          },
        ]
      : []),
  ];

  return (
    <dl
      aria-label={t.workspace.head.label}
      className={cn(
        'flex flex-wrap',
        size === 'lg'
          ? 'justify-center gap-x-12 gap-y-4 py-4 text-center'
          : '-mt-4 gap-x-6 gap-y-1 text-sm',
      )}
    >
      {entries.map((entry) => (
        <div
          key={entry.key}
          data-head={entry.key}
          className={cn('flex', size === 'lg' ? 'flex-col-reverse gap-1' : 'gap-2')}
        >
          <dt className="text-muted-foreground">{entry.label}</dt>
          <dd
            className={cn(
              size === 'lg' && 'font-semibold text-xl',
              entry.value === null && 'text-muted-foreground',
            )}
          >
            {entry.value ?? t.workspace.head.open}
          </dd>
        </div>
      ))}
    </dl>
  );
}
