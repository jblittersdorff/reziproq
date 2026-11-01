import { Link } from '@tanstack/react-router';
import { UsersIcon } from 'lucide-react';
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
import { AuditHistory } from '@/features/audit/audit-history';
import { PageHeader } from '@/features/shell/page-header';
import { useFlash } from '@/lib/flash';
import { useT } from '@/lib/i18n';
import { SupplierFrame } from './supplier-frame';
import { useTeam } from './use-team';

/**
 * Lieferant › Beziehung › Team (PLT-05b): das interne Team mit SRO, Sponsoren, Mitgliedern und
 * Lesern samt Funktion. Bearbeiten nur für Admins (can() im Backend).
 */
export function TeamPage({ relationshipId }: { relationshipId: string }) {
  const t = useT();
  const team = useTeam(relationshipId);
  const [message, hideMessage] = useFlash();

  return (
    <SupplierFrame relationshipId={relationshipId} area="relationship" current={t.team.title}>
      {(supplier) => (
        <>
          <PageHeader title={t.team.title} purpose={t.team.purpose} />
          {message && <StatusLine message={message} onHidden={hideMessage} />}
          {team.isError ? (
            <ErrorState title={t.team.failed} />
          ) : !team.data ? (
            <LoadingState label={t.team.loading} />
          ) : (
            <>
              {supplier.permissions.editTeam && (
                <div>
                  <Button asChild>
                    <Link
                      to="/lieferanten/$id/beziehung/team/bearbeiten"
                      params={{ id: relationshipId }}
                    >
                      <UsersIcon />
                      {t.team.edit}
                    </Link>
                  </Button>
                </div>
              )}
              {team.data.members.length === 0 ? (
                <EmptyState
                  size="lg"
                  icon={<UsersIcon aria-hidden />}
                  title={t.team.emptyTitle}
                  description={t.team.emptyDescription}
                />
              ) : (
                <>
                  {!team.data.members.some((member) => member.teamRole === 'sro') && (
                    <p
                      role="status"
                      className="rounded-lg bg-warning-soft px-4 py-3 text-warning-soft-foreground"
                    >
                      {t.team.noSro}
                    </p>
                  )}
                  <Table>
                    <caption className="sr-only">{t.team.title}</caption>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t.team.person}</TableHead>
                        <TableHead>{t.team.role}</TableHead>
                        <TableHead>{t.team.function}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {team.data.members.map((member) => (
                        <TableRow key={member.userId}>
                          <TableCell className="font-medium">{member.name}</TableCell>
                          <TableCell>
                            <Badge variant={member.teamRole === 'sro' ? 'selected' : 'neutral'}>
                              {t.team.roles[member.teamRole]}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {member.function ? t.roles.functions[member.function] : '–'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </>
              )}
            </>
          )}
          <section aria-labelledby="team-verlauf" className="flex flex-col gap-4">
            <h2 id="team-verlauf" className="font-semibold text-lg">
              {t.suppliers.history}
            </h2>
            <AuditHistory objectType="relationship_member" objectId={relationshipId} />
          </section>
        </>
      )}
    </SupplierFrame>
  );
}
