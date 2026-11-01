import type { AssignmentResponse } from '@reziproq/shared';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from 'react-oidc-context';
import { Badge } from '@/components/ui/badge';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingState } from '@/components/ui/loading-state';
import { SettingsGroup, SettingsLinkRow, SettingsRow } from '@/components/ui/settings-group';
import { routerLink } from '@/features/shell/navigation';
import { assignmentQueryOptions } from '@/lib/api';
import { useT } from '@/lib/i18n';

/** Zuordnung eines Lieferanten (PLT-06), gelesen aus der API. */
export function useAssignment(relationshipId: string) {
  const auth = useAuth();
  const accessToken = auth.user?.access_token ?? '';
  const query = useQuery({
    ...assignmentQueryOptions(accessToken, relationshipId),
    enabled: accessToken !== '',
  });
  return { ...query, accessToken };
}

/** Ein Eintrag mit Kennzeichen: Haupt-Warengruppe, deaktiviert. */
function EntryBadges({
  entries,
}: {
  entries: (AssignmentResponse['businessUnits'][number] & { isPrimary?: boolean })[];
}) {
  const t = useT();
  if (entries.length === 0) return <span className="text-muted-foreground">–</span>;
  return (
    <ul className="flex flex-wrap gap-2 sm:justify-end">
      {entries.map((entry) => (
        <li key={entry.id}>
          <Badge variant={entry.isPrimary ? 'selected' : 'neutral'}>
            {entry.name}
            {entry.isPrimary && (
              <span className="sr-only"> ({t.masterData.assignment.primary})</span>
            )}
            {!entry.active && ` · ${t.masterData.assignment.inactiveMark}`}
          </Badge>
        </li>
      ))}
    </ul>
  );
}

/**
 * Abschnitt „Zuordnung“ im Profil eines Lieferanten (PLT-06): BUs und Warengruppen, die
 * Haupt-Warengruppe hervorgehoben, deaktivierte markiert. Bearbeitet wird auf eigener Seite.
 */
export function AssignmentSection({ relationshipId }: { relationshipId: string }) {
  const t = useT();
  const assignment = useAssignment(relationshipId);
  const texts = t.masterData.assignment;

  if (assignment.isError) return <ErrorState title={texts.failed} />;
  if (!assignment.data) return <LoadingState label={texts.loading} />;
  const { businessUnits, materialGroups, canEdit } = assignment.data;
  return (
    <>
      <SettingsGroup title={texts.title}>
        <SettingsRow label={t.masterData.businessUnits}>
          <EntryBadges entries={businessUnits} />
        </SettingsRow>
        <SettingsRow
          label={t.masterData.materialGroups}
          {...(materialGroups.length > 0 && {
            description: `${texts.primary}: ${materialGroups.find((group) => group.isPrimary)?.name ?? '–'}`,
          })}
        >
          <EntryBadges entries={materialGroups} />
        </SettingsRow>
        {canEdit && (
          <SettingsLinkRow
            href={`/lieferanten/${relationshipId}/strategie/profil/zuordnung`}
            label={texts.edit}
            renderLink={routerLink}
          />
        )}
      </SettingsGroup>
      <p className="-mt-4 px-4 text-muted-foreground text-sm">{texts.purpose}</p>
    </>
  );
}
