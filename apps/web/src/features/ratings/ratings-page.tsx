import type { RatingAssignment } from '@reziproq/shared';
import { useQuery } from '@tanstack/react-query';
import { ClipboardCheckIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { StatusLine } from '@/components/ui/status-line';
import { routerLink } from '@/features/shell/navigation';
import { PageHeader } from '@/features/shell/page-header';
import { myRatingsQueryOptions } from '@/lib/api';
import { useFlash } from '@/lib/flash';
import { useLocale, useT } from '@/lib/i18n';
import { formatDate, linkClass, ratingsPath, useToken } from './use-rating';

const statusVariant = { open: 'neutral', in_progress: 'selected', submitted: 'success' } as const;

/** Meine Bewertungen (SEG-04): offene und abgegebene Zuordnungen der angemeldeten Person. */
export function RatingsPage() {
  const t = useT();
  const { locale } = useLocale();
  const accessToken = useToken();
  const [flashMessage, hideFlash] = useFlash();
  const query = useQuery({ ...myRatingsQueryOptions(accessToken), enabled: accessToken !== '' });
  const assignments = query.data?.assignments ?? [];

  return (
    <>
      <PageHeader title={t.ratings.title} purpose={t.ratings.purpose} />
      {flashMessage && <StatusLine message={flashMessage} onHidden={hideFlash} />}
      {query.isError ? (
        <ErrorState title={t.ratings.failed} />
      ) : !query.data ? (
        <LoadingState label={t.ratings.loading} />
      ) : assignments.length === 0 ? (
        <EmptyState
          icon={<ClipboardCheckIcon aria-hidden />}
          title={t.ratings.emptyTitle}
          description={t.ratings.emptyDescription}
        />
      ) : (
        <ul className="flex flex-col divide-y divide-line-soft rounded-md border">
          {assignments.map((assignment) => (
            <AssignmentRow key={assignment.id} assignment={assignment} locale={locale} />
          ))}
        </ul>
      )}
    </>
  );
}

function AssignmentRow({ assignment, locale }: { assignment: RatingAssignment; locale: string }) {
  const t = useT();
  const closed = assignment.roundStatus === 'closed';
  const action = closed
    ? t.ratings.view
    : assignment.status === 'open'
      ? t.ratings.start
      : assignment.status === 'in_progress'
        ? t.ratings.resume
        : t.ratings.view;
  const details = [
    assignment.businessUnit.name,
    assignment.materialGroup?.name,
    t.ratings.due(formatDate(locale, assignment.dueDate)),
  ].filter(Boolean);
  return (
    <li className="flex flex-wrap items-center gap-x-6 gap-y-2 p-4">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="font-semibold text-lg">{assignment.supplier}</span>
        <span className="text-muted-foreground text-sm">{details.join(' · ')}</span>
      </div>
      <Badge variant={statusVariant[assignment.status]}>
        {t.ratings.status[assignment.status]}
      </Badge>
      {routerLink({
        href: `${ratingsPath}/${assignment.id}`,
        className: linkClass,
        children: action,
      })}
    </li>
  );
}
