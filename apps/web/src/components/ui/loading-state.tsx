import { LoaderCircleIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

/** Ladezustand: ruhiger Kreisel mit kurzem Text. Bei „Bewegung reduzieren“ steht der Kreisel still. */
function LoadingState({ label, className }: { label: string; className?: string }) {
  return (
    <p
      role="status"
      data-slot="loading-state"
      className={cn('flex items-center gap-2 text-muted-foreground', className)}
    >
      <LoaderCircleIcon className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
      {label}
    </p>
  );
}

export { LoadingState };
