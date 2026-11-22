import { MeterBar } from '@/components/ui/meter-bar';

/**
 * Fortschritt von der Basis zum Ziel (AW-01): Balken und Wert als Text; ohne Wert „noch kein Wert“,
 * bei Ziel gleich Basis nur der Text. Die Rechnung kommt aus progressFromBaseline (shared).
 */
function BaselineProgress({
  progress,
  label,
  emptyLabel,
  format,
}: {
  /** 0 bis 1 oder null */
  progress: number | null;
  /** z. B. „Fortschritt“ für Screenreader */
  label: string;
  emptyLabel: string;
  format: (share: number) => string;
}) {
  if (progress === null) {
    return <span className="text-muted-foreground text-sm">{emptyLabel}</span>;
  }
  return (
    <span data-slot="baseline-progress" className="flex min-w-0 items-center gap-2 text-sm">
      <MeterBar className="w-20" value={progress} label={`${label}: ${format(progress)}`} />
      <span className="tabular-nums" aria-hidden>
        {format(progress)}
      </span>
    </span>
  );
}

export { BaselineProgress };
