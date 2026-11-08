import { cn } from '@/lib/utils';

/**
 * Bildmarke von Reziproq (PLT-10, Handschrift Bühne): zwei Kreise, die sich überlagern – Käufer und
 * Lieferant mit einer gemeinsamen Fläche. Dekorativ; der Name steht immer daneben.
 */
function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 26 18"
      fill="none"
      strokeWidth={2}
      className={cn('h-4.5 w-6.5 shrink-0', className)}
    >
      <circle cx={9} cy={9} r={8} className="stroke-primary" />
      <circle cx={17} cy={9} r={8} className="stroke-foreground" />
    </svg>
  );
}

export { BrandMark };
