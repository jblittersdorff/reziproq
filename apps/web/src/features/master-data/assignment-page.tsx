import { type AssignmentResponse, assignmentRequestSchema } from '@reziproq/shared';
import { useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/error-state';
import { CheckboxGroup, FormActions, FormField } from '@/components/ui/form-field';
import { LoadingState } from '@/components/ui/loading-state';
import { NativeSelect } from '@/components/ui/native-select';
import { PageHeader } from '@/features/shell/page-header';
import { useGoBack } from '@/features/shell/page-path';
import { SupplierFrame } from '@/features/suppliers/supplier-frame';
import { InternalBadge } from '@/features/workspace/internal-badge';
import { ApiError, saveAssignment } from '@/lib/api';
import { flash } from '@/lib/flash';
import { useT } from '@/lib/i18n';
import { useAssignment } from './assignment';
import type { Entry } from './kinds';
import { useEntries } from './use-entries';

/** Profil › Zuordnung bearbeiten (PLT-06) als Formularseite; Speichern führt zum Profil zurück. */
export function AssignmentPage({ relationshipId }: { relationshipId: string }) {
  const t = useT();
  const profile = `/lieferanten/${relationshipId}/strategie/profil`;
  const assignment = useAssignment(relationshipId);
  const units = useEntries('business-units');
  const groups = useEntries('material-groups');
  return (
    <SupplierFrame
      relationshipId={relationshipId}
      area="strategy"
      trail={() => [{ label: t.workspace.pages.profile.title, href: profile }]}
      current={t.masterData.assignment.edit}
    >
      {() => (
        <>
          <PageHeader
            title={t.masterData.assignment.edit}
            purpose={t.masterData.assignment.editPurpose}
            badge={<InternalBadge />}
          />
          {assignment.isError || units.isError || groups.isError ? (
            <ErrorState title={t.masterData.assignment.failed} />
          ) : !assignment.data || !units.entries || !groups.entries ? (
            <LoadingState label={t.masterData.assignment.loading} />
          ) : (
            <AssignmentForm
              relationshipId={relationshipId}
              accessToken={assignment.accessToken}
              assignment={assignment.data}
              units={units.entries}
              groups={groups.entries}
              profile={profile}
            />
          )}
        </>
      )}
    </SupplierFrame>
  );
}

/**
 * Wählbar sind aktive Einträge; deaktivierte nur, wenn sie schon zugeordnet sind. Sie bleiben
 * sichtbar und markiert, damit nichts stillschweigend verschwindet.
 */
function choices(entries: Entry[], assigned: string[], inactiveMark: string) {
  const names = new Map(entries.map((entry) => [entry.id, entry.name]));
  return entries
    .filter((entry) => entry.active || assigned.includes(entry.id))
    .map((entry) => {
      const parent = entry.parentId ? names.get(entry.parentId) : undefined;
      const name = parent ? `${parent} › ${entry.name}` : entry.name;
      return { value: entry.id, label: entry.active ? name : `${name} · ${inactiveMark}` };
    });
}

function AssignmentForm({
  relationshipId,
  accessToken,
  assignment,
  units,
  groups,
  profile,
}: {
  relationshipId: string;
  accessToken: string;
  assignment: AssignmentResponse;
  units: Entry[];
  groups: Entry[];
  profile: string;
}) {
  const t = useT();
  const texts = t.masterData.assignment;
  const queryClient = useQueryClient();
  const goBack = useGoBack(profile);
  const [unitIds, setUnitIds] = useState(assignment.businessUnits.map((unit) => unit.id));
  const [groupIds, setGroupIds] = useState(assignment.materialGroups.map((group) => group.id));
  const [primary, setPrimary] = useState(
    assignment.materialGroups.find((group) => group.isPrimary)?.id ?? '',
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const unitOptions = choices(
    units,
    assignment.businessUnits.map((unit) => unit.id),
    texts.inactiveMark,
  );
  const groupOptions = choices(
    groups,
    assignment.materialGroups.map((group) => group.id),
    texts.inactiveMark,
  );
  // Ist nur eine Warengruppe gewählt, ist sie die Haupt-Warengruppe.
  const effectivePrimary = groupIds.includes(primary)
    ? primary
    : groupIds.length === 1
      ? (groupIds[0] ?? '')
      : '';

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const parsed = assignmentRequestSchema.safeParse({
      businessUnitIds: unitIds,
      materialGroupIds: groupIds,
      primaryMaterialGroupId: effectivePrimary || null,
    });
    if (!parsed.success) {
      setError(t.masterData.errors.primary_required);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await saveAssignment(accessToken, relationshipId, parsed.data);
      void queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      void queryClient.invalidateQueries({ queryKey: ['audit'] });
      flash.set(t.masterData.saved);
      goBack();
    } catch (caught) {
      const code =
        caught instanceof ApiError ? (caught.body as { code?: string } | null)?.code : null;
      const known = code && code in t.masterData.errors;
      setError(
        known
          ? t.masterData.errors[code as keyof typeof t.masterData.errors]
          : t.masterData.errors.saveFailed,
      );
    } finally {
      setSaving(false);
    }
  };

  if (unitOptions.length === 0 && groupOptions.length === 0) {
    return <p className="text-muted-foreground">{texts.noEntries}</p>;
  }

  return (
    <form
      noValidate
      onSubmit={(event) => void submit(event)}
      className="flex max-w-xl flex-col gap-8"
    >
      <CheckboxGroup
        legend={t.masterData.businessUnits}
        options={unitOptions}
        value={unitIds}
        onChange={setUnitIds}
      />
      <CheckboxGroup
        legend={t.masterData.materialGroups}
        options={groupOptions}
        value={groupIds}
        onChange={setGroupIds}
      />
      {groupIds.length > 1 && (
        <FormField label={texts.primary}>
          {(field) => (
            <NativeSelect
              {...field}
              name="primary"
              value={effectivePrimary}
              onChange={(event) => setPrimary(event.target.value)}
            >
              <option value="">–</option>
              {groupOptions
                .filter((option) => groupIds.includes(option.value))
                .map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
            </NativeSelect>
          )}
        </FormField>
      )}
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
      <FormActions>
        <Button type="button" variant="secondary" onClick={goBack}>
          {t.masterData.cancel}
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? t.masterData.saving : t.masterData.save}
        </Button>
      </FormActions>
    </form>
  );
}
