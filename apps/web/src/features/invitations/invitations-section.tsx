import type { Invitation, InvitationStatus } from '@reziproq/shared';
import { Link } from '@tanstack/react-router';
import { MailPlusIcon } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { StatusLine } from '@/components/ui/status-line';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { revokeInvitation } from '@/lib/api';
import { useFormat } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { useInvitations, useRefreshInvitations } from './use-invitations';

const statusVariant: Record<InvitationStatus, 'success' | 'selected' | 'neutral'> = {
  accepted: 'success',
  open: 'selected',
  expired: 'neutral',
  revoked: 'neutral',
};

/**
 * Abschnitt „Personen des Lieferanten“ auf der Team-Seite (LIF-01a): wer eingeladen ist und wer
 * schon angenommen hat. Einladen und Zurückziehen nur für Admin und SRO (can() im Backend).
 */
export function InvitationsSection({ relationshipId }: { relationshipId: string }) {
  const t = useT();
  const text = t.invitations;
  const format = useFormat();
  const invitations = useInvitations(relationshipId);
  const refresh = useRefreshInvitations();
  const [message, setMessage] = useState<{ text: string; tone?: 'warning' } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const revoke = async (invitation: Invitation) => {
    setBusy(invitation.id);
    try {
      await revokeInvitation(invitations.accessToken, relationshipId, invitation.id);
      await refresh(relationshipId);
      setMessage({ text: text.revoked });
    } catch {
      setMessage({ text: text.revokeFailed, tone: 'warning' });
    } finally {
      setBusy(null);
    }
  };

  const data = invitations.data;
  const inviteButton = data?.canInvite ? (
    <Button asChild variant="outline">
      <Link to="/lieferanten/$id/beziehung/team/einladen" params={{ id: relationshipId }}>
        <MailPlusIcon />
        {text.invite}
      </Link>
    </Button>
  ) : undefined;

  return (
    <section aria-labelledby="lieferant-personen" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="lieferant-personen" className="font-semibold text-lg">
          {text.section}
        </h2>
        <p className="text-muted-foreground">{text.sectionHint}</p>
      </div>
      {message && (
        <StatusLine
          message={message.text}
          {...(message.tone ? { tone: message.tone } : {})}
          onHidden={() => setMessage(null)}
        />
      )}
      {invitations.isError ? (
        <ErrorState title={text.failed} />
      ) : !data ? (
        <LoadingState label={text.loading} />
      ) : data.invitations.length === 0 ? (
        <EmptyState
          icon={<MailPlusIcon aria-hidden />}
          title={text.emptyTitle}
          description={text.emptyDescription}
          action={inviteButton}
        />
      ) : (
        <>
          {inviteButton && <div>{inviteButton}</div>}
          <Table>
            <caption className="sr-only">{text.section}</caption>
            <TableHeader>
              <TableRow>
                <TableHead>{text.email}</TableHead>
                <TableHead>{text.status}</TableHead>
                <TableHead className="hidden sm:table-cell">{text.invitedBy}</TableHead>
                <TableHead className="hidden sm:table-cell">{text.validUntil}</TableHead>
                {data.canInvite && (
                  <TableHead>
                    <span className="sr-only">{text.revoke}</span>
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.invitations.map((invitation) => (
                <TableRow key={invitation.id}>
                  <TableCell className="whitespace-normal font-medium [overflow-wrap:anywhere]">
                    {invitation.email}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[invitation.status]}>
                      {text.statuses[invitation.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">
                    {invitation.invitedBy}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground tabular-nums sm:table-cell">
                    {invitation.status === 'open' ? format.date(invitation.expiresAt) : '–'}
                  </TableCell>
                  {data.canInvite && (
                    <TableCell className="text-right">
                      {invitation.status === 'open' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          loading={busy === invitation.id}
                          aria-label={text.revokeLabel(invitation.email)}
                          onClick={() => void revoke(invitation)}
                        >
                          {text.revoke}
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}
    </section>
  );
}
