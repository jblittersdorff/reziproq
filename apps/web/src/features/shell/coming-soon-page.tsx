import { IconCalendarClock } from '@tabler/icons-react';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { useT } from '@/lib/i18n';
import type { Messages } from '@/locales/de';
import { PageHeader } from './page-header';

export type ComingSoonPageKey = Exclude<keyof Messages['pages'], 'settings'>;

/** Seite, deren Funktion noch kommt: Titel, Zweck und ein leerer Zustand mit dem Release. */
export function ComingSoonPage({ page, release }: { page: ComingSoonPageKey; release: string }) {
  const t = useT();
  const texts = t.pages[page];
  return (
    <>
      <PageHeader title={texts.title} purpose={texts.purpose} />
      <EmptyState
        icon={<IconCalendarClock />}
        title={texts.emptyTitle}
        description={texts.emptyDescription}
        action={<Badge variant="selected">{t.comingWith(release)}</Badge>}
      />
    </>
  );
}
