import type { TeamResponse, TeamRole, UserFunction } from '@reziproq/shared';
import { UsersIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
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
import { VisibilityBadge } from '@/components/ui/visibility-badge';
import { AuditHistory } from '@/features/audit/audit-history';
import { CustomerFrame } from '@/features/customers/customer-frame';
import { InvitationsSection } from '@/features/invitations/invitations-section';
import { routerLink } from '@/features/shell/navigation';
import { PageHeader } from '@/features/shell/page-header';
import type { TeamSide } from '@/lib/api';
import { useFlash } from '@/lib/flash';
import { useT } from '@/lib/i18n';
import { SupplierFrame } from './supplier-frame';
import { useTeam } from './use-team';

/** Adresse der Team-Seite je Seite der Beziehung (PLB-04). */
export const teamPath = (side: TeamSide, relationshipId: string) =>
  side === 'buyer'
    ? `/lieferanten/${relationshipId}/beziehung/team`
    : `/kunden/${relationshipId}/beziehung/team`;

/** Teamrollen je Seite: beim Lieferanten heißt „sro“ Key Account Manager. */
export function useRoleLabels() {
  const t = useT();
  return (side: TeamSide) => (side === 'buyer' ? t.team.roles : t.team.supplierRoles);
}

/** Rahmen mit Pfad: Lieferant › Beziehung beim Käufer, Kunde › Beziehung beim Lieferanten. */
export function TeamFrame({
  side,
  relationshipId,
  trail = [],
  current,
  children,
}: {
  side: TeamSide;
  relationshipId: string;
  trail?: { label: string; href: string }[];
  current: string;
  children: ReactNode;
}) {
  return side === 'buyer' ? (
    <SupplierFrame
      relationshipId={relationshipId}
      area="relationship"
      trail={() => trail}
      current={current}
    >
      {() => children}
    </SupplierFrame>
  ) : (
    <CustomerFrame relationshipId={relationshipId} trail={trail} current={current}>
      {children}
    </CustomerFrame>
  );
}

/**
 * Beziehung › Team (PLT-05b, PLB-04): zwei Spalten, unser Team mit Kennzeichen Intern oder Geteilt
 * und die geteilten Mitglieder der anderen Seite. Bearbeiten nur, wenn das Backend es erlaubt.
 */
export function TeamPage({
  relationshipId,
  side = 'buyer',
}: {
  relationshipId: string;
  side?: TeamSide;
}) {
  const t = useT();
  const team = useTeam(relationshipId, side);
  const [message, hideMessage] = useFlash();
  const other: TeamSide = side === 'buyer' ? 'supplier' : 'buyer';

  return (
    <TeamFrame side={side} relationshipId={relationshipId} current={t.team.title}>
      <PageHeader
        title={t.team.title}
        purpose={side === 'buyer' ? t.team.purpose : t.team.supplierPurpose}
      />
      {message && <StatusLine message={message} onHidden={hideMessage} />}
      {team.isError ? (
        <ErrorState title={t.team.failed} />
      ) : !team.data ? (
        <LoadingState label={t.team.loading} />
      ) : (
        <>
          {team.data.canEdit && (
            <div>
              {routerLink({
                href: `${teamPath(side, relationshipId)}/bearbeiten`,
                className: buttonVariants(),
                children: (
                  <>
                    <UsersIcon />
                    {t.team.edit}
                  </>
                ),
              })}
            </div>
          )}
          <div className="grid gap-8 lg:grid-cols-2">
            <section aria-labelledby="team-unser" className="flex min-w-0 flex-col gap-4">
              <h2 id="team-unser" className="font-semibold text-lg">
                {t.team.ours}
              </h2>
              <OwnTeam team={team.data} side={side} relationshipId={relationshipId} />
            </section>
            <section aria-labelledby="team-andere" className="flex min-w-0 flex-col gap-4">
              <h2 id="team-andere" className="font-semibold text-lg">
                {t.team.theirs[side]}
              </h2>
              {team.data.counterpart.length === 0 ? (
                <p className="rounded-lg bg-card px-4 py-3 text-muted-foreground">
                  {t.team.theirsEmpty}
                </p>
              ) : (
                <MemberTable
                  caption={t.team.theirs[side] ?? ''}
                  side={other}
                  members={team.data.counterpart.map((member, index) => ({
                    key: `${index}-${member.name}`,
                    ...member,
                  }))}
                />
              )}
            </section>
          </div>
        </>
      )}
      {side === 'buyer' && <InvitationsSection relationshipId={relationshipId} />}
      <section aria-labelledby="team-verlauf" className="flex flex-col gap-4">
        <h2 id="team-verlauf" className="font-semibold text-lg">
          {t.suppliers.history}
        </h2>
        <AuditHistory objectType="relationship_member" objectId={relationshipId} />
      </section>
    </TeamFrame>
  );
}

function OwnTeam({
  team,
  side,
  relationshipId,
}: {
  team: TeamResponse;
  side: TeamSide;
  relationshipId: string;
}) {
  const t = useT();
  if (team.members.length === 0) {
    return (
      <EmptyState
        icon={<UsersIcon aria-hidden />}
        title={t.team.emptyTitle}
        description={t.team.emptyDescription}
      />
    );
  }
  return (
    <>
      {!team.members.some((member) => member.teamRole === 'sro') && (
        <p
          role="status"
          className="rounded-lg bg-warning-soft px-4 py-3 text-warning-soft-foreground"
        >
          {side === 'buyer' ? t.team.noSro : t.team.noKam}
        </p>
      )}
      <MemberTable
        caption={t.team.ours}
        side={side}
        roleHref={team.sroDescription ? `${teamPath(side, relationshipId)}/sro` : undefined}
        members={team.members.map((member) => ({ key: member.userId, ...member }))}
      />
    </>
  );
}

function MemberTable({
  caption,
  side,
  members,
  roleHref,
}: {
  caption: string;
  side: TeamSide;
  members: {
    key: string;
    name: string;
    teamRole: TeamRole;
    function: UserFunction | null;
    visibility?: 'internal' | 'shared';
  }[];
  /** Ziel der Rollenbeschreibung des SRO (nur beim Käufer) */
  roleHref?: string | undefined;
}) {
  const t = useT();
  const roles = useRoleLabels()(side);
  return (
    <Table>
      <caption className="sr-only">{caption}</caption>
      <TableHeader>
        <TableRow>
          <TableHead>{t.team.person}</TableHead>
          <TableHead>{t.team.role}</TableHead>
          <TableHead>{t.team.function}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {members.map((member) => (
          <TableRow key={member.key}>
            <TableCell>
              {/* Kennzeichen direkt am Namen, damit die Tabelle auch schmal drei Spalten hat. */}
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-medium">{member.name}</span>
                {member.visibility && (
                  <VisibilityBadge
                    visibility={member.visibility}
                    label={t.team.visibilities[member.visibility] ?? ''}
                  />
                )}
              </span>
            </TableCell>
            <TableCell>
              {member.teamRole === 'sro' && roleHref ? (
                routerLink({
                  href: roleHref,
                  'aria-label': `${roles.sro}: ${t.team.roleLink}`,
                  className:
                    'inline-flex min-h-11 items-center rounded-md focus-visible:outline-2 focus-visible:outline-ring',
                  children: <Badge variant="selected">{roles.sro}</Badge>,
                })
              ) : (
                <Badge variant={member.teamRole === 'sro' ? 'selected' : 'neutral'}>
                  {roles[member.teamRole]}
                </Badge>
              )}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {member.function ? t.roles.functions[member.function] : '–'}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/** Rollenbeschreibung des SRO auf eigener Seite (PLB-04), aus der Team-Seite verlinkt. */
export function RolePage({ relationshipId }: { relationshipId: string }) {
  const t = useT();
  const team = useTeam(relationshipId, 'buyer');
  const description = team.data?.sroDescription;
  return (
    <TeamFrame
      side="buyer"
      relationshipId={relationshipId}
      trail={[{ label: t.team.title, href: teamPath('buyer', relationshipId) }]}
      current={t.team.roleTitle}
    >
      <PageHeader title={t.team.roleTitle} purpose={t.team.rolePurpose} />
      {team.isError ? (
        <ErrorState title={t.team.failed} />
      ) : !team.data ? (
        <LoadingState label={t.team.loading} />
      ) : !description ? (
        <EmptyState
          icon={<UsersIcon aria-hidden />}
          title={t.team.roleTitle}
          description={t.team.rolePurpose}
        />
      ) : (
        <>
          <div className="grid gap-6 md:grid-cols-2">
            <RoleList id="rolle-macht" title={t.team.does} items={description.does} />
            <RoleList id="rolle-macht-nicht" title={t.team.doesNot} items={description.doesNot} />
          </div>
          <p className="text-muted-foreground text-sm">
            {description.updatedByName
              ? t.team.roleChangedBy(description.updatedByName)
              : t.team.roleDefault}
          </p>
        </>
      )}
    </TeamFrame>
  );
}

function RoleList({ id, title, items }: { id: string; title: string; items: string[] }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3 rounded-lg bg-card p-4">
      <h2 id={id} className="font-semibold text-lg">
        {title}
      </h2>
      <ul className="flex list-disc flex-col gap-1 ps-5">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}
