import type { ReactNode } from 'react';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from './page-header';

/** Seite der Hauptebene, deren Inhalt eine spätere Spec liefert: Titel und leerer Zustand. */
export function ComingPage({
  title,
  purpose,
  icon,
  emptyTitle,
  emptyDescription,
}: {
  title: string;
  purpose: string;
  icon: ReactNode;
  emptyTitle: string;
  emptyDescription: string;
}) {
  return (
    <>
      <PageHeader title={title} purpose={purpose} />
      <EmptyState size="lg" icon={icon} title={emptyTitle} description={emptyDescription} />
    </>
  );
}
