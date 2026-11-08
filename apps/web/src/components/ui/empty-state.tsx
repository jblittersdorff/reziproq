import type * as React from 'react';

import { cn } from '@/lib/utils';

/** Leere Seiten und Grafiken erklären, was fehlt und was der nächste Schritt ist. */
function EmptyState({
  icon,
  title,
  description,
  action,
  size = 'default',
  className,
}: {
  icon?: React.ReactNode;
  /** lg: großes Symbol für ganze Seiten, die noch leer sind. */
  size?: 'default' | 'lg';
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-xl bg-card px-6 py-12 text-center',
        size === 'lg' && 'gap-4 rounded-xl py-16',
        className,
      )}
    >
      {icon && (
        <div
          className={cn(
            'flex items-center justify-center rounded-full bg-background text-muted-foreground',
            size === 'lg' ? 'size-20 [&_svg]:size-10' : 'size-10 [&_svg]:size-5',
          )}
        >
          {icon}
        </div>
      )}
      <div className="flex max-w-sm flex-col gap-1">
        <p className="font-semibold text-base">{title}</p>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
      {action}
    </div>
  );
}

export { EmptyState };
