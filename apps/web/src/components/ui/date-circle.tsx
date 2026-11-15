import { cn } from '@/lib/utils';

/**
 * Datumskreis der Designsprache: Kreis 56 px, Tag in Outfit 19, Monat 10 mit Sperrung. Der
 * nächste Termin steht in Tinte mit Mint. Das volle Datum steht für Screenreader da.
 */
function DateCircle({
  date,
  locale,
  next = false,
  className,
}: {
  /** Datum als „JJJJ-MM-TT“ oder Date */
  date: string | Date;
  locale: string;
  next?: boolean;
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
        'flex size-14 shrink-0 flex-col items-center justify-center rounded-full font-display font-semibold leading-none',
        next ? 'bg-ink text-mint' : 'bg-line-soft text-text',
        className,
      )}
    >
      <span className="sr-only">{full}</span>
      <span aria-hidden className="text-lg leading-none">
        {day}
      </span>
      <span aria-hidden className="text-micro tracking-wider">
        {month}
      </span>
    </span>
  );
}

export { DateCircle };
