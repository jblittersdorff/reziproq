import { MeterBar } from '@/components/ui/meter-bar';
import { cn } from '@/lib/utils';

/**
 * Anteile als Zeilen (WG-Lieferanten.dc.html, „Segmente in der Warengruppe“): Name, Balken, Wert
 * als Text, dazu eine Notiz. Auf Telefonbreite steht die Notiz unter dem Balken.
 */
function ShareRows({
  rows,
  className,
}: {
  rows: {
    key: string;
    label: string;
    share: number;
    value: string;
    note?: string;
    srLabel: string;
  }[];
  className?: string;
}) {
  return (
    <ul className={cn('flex flex-col gap-3', className)}>
      {rows.map((row) => (
        <li
          key={row.key}
          className="grid grid-cols-[minmax(0,--spacing(30))_minmax(0,1fr)_--spacing(12)] items-center gap-x-3 gap-y-1 text-sm sm:grid-cols-[--spacing(30)_minmax(0,2fr)_--spacing(12)_minmax(--spacing(30),1.4fr)]"
        >
          <strong className="truncate font-semibold">{row.label}</strong>
          <MeterBar value={row.share} label={row.srLabel} />
          <span className="text-right tabular-nums">{row.value}</span>
          {row.note && (
            <span className="col-span-3 text-muted-foreground text-xs sm:col-span-1 sm:text-sm">
              {row.note}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

export { ShareRows };
