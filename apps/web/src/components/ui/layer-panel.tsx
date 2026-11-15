import { LockIcon } from 'lucide-react';
import type * as React from 'react';

import { cn } from '@/lib/utils';
import { Badge } from './badge';
import { BrandMark } from './brand-mark';

/**
 * Ebene einer Beziehung als Fläche (Designsprache Regel 6). private: grau, Rand 2 px gestrichelt,
 * Schloss, Chip „privat“. shared: Mint, Rand 2 px mint-line, Doppelring, Chip „beide Seiten“.
 */
function LayerPanel({
  layer,
  title,
  chip,
  description,
  headingAs: Heading = 'h2',
  className,
  children,
}: {
  layer: 'private' | 'shared';
  title: React.ReactNode;
  /** z. B. „privat“ oder „beide Seiten“ */
  chip: string;
  description?: React.ReactNode;
  headingAs?: 'h2' | 'h3';
  className?: string;
  children?: React.ReactNode;
}) {
  const shared = layer === 'shared';
  return (
    <section
      data-slot="layer-panel"
      data-layer={layer}
      className={cn(
        'flex flex-col gap-1.5 rounded-lg border-2 p-6',
        shared ? 'border-mint-line bg-mint-soft' : 'border-ring-open border-dashed bg-line-soft',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <Heading
          className={cn(
            'flex items-center gap-2.5 font-display font-semibold text-lg tracking-section-sm',
            shared && 'text-petrol-dark',
          )}
        >
          {shared ? <BrandMark className="h-5 w-7" /> : <LockIcon aria-hidden className="size-5" />}
          {title}
        </Heading>
        <Badge variant={shared ? 'onShared' : 'plain'}>{chip}</Badge>
      </div>
      {description && (
        <p className={cn('mb-1.5 text-sm', shared ? 'text-petrol-dark' : 'text-muted-foreground')}>
          {description}
        </p>
      )}
      {children}
    </section>
  );
}

/** Eintrag in einer Ebene: Titel und eine Zeile darunter, getrennt durch eine feine Linie. */
function LayerItem({
  title,
  detail,
  layer,
}: {
  title: React.ReactNode;
  detail?: React.ReactNode;
  layer: 'private' | 'shared';
}) {
  const shared = layer === 'shared';
  return (
    <div
      data-slot="layer-item"
      className={cn(
        'flex flex-col gap-0.5 border-t py-3 text-sm',
        shared ? 'border-mint-line' : 'border-line',
      )}
    >
      <strong className="font-semibold">{title}</strong>
      {detail && (
        <span className={shared ? 'text-petrol-dark' : 'text-muted-foreground'}>{detail}</span>
      )}
    </div>
  );
}

export { LayerItem, LayerPanel };
