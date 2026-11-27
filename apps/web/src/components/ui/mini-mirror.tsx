import { cn } from '@/lib/utils';

/**
 * Mini-Spiegel (Designsprache „Bausteine für Reziproq“, Vorlagen Lieferanten und A-Lieferanten):
 * zwei Balken gegeneinander, links die eigene Seite in Tinte, rechts das Gegenüber in Petrol,
 * dazwischen die Naht in Mint. `md` ist 200 px breit mit Werten außen und Balken 8 px, `sm` 64 px
 * mit Balken 6 px ohne Werte (Telefon). Die Werte stehen immer im Namen für Screenreader.
 */
function MiniMirror({
  own,
  counterpart,
  label,
  size = 'md',
  className,
}: {
  /** Prozent 0 bis 100; null, wenn auf dieser Seite nichts fällig war */
  own: number | null;
  counterpart: number | null;
  /** Ganzer Satz für Screenreader, z. B. „Zusagen gehalten: ihr 90 %, Rheintal 78 %“ */
  label: string;
  size?: 'md' | 'sm';
  className?: string;
}) {
  const share = (value: number | null) => `${Math.max(0, Math.min(100, value ?? 0))}%`;
  const small = size === 'sm';
  const bar = small ? 'h-1.5' : 'h-2';
  return (
    <span
      role="img"
      aria-label={label}
      data-slot="mini-mirror"
      className={cn(
        'flex flex-none items-center',
        small ? 'w-16 gap-1' : 'w-50 gap-1.5',
        className,
      )}
    >
      {!small && (
        <span className="w-10 text-right font-semibold text-ink text-sm tabular-nums">
          {own === null ? '–' : `${own} %`}
        </span>
      )}
      <span className="flex flex-1 justify-end">
        <span className={cn('rounded-l-full bg-ink', bar)} style={{ width: share(own) }} />
      </span>
      <span className={cn('w-0.75 flex-none rounded-full bg-mint', small ? 'h-3' : 'h-4')} />
      <span className="flex flex-1">
        <span
          className={cn('rounded-r-full bg-petrol', bar)}
          style={{ width: share(counterpart) }}
        />
      </span>
      {!small && (
        <span className="w-10 font-semibold text-petrol text-sm tabular-nums">
          {counterpart === null ? '–' : `${counterpart} %`}
        </span>
      )}
    </span>
  );
}

export { MiniMirror };
