import type * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Spiegel (Designsprache „Bausteine für Reziproq“, Vorlage L-Ueberblick): zwei Balken gegeneinander,
 * links die eigene Seite in Tinte, rechts das Gegenüber in Petrol, dazwischen die Naht in Mint;
 * Werte außen in Outfit, darunter je Seite eine Zeile („ihr · 9 von 10“) und optional ein Satz,
 * wer dieselben Zahlen sieht. Die Werte stehen im Namen für Screenreader.
 */
function Mirror({
  own,
  counterpart,
  label,
  caption,
  className,
}: {
  /** Prozent 0 bis 100; null ohne fällige Zusage */
  own: { percent: number | null; text: string };
  counterpart: { percent: number | null; text: string };
  /** Ganzer Satz für Screenreader */
  label: string;
  /** z. B. „Gehaltene Zusagen 2026. Rheintal Elektronik sieht dieselben Zahlen.“ */
  caption?: React.ReactNode;
  className?: string;
}) {
  const width = (value: number | null) => `${Math.max(0, Math.min(100, value ?? 0))}%`;
  const value = (percent: number | null) => (percent === null ? '–' : `${percent} %`);
  return (
    <div data-slot="mirror" className={cn('flex flex-col gap-2', className)}>
      <div role="img" aria-label={label} className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2.5">
          <span className="flex flex-1 items-center gap-2.5">
            <span className="whitespace-nowrap font-display font-semibold text-base text-ink tabular-nums">
              {value(own.percent)}
            </span>
            <span className="flex flex-1 justify-end">
              <span className="h-4.5 rounded-l-full bg-ink" style={{ width: width(own.percent) }} />
            </span>
          </span>
          <span className="h-9 w-1 shrink-0 rounded-full bg-mint" />
          <span className="flex flex-1 items-center gap-2.5">
            <span className="flex flex-1">
              <span
                className="h-4.5 rounded-r-full bg-petrol"
                style={{ width: width(counterpart.percent) }}
              />
            </span>
            <span className="whitespace-nowrap font-display font-semibold text-base text-petrol tabular-nums">
              {value(counterpart.percent)}
            </span>
          </span>
        </div>
        <div aria-hidden className="flex text-muted-foreground text-sm">
          <span className="flex-1 pr-4 text-right">{own.text}</span>
          <span className="flex-1 pl-4">{counterpart.text}</span>
        </div>
      </div>
      {caption && <p className="text-muted-foreground text-sm">{caption}</p>}
    </div>
  );
}

export { Mirror };
