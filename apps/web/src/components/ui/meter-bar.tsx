import { cn } from '@/lib/utils';

/**
 * Balken der Designsprache: 10 px hoch, voll gerundet, Spur line-soft, Füllung Petrol. Der Wert
 * steht als Text daneben oder in label; der Balken allein trägt keine Bedeutung.
 */
function MeterBar({
  value,
  label,
  className,
}: {
  /** 0 bis 1 */
  value: number;
  /** z. B. „Antriebe: 46 % des Umsatzes“ */
  label: string;
  className?: string;
}) {
  const percent = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div data-slot="meter-bar" data-value={percent} className={className}>
      <span className="sr-only">{label}</span>
      <div aria-hidden className="h-2.5 overflow-hidden rounded-full bg-line-soft">
        <span className="block h-full rounded-full bg-petrol" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

export { MeterBar };
