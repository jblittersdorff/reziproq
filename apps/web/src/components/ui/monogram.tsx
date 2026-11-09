import { monogram } from '@/lib/monogram';
import { cn } from '@/lib/utils';

/**
 * Monogramm eines Lieferanten oder Kunden (UMB-05): zwei Buchstaben auf ruhiger Fläche, für
 * Fokuslieferanten in Tinte mit Minze. Dekorativ – der Name steht immer daneben.
 */
function Monogram({
  name,
  emphasis = false,
  size = 'md',
  className,
}: {
  name: string;
  emphasis?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}) {
  return (
    <span
      aria-hidden
      data-slot="monogram"
      className={cn(
        'flex shrink-0 items-center justify-center rounded-lg font-bold tracking-title',
        size === 'sm' ? 'size-7 text-sm' : 'size-10 text-sm',
        emphasis ? 'bg-stage text-stage-accent' : 'bg-secondary text-secondary-foreground',
        className,
      )}
    >
      {monogram(name)}
    </span>
  );
}

export { Monogram };
