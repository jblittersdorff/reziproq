import { cn } from '@/lib/utils';

const tones = {
  petrol: 'bg-petrol text-on-dark',
  slate: 'bg-muted-strong text-on-dark',
  ink: 'bg-ink text-mint',
  risk: 'bg-risk text-on-dark',
  rest: 'bg-ring-open text-text',
} as const;
export type ShareStackTone = keyof typeof tones;

/**
 * Verteilung als ein Balken (WG-SupplierMap.dc.html, „Umsatzverteilung heute und im Zieljahr“):
 * 34 px hoch, voll gerundet, je Anteil ein Abschnitt mit Kürzel und Wert als Text. Die Farbe folgt
 * dem Lieferanten, nicht dem Rang; „beenden“ trägt Risiko, der Rest ist grau. Die ganze Verteilung
 * steht in label für Screenreader. Sehr schmale Abschnitte zeigen keinen Text; label nennt sie.
 */
function ShareStack({
  label,
  segments,
  className,
}: {
  /** z. B. „Heute: Rheintal 38 %, Saar 27 %, Weitere 8 %“ */
  label: string;
  segments: { key: string; text: string; share: number; tone: ShareStackTone }[];
  className?: string;
}) {
  const shown = segments.filter((segment) => segment.share > 0);
  return (
    <div
      role="img"
      aria-label={label}
      data-slot="share-stack"
      className={cn(
        'flex h-8.5 overflow-hidden rounded-full bg-line-soft font-semibold text-chip',
        className,
      )}
    >
      {shown.map((segment) => (
        <span
          key={segment.key}
          aria-hidden
          className={cn(
            'flex min-w-0 items-center justify-center overflow-hidden whitespace-nowrap',
            tones[segment.tone],
          )}
          style={{ width: `${Math.min(1, segment.share) * 100}%` }}
        >
          {segment.share >= 0.07 ? segment.text : ''}
        </span>
      ))}
    </div>
  );
}

export { ShareStack };
