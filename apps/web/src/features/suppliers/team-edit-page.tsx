import {
  defaultTeamVisibility,
  type TeamError,
  type TeamResponse,
  type TeamRole,
  type TeamVisibility,
  teamErrors,
  teamRoles,
  teamVisibilities,
  type UserFunction,
  updateTeamRequestSchema,
  userFunctions,
} from '@reziproq/shared';
import { useQueryClient } from '@tanstack/react-query';
import { PlusIcon, Trash2Icon } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { FormActions, FormField } from '@/components/ui/form-field';
import { LoadingState } from '@/components/ui/loading-state';
import { NativeSelect } from '@/components/ui/native-select';
import { PageHeader } from '@/features/shell/page-header';
import { useGoBack } from '@/features/shell/page-path';
import { ApiError, type TeamSide, updateTeam } from '@/lib/api';
import { flash } from '@/lib/flash';
import { useT } from '@/lib/i18n';
import { TeamFrame, teamPath, useRoleLabels } from './team-page';
import { useTeam } from './use-team';

interface Row {
  userId: string;
  name: string;
  teamRole: TeamRole;
  function: UserFunction | null;
  visibility: TeamVisibility;
}

/**
 * Team › Bearbeiten (PLT-05b, PLB-04) als Formularseite: jede Seite pflegt nur ihr Team, mit
 * Sichtbarkeit je Person. Speichern führt zurück.
 */
export function TeamEditPage({
  relationshipId,
  side = 'buyer',
}: {
  relationshipId: string;
  side?: TeamSide;
}) {
  const t = useT();
  const team = useTeam(relationshipId, side);
  const teamPage = teamPath(side, relationshipId);
  return (
    <TeamFrame
      side={side}
      relationshipId={relationshipId}
      trail={[{ label: t.team.title, href: teamPage }]}
      current={t.team.edit}
    >
      <PageHeader title={t.team.editTitle} purpose={t.team.editPurpose} />
      {team.isError ? (
        <ErrorState title={t.team.failed} />
      ) : !team.data ? (
        <LoadingState label={t.team.loading} />
      ) : (
        <TeamForm
          team={team.data}
          side={side}
          relationshipId={relationshipId}
          accessToken={team.accessToken}
          teamPage={teamPage}
        />
      )}
    </TeamFrame>
  );
}

function TeamForm({
  team,
  side,
  relationshipId,
  accessToken,
  teamPage,
}: {
  team: TeamResponse;
  side: TeamSide;
  relationshipId: string;
  accessToken: string;
  teamPage: string;
}) {
  const t = useT();
  const queryClient = useQueryClient();
  const goBack = useGoBack(teamPage);
  const roles = useRoleLabels()(side);
  const errors = side === 'buyer' ? t.team.errors : t.team.supplierErrors;
  const [rows, setRows] = useState<Row[]>(team.members);
  const [adding, setAdding] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const available = team.candidates.filter(
    (person) => !rows.some((row) => row.userId === person.userId),
  );
  const update = (userId: string, change: Partial<Row>) =>
    setRows(rows.map((row) => (row.userId === userId ? { ...row, ...change } : row)));

  const add = () => {
    const person = team.candidates.find((candidate) => candidate.userId === adding);
    if (!person) return;
    setRows([
      ...rows,
      {
        userId: person.userId,
        name: person.name,
        teamRole: 'member',
        function: person.defaultFunction,
        visibility: defaultTeamVisibility('member'),
      },
    ]);
    setAdding('');
  };

  const errorText = (code: unknown) =>
    teamErrors.includes(code as TeamError) ? errors[code as TeamError] : t.team.saveFailed;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const request = {
      members: rows.map(({ userId, teamRole, function: fn, visibility }) => ({
        userId,
        teamRole,
        function: fn,
        visibility,
      })),
    };
    const parsed = updateTeamRequestSchema.safeParse(request);
    if (!parsed.success) {
      setError(errorText(parsed.error.issues[0]?.message));
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await updateTeam(accessToken, relationshipId, parsed.data, side);
      void queryClient.invalidateQueries({
        queryKey: [side === 'buyer' ? 'suppliers' : 'kunden', relationshipId],
      });
      void queryClient.invalidateQueries({ queryKey: ['audit'] });
      flash.set(t.team.saved);
      goBack();
    } catch (caught) {
      setError(
        errorText(
          caught instanceof ApiError ? (caught.body as { code?: string } | null)?.code : null,
        ),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      noValidate
      onSubmit={(event) => void submit(event)}
      className="flex max-w-4xl flex-col gap-6"
    >
      <ul aria-label={t.team.title} className="flex flex-col gap-4">
        {rows.map((row) => (
          <li
            key={row.userId}
            className="flex flex-col gap-3 rounded-lg bg-card p-4 sm:flex-row sm:items-end"
          >
            <p className="flex-1 font-medium text-base sm:pb-3">{row.name}</p>
            <div className="flex flex-col gap-1 text-muted-foreground text-sm sm:w-44">
              <span aria-hidden>{t.team.role}</span>
              <NativeSelect
                name={`role-${row.userId}`}
                aria-label={`${t.team.role}: ${row.name}`}
                value={row.teamRole}
                onChange={(event) =>
                  update(row.userId, { teamRole: event.target.value as TeamRole })
                }
              >
                {teamRoles.map((role) => (
                  <option key={role} value={role}>
                    {roles[role]}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="flex flex-col gap-1 text-muted-foreground text-sm sm:w-44">
              <span aria-hidden>{t.team.function}</span>
              <NativeSelect
                name={`function-${row.userId}`}
                aria-label={`${t.team.function}: ${row.name}`}
                value={row.function ?? ''}
                onChange={(event) =>
                  update(row.userId, {
                    function: (event.target.value as UserFunction) || null,
                  })
                }
              >
                <option value="">{t.team.noFunction}</option>
                {userFunctions.map((fn) => (
                  <option key={fn} value={fn}>
                    {t.roles.functions[fn]}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="flex flex-col gap-1 text-muted-foreground text-sm sm:w-36">
              <span aria-hidden>{t.team.visibility}</span>
              <NativeSelect
                name={`visibility-${row.userId}`}
                aria-label={`${t.team.visibility}: ${row.name}`}
                value={row.visibility}
                onChange={(event) =>
                  update(row.userId, { visibility: event.target.value as TeamVisibility })
                }
              >
                {teamVisibilities.map((visibility) => (
                  <option key={visibility} value={visibility}>
                    {t.team.visibilities[visibility]}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <Button
              type="button"
              variant="ghost"
              aria-label={t.team.remove(row.name)}
              onClick={() => setRows(rows.filter((other) => other.userId !== row.userId))}
            >
              <Trash2Icon />
              <span className="sm:sr-only">{t.team.removeShort}</span>
            </Button>
          </li>
        ))}
      </ul>
      <div className="-mt-2 flex flex-col gap-1 text-muted-foreground text-sm">
        <p>{side === 'buyer' ? t.team.rolesHint : t.team.supplierRolesHint}</p>
        <p>{t.team.visibilityHint}</p>
      </div>

      {available.length > 0 && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <FormField label={t.team.addPerson} className="flex-1">
            {(field) => (
              <NativeSelect
                {...field}
                value={adding}
                onChange={(event) => setAdding(event.target.value)}
              >
                <option value="">{t.team.choosePerson}</option>
                {available.map((person) => (
                  <option key={person.userId} value={person.userId}>
                    {person.name}
                  </option>
                ))}
              </NativeSelect>
            )}
          </FormField>
          <Button type="button" variant="secondary" disabled={!adding} onClick={add}>
            <PlusIcon />
            {t.team.add}
          </Button>
        </div>
      )}

      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      <FormActions>
        <Button type="button" variant="secondary" onClick={goBack}>
          {t.team.cancel}
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? t.team.saving : t.team.save}
        </Button>
      </FormActions>
    </form>
  );
}
