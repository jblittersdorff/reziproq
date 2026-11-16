import { useQuery } from '@tanstack/react-query';
import { MessageSquareTextIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { ListCard, ListCardHeader, ListRow, ListRowText } from '@/components/ui/list-card';
import { LoadingState } from '@/components/ui/loading-state';
import { useToken } from '@/features/ratings/use-rating';
import { routerLink } from '@/features/shell/navigation';
import { PageHeader } from '@/features/shell/page-header';
import { myFeedbackQueryOptions } from '@/lib/api';
import { useFormat } from '@/lib/format';
import { useT } from '@/lib/i18n';

function useMyFeedback() {
  const accessToken = useToken();
  return useQuery({ ...myFeedbackQueryOptions(accessToken), enabled: accessToken !== '' });
}

/**
 * Feedback in der App: alle Fragebögen, zu denen die Person eingeladen ist, beide Seiten. Offene
 * stehen oben und führen direkt zum Bogen.
 */
export function MyFeedbackPage() {
  const text = useT().myFeedback;
  const format = useFormat();
  const query = useMyFeedback();
  const invitations = query.data?.invitations ?? [];
  const open = invitations.filter((entry) => entry.status === 'open');
  const done = invitations.filter((entry) => entry.status !== 'open');

  return (
    <>
      <PageHeader size="list" title={text.title} purpose={text.purpose} />
      {query.isError ? (
        <ErrorState title={text.failed} />
      ) : !query.data ? (
        <LoadingState label={text.loading} />
      ) : open.length === 0 && done.length === 0 ? (
        <EmptyState
          icon={<MessageSquareTextIcon aria-hidden />}
          title={text.emptyTitle}
          description={text.emptyText}
        />
      ) : (
        <>
          {open.length === 0 ? (
            <EmptyState title={text.emptyTitle} description={text.emptyText} />
          ) : (
            <ListCard aria-label={text.open}>
              <ListCardHeader title={text.open} />
              <ul>
                {open.map((entry) => (
                  <li key={entry.id}>
                    <ListRow>
                      <ListRowText
                        title={entry.counterpart}
                        detail={`${text.kinds[entry.kind]} · ${text.due(format.date(entry.dueDate))}`}
                      />
                      {routerLink({
                        href: `/feedback/${entry.id}`,
                        className: buttonVariants({ size: 'sm' }),
                        'aria-label': `${text.answer}: ${entry.counterpart}`,
                        children: text.answer,
                      })}
                    </ListRow>
                  </li>
                ))}
              </ul>
            </ListCard>
          )}
          {done.length > 0 && (
            <ListCard aria-label={text.done}>
              <ListCardHeader title={text.done} />
              <ul>
                {done.map((entry) => (
                  <li key={entry.id}>
                    <ListRow>
                      <ListRowText
                        title={entry.counterpart}
                        detail={`${text.kinds[entry.kind]} · ${text.due(format.date(entry.dueDate))}`}
                      />
                      <Badge variant={entry.status === 'used' ? 'success' : 'neutral'}>
                        {text.statuses[entry.status]}
                      </Badge>
                    </ListRow>
                  </li>
                ))}
              </ul>
            </ListCard>
          )}
        </>
      )}
    </>
  );
}

/**
 * Auf den Feedback-Seiten einer Beziehung (beide Seiten): Ist die Person zu einer offenen Welle
 * eingeladen, steht hier „Jetzt beantworten“.
 */
export function MyInvitationNotice({
  relationshipId,
  waveId,
}: {
  relationshipId: string;
  waveId?: string;
}) {
  const text = useT().myFeedback;
  const query = useMyFeedback();
  const invitation = query.data?.invitations.find(
    (entry) =>
      entry.status === 'open' &&
      entry.relationshipId === relationshipId &&
      (waveId === undefined || entry.waveId === waveId),
  );
  if (!invitation) return null;
  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-mint-soft px-5 py-4 text-petrol-dark"
    >
      <p className="font-semibold">{text.banner}</p>
      <Button asChild>
        {routerLink({ href: `/feedback/${invitation.id}`, className: '', children: text.answer })}
      </Button>
    </div>
  );
}
