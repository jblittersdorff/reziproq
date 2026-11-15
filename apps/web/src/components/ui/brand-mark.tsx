import { cn } from '@/lib/utils';

/**
 * Logo von Reziproq (Designsprache „Zwei Kreise“): zwei Ringe, links Tinte, rechts Petrol,
 * die Überlappung Mint gefüllt – zwei Seiten und ein geteilter Raum. Dekorativ.
 * Derselbe Doppelring kennzeichnet Geteiltes und Entwürfe von Reziproq.
 */
function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 28 20"
      fill="none"
      strokeWidth={2}
      data-slot="brand-mark"
      className={cn('h-5 w-7 shrink-0', className)}
    >
      <path d="M14 3.07A8 8 0 0 1 14 16.93A8 8 0 0 1 14 3.07Z" className="fill-mint" />
      <circle cx={10} cy={10} r={8} className="stroke-ink" />
      <circle cx={18} cy={10} r={8} className="stroke-petrol" />
    </svg>
  );
}

/** Logo mit Wortmarke in Outfit 600. */
function Logo({ name, className }: { name: string; className?: string }) {
  return (
    <span
      data-slot="logo"
      className={cn(
        'inline-flex items-center gap-2.5 font-display font-semibold text-lg tracking-section-sm',
        className,
      )}
    >
      <BrandMark className="h-6 w-8.5" />
      {name}
    </span>
  );
}

export { BrandMark, Logo };
