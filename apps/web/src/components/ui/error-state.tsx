import { TriangleAlertIcon } from 'lucide-react';
import type * as React from 'react';

import { cn } from '@/lib/utils';

/** Fehlerzustand: sagt, was schiefging, und bietet wenn möglich den nächsten Schritt an. */
function ErrorState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role="alert"
      data-slot="error-state"
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-lg bg-card shadow-card px-6 py-12 text-center',
        className,
      )}
    >
      {/* Ruhig: weiße Karte, nur das Symbol trägt die Statusfarbe. */}
      <div className="flex size-10 items-center justify-center rounded-full bg-destructive-soft text-destructive-soft-foreground [&_svg]:size-5">
        <TriangleAlertIcon aria-hidden />
      </div>
      <div className="flex max-w-sm flex-col gap-1">
        <p className="font-semibold text-base">{title}</p>
        {description && <p className="text-muted-foreground text-sm">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export { ErrorState };
