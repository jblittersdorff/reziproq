import type { RoundStatus, RoundSummary } from '@reziproq/shared';
import { useQuery } from '@tanstack/react-query';
import { ChartScatterIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { StatusLine } from '@/components/ui/status-line';
import { useCan } from '@/features/auth/use-permissions';
import { routerLink } from '@/features/shell/navigation';
import { PageHeader } from '@/features/shell/page-header';
import { PagePath } from '@/features/shell/page-path';
import { roundsQueryOptions } from '@/lib/api';
import { useFlash } from '@/lib/flash';
import { useLocale, useT } from '@/lib/i18n';
import { formatDate, linkClass, roundsPath, useToken } from './use-round';

const statusVariant: Record<RoundStatus, 'neutral' | 'selected' | 'success'> = {
  draft: 'neutral',
  open: 'selected',
  closed: 'success',
};

/** Bewertungsrunden (SEG-03): alle Runden mit Status, Frist und Fortschritt. */
export function RoundsPage() {
  const t = useT();
  const { locale } = useLocale();
  const accessToken = useToken();
  const canManage = useCan('runden.verwalten');
  const [flashMessage, hideFlash] = useFlash();
  const query = useQuery({ ...roundsQueryOptions(accessToken), enabled: accessToken !== '' });
  const rounds = query.data?.rounds ?? [];

  return (
    <>
      <PagePath
        trail={[{ label: t.portfolio.title, href: '/portfolio' }]}
        current={t.rounds.title}
      />
      <PageHeader title={t.rounds.title} purpose={t.rounds.purpose} />
      {flashMessage && <StatusLine message={flashMessage} onHidden={hideFlash} />}
      {query.isError ? (
        <ErrorState title={t.rounds.failed} />
      ) : !query.data ? (
        <LoadingState label={t.rounds.loading} />
      ) : (
        <div className="flex flex-col gap-6">
          {canManage &&
            routerLink({
              href: `${roundsPath}/neu`,
              className: `${buttonVariants()} self-start`,
              children: t.rounds.newRound,
            })}
          {rounds.length === 0 ? (
            <EmptyState
              icon={<ChartScatterIcon aria-hidden />}
              title={t.rounds.emptyTitle}
              description={canManage ? t.rounds.emptyDescription : t.rounds.emptyReadOnly}
            />
          ) : (
            <ul className="flex flex-col divide-y divide-line-soft rounded-md border">
              {rounds.map((round) => (
                <RoundRow key={round.id} round={round} locale={locale} />
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  );
}

function RoundRow({ round, locale }: { round: RoundSummary; locale: string }) {
  const t = useT();
  const href =
    round.status === 'draft' ? `${roundsPath}/${round.id}/name` : `${roundsPath}/${round.id}`;
  return (
    <li className="flex flex-wrap items-center gap-x-6 gap-y-2 p-4">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="font-semibold text-lg">{round.name}</span>
        <span className="text-muted-foreground text-sm">
          {t.rounds.due(formatDate(locale, round.dueDate))}
          {round.status !== 'draft' && ` · ${t.rounds.progress(round.submitted, round.total)}`}
        </span>
      </div>
      <Badge variant={statusVariant[round.status]}>{t.rounds.status[round.status]}</Badge>
      {routerLink({
        href,
        className: linkClass,
        children: round.status === 'draft' ? t.rounds.continueDraft : t.rounds.open,
      })}
    </li>
  );
}
