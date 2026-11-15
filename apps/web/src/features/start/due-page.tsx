import { useQuery } from '@tanstack/react-query';
import { useAuth } from 'react-oidc-context';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { ListCard, ListRow, ListRowText } from '@/components/ui/list-card';
import { LoadingState } from '@/components/ui/loading-state';
import { Monogram } from '@/components/ui/monogram';
import { routerLink } from '@/features/shell/navigation';
import { PageHeader } from '@/features/shell/page-header';
import { PagePath } from '@/features/shell/page-path';
import { dueQueryOptions } from '@/lib/api';
import { useLocale, useT } from '@/lib/i18n';
import { dueTitle, formatDate } from './start-page';

/** Alles, was bei mir fällig ist (NAV-05): die volle Liste hinter der Kachel. */
export function DuePage() {
  const t = useT();
  const { locale } = useLocale();
  const auth = useAuth();
  const accessToken = auth.user?.access_token ?? '';
  const query = useQuery({ ...dueQueryOptions(accessToken), enabled: accessToken !== '' });
  const items = query.data?.items ?? [];

  return (
    <>
      <PagePath trail={[{ label: t.start.title, href: '/start' }]} current={t.start.dueTitle} />
      <PageHeader size="list" title={t.start.dueAllTitle} purpose={t.start.dueAllPurpose} />
      {query.isError ? (
        <ErrorState title={t.start.failed} />
      ) : !query.data ? (
        <LoadingState label={t.start.loading} />
      ) : items.length === 0 ? (
        <EmptyState title={t.start.dueEmpty} description={t.start.dueEmptyHint} />
      ) : (
        // Listenkarte nach Vorlage Aufgaben.dc.html: Monogramm, Aufgabe, Termin als Chip.
        <ListCard aria-label={t.start.dueAllTitle}>
          <ul>
            {items.map((item) => (
              <li key={item.id}>
                <ListRow asChild>
                  {routerLink({
                    href: item.href,
                    className: '',
                    children: (
                      <>
                        <Monogram name={item.supplier} />
                        <ListRowText title={item.supplier} detail={dueTitle(t, item)} />
                        <Badge>{t.start.dueBy(formatDate(locale, item.dueDate))}</Badge>
                      </>
                    ),
                  })}
                </ListRow>
              </li>
            ))}
          </ul>
        </ListCard>
      )}
    </>
  );
}
