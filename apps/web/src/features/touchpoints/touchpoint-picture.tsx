import type { FormatLevel, Touchpoint } from '@reziproq/shared';
import { formatLevels } from '@reziproq/shared';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/** Gleiche Reihenfolge in Bild und Liste: nach Ebene der Käuferseite, dann des Lieferanten. */
export function sortTouchpoints(touchpoints: Touchpoint[]): Touchpoint[] {
  return [...touchpoints].sort(
    (a, b) =>
      formatLevels.indexOf(a.buyerLevel) - formatLevels.indexOf(b.buyerLevel) ||
      formatLevels.indexOf(a.supplierLevel) - formatLevels.indexOf(b.supplierLevel),
  );
}

/**
 * Bild der Kontaktpunkte (PLB-06): links die Ebenen der Käuferseite, rechts die des Lieferanten,
 * je Kontaktpunkt eine Zeile mit Linie zwischen den Ebenen, beschriftet mit Format und Takt. Jede
 * Linie hat ihre eigene Zeile, damit Beschriftungen sich auch bei 20 Kontaktpunkten nie
 * überdecken. Die Ebene steht als Spalte (Lage des Punkts) und als Text, nicht nur über Farbe.
 */
export function TouchpointPicture({
  touchpoints,
  side,
}: {
  touchpoints: Touchpoint[];
  side: 'buyer' | 'supplier';
}) {
  const t = useT();
  const text = t.touchpoints;
  // Rechts gespiegelt: Geschäftsleitung jeweils außen, Fachebene zur Mitte.
  const rightLevels = [...formatLevels].reverse();
  const sorted = sortTouchpoints(touchpoints);
  const lanes = (levels: readonly FormatLevel[], active: FormatLevel) =>
    levels.map((level) => (
      <span key={level} className="flex items-center justify-center" data-level={level}>
        {level === active ? (
          <span className="size-3 rounded-full bg-primary ring-2 ring-background" aria-hidden />
        ) : (
          <span className="h-full w-px bg-border" aria-hidden />
        )}
      </span>
    ));
  const grid =
    'grid grid-cols-[minmax(0,3fr)_repeat(3,minmax(0,1fr))_minmax(0,5fr)_repeat(3,minmax(0,1fr))_minmax(0,3fr)] items-center gap-x-1 max-sm:grid-cols-[repeat(7,minmax(0,1fr))]';
  return (
    <figure className="flex flex-col gap-3 rounded-lg bg-card p-4">
      <div className={cn(grid, 'text-muted-foreground text-xs')} aria-hidden>
        <span className="font-semibold text-foreground text-sm max-sm:hidden">
          {text.left[side]}
        </span>
        {formatLevels.map((level) => (
          <span key={level} className="text-center">
            {text.levelsShort[level]}
          </span>
        ))}
        <span />
        {rightLevels.map((level) => (
          <span key={level} className="text-center">
            {text.levelsShort[level]}
          </span>
        ))}
        <span className="text-end font-semibold text-foreground text-sm max-sm:hidden">
          {text.right[side]}
        </span>
      </div>
      <ul aria-label={text.picture} className="flex flex-col">
        {sorted.map((touchpoint) => {
          const label = `${touchpoint.format} · ${text.cadences[touchpoint.cadence]}`;
          return (
            <li
              key={touchpoint.id}
              aria-label={text.line(
                `${touchpoint.buyerName} (${text.levels[touchpoint.buyerLevel]})`,
                `${touchpoint.supplierName} (${text.levels[touchpoint.supplierLevel]})`,
                touchpoint.format,
                text.cadences[touchpoint.cadence] ?? '',
              )}
              className={cn(grid, 'min-h-11 text-sm')}
            >
              <span className="truncate max-sm:hidden" aria-hidden>
                {touchpoint.buyerName}
              </span>
              {lanes(formatLevels, touchpoint.buyerLevel)}
              <span className="flex items-center gap-2" aria-hidden>
                <span className="h-0.5 min-w-3 flex-1 bg-primary" />
                <span
                  className="truncate text-muted-foreground text-xs max-sm:hidden"
                  title={label}
                >
                  {label}
                </span>
                <span className="h-0.5 min-w-3 flex-1 bg-primary max-sm:hidden" />
              </span>
              {lanes(rightLevels, touchpoint.supplierLevel)}
              <span className="truncate text-end max-sm:hidden" aria-hidden>
                {touchpoint.supplierName}
              </span>
              {/* Schmal steht die Beschriftung in eigener Zeile unter der Linie. */}
              <span
                className="col-span-full pb-2 text-center text-muted-foreground text-xs sm:hidden"
                aria-hidden
              >
                {label}
              </span>
            </li>
          );
        })}
      </ul>
      <figcaption className="text-muted-foreground text-xs">{text.levelsLegend}</figcaption>
    </figure>
  );
}
