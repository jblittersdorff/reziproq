import { SearchIcon } from 'lucide-react';
import type * as React from 'react';

import { cn } from '@/lib/utils';
import { Input } from './input';

/** Großes Suchfeld mit Lupe, z. B. über Listen. Braucht ein aria-label, wenn kein Label davorsteht. */
function SearchInput({ className, ...props }: Omit<React.ComponentProps<'input'>, 'type'>) {
  return (
    <div data-slot="search-input" className={cn('relative flex-1', className)}>
      <SearchIcon
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground"
      />
      <Input type="search" className="h-12 rounded-lg pl-12 text-lg" {...props} />
    </div>
  );
}

export { SearchInput };
