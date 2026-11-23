import type * as React from 'react';

import { cn } from '@/lib/utils';

// Schieberegler als natives Feld: Tastatur (Pfeile, Pos1, Ende) und Bildschirmleser ohne
// eigenes Zutun. Klickfläche 44 px hoch (PLT-10), Farbe aus dem Token primary.
function Range({ className, ...props }: Omit<React.ComponentProps<'input'>, 'type'>) {
  return (
    <input
      type="range"
      data-slot="range"
      className={cn(
        'h-11 w-full cursor-pointer accent-primary outline-none focus-visible:ring-3 focus-visible:ring-ring/50 rounded-full disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

export { Range };
