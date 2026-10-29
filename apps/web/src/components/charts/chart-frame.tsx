import { IconChartDots } from '@tabler/icons-react';
import type * as React from 'react';

import { EmptyState } from '@/components/ui/empty-state';

export interface ChartEmptyText {
  title: string;
  description: string;
}

/** Rahmen jeder Grafik: Die Antwort steht als Satz im Titel, ohne Daten ein erklärender leerer Zustand. */
export function ChartFrame({
  title,
  description,
  isEmpty,
  empty,
  children,
}: {
  title: string;
  description?: string | undefined;
  isEmpty: boolean;
  empty: ChartEmptyText;
  children: React.ReactNode;
}) {
  return (
    <figure className="flex flex-col gap-4">
      <figcaption className="flex flex-col gap-1">
        <span className="font-semibold text-lg">{title}</span>
        {description && <span className="text-muted-foreground text-sm">{description}</span>}
      </figcaption>
      {isEmpty ? (
        <EmptyState icon={<IconChartDots />} title={empty.title} description={empty.description} />
      ) : (
        children
      )}
    </figure>
  );
}
