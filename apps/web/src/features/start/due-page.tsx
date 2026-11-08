import { useQuery } from '@tanstack/react-query';
import { useAuth } from 'react-oidc-context';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { routerLink } from '@/features/shell/navigation';
import { PageHeader } from '@/features/shell/page-header';
import { PagePath } from '@/features/shell/page-path';
import { dueQueryOptions } from '@/lib/api';
import { useLocale, useT } from '@/lib/i18n';
import { dueTitle, formatDate, itemLinkClass } from './start-page';

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
      <PageHeader title={t.start.dueAllTitle} purpose={t.start.dueAllPurpose} />
      {query.isError ? (
        <ErrorState title={t.start.failed} />
      ) : !query.data ? (
        <LoadingState label={t.start.loading} />
      ) : items.length === 0 ? (
        <EmptyState title={t.start.dueEmpty} description={t.start.dueEmptyHint} />
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-md border">
          {items.map((item) => (
            <li key={item.id}>
              {routerLink({
                href: item.href,
                className: `${itemLinkClass} p-4`,
                children: (
                  <>
                    <span className="font-semibold text-lg">{item.supplier}</span>
                    <span className="text-muted-foreground text-sm">
                      {dueTitle(t, item)} · {t.start.dueBy(formatDate(locale, item.dueDate))}
                    </span>
                  </>
                ),
              })}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
