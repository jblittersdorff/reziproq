import { monogram } from '@/lib/monogram';
import { cn } from '@/lib/utils';

export type MonogramTone =
  | 'neutral'
  | 'shared'
  | 'success'
  | 'warning'
  | 'danger'
  | 'ink'
  | 'petrol';

const tones: Record<MonogramTone, string> = {
  neutral: 'bg-status-neutral text-status-neutral-foreground',
  shared: 'bg-status-shared text-status-shared-foreground',
  success: 'bg-success-soft text-success-soft-foreground',
  warning: 'bg-warning-soft text-warning-soft-foreground',
  danger: 'bg-destructive-soft text-destructive-soft-foreground',
  ink: 'bg-ink text-mint',
  // Personen und Gegenüber in Listen von Heute (Vorlagen Main, Heute-Alles)
  petrol: 'bg-petrol text-primary-foreground',
};

/**
 * Monogramm eines Lieferanten oder Kunden (UMB-05, Designsprache): Kreis mit zwei Buchstaben in
 * Outfit 600, Fläche nach Status; Fokuslieferanten in Tinte mit Mint. ring zeichnet den
 * Petrol-Innenrand der Lieferanten-Leiste. Dekorativ – der Name steht immer daneben.
 */
function Monogram({
  name,
  emphasis = false,
  tone,
  ring = false,
  size = 'md',
  label,
  className,
}: {
  name: string;
  /** Feste Kurzform statt der zwei Buchstaben aus dem Namen, etwa „@“ oder „API“ */
  label?: string | undefined;
  /** Kurzform für tone="ink" */
  emphasis?: boolean;
  tone?: MonogramTone;
  ring?: boolean;
  /** sm 28, md 38, lg 52 px, xl 56 px (Akte-Kopf) */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string | undefined;
}) {
  const resolved = tone ?? (emphasis ? 'ink' : 'neutral');
  return (
    <span
      aria-hidden
      data-slot="monogram"
      data-tone={resolved}
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-display font-semibold tracking-wide',
        size === 'sm' && 'size-7 text-chip',
        size === 'md' && 'size-9.5 text-chip',
        size === 'lg' && 'size-13 text-base',
        size === 'xl' && 'size-14 text-lg',
        ring ? 'bg-mint-soft text-petrol-dark ring-2 ring-petrol ring-inset' : tones[resolved],
        className,
      )}
    >
      {label ?? monogram(name)}
    </span>
  );
}

export { Monogram };
