import { cn } from '@/lib/utils';

/**
 * Datumskreis der Designsprache: Kreis 56 px, Tag in Outfit 19, Monat 10 mit Sperrung. Der
 * nächste Termin steht in Tinte mit Mint. Das volle Datum steht für Screenreader da.
 */
function DateCircle({
  date,
  locale,
  next = false,
  tone,
  variant,
  size,
  className,
}: {
  /** Datum als „JJJJ-MM-TT“ oder Date */
  date: string | Date;
  locale: string;
  next?: boolean;
  /** onInk: auf einer Tinte-Fläche, Mint mit Tinte-Text */
  tone?: 'onInk';
  /** ring: weiß mit Ring 2 px, wie in der Terminschiene und den Fristen (Main.dc.html) */
  variant?: 'ring';
  /** sm: 44 px in Zeilen, sonst 56 px */
  size?: 'sm';
  className?: string;
}) {
  const value = typeof date === 'string' ? new Date(`${date.slice(0, 10)}T12:00:00`) : date;
  const day = new Intl.DateTimeFormat(locale, { day: '2-digit' }).format(value);
  const month = new Intl.DateTimeFormat(locale, { month: 'short' })
    .format(value)
    .replace('.', '')
    .toLocaleUpperCase(locale);
  const full = new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(value);
  return (
    <span
      data-slot="date-circle"
      data-next={next || undefined}
      className={cn(
        'flex shrink-0 flex-col items-center justify-center rounded-full font-display font-semibold leading-none',
        size === 'sm' ? 'size-11' : 'size-14',
        tone === 'onInk'
          ? 'bg-mint text-ink'
          : next
            ? 'bg-ink text-mint'
            : variant === 'ring'
              ? 'bg-card text-ink ring-2 ring-line ring-inset'
              : 'bg-line-soft text-text',
        className,
      )}
    >
      <span className="sr-only">{full}</span>
      <span aria-hidden className={cn('leading-none', size === 'sm' ? 'text-base' : 'text-lg')}>
        {day}
      </span>
      <span
        aria-hidden
        className={cn(
          'text-micro tracking-wider',
          !next && tone !== 'onInk' && variant === 'ring' && 'text-input-border',
        )}
      >
        {month}
      </span>
    </span>
  );
}

export { DateCircle };
