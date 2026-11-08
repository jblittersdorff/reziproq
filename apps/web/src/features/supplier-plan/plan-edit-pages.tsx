import {
  planObjectiveRequestSchema,
  type PlanObjective,
} from '@reziproq/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { FormActions, FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/ui/loading-state';
import { NativeSelect } from '@/components/ui/native-select';
import { StatusLine } from '@/components/ui/status-line';
import { Textarea } from '@/components/ui/textarea';
import { useSupplier } from '@/features/suppliers/use-supplier';
import { PageHeader } from '@/features/shell/page-header';
import { SupplierFrame } from '@/features/suppliers/supplier-frame';
import { useGoBack } from '@/features/shell/page-path';
import { useToken } from '@/features/ratings/use-rating';
import {
  ApiError,
  assignmentQueryOptions,
  createPlanObjective,
  supplierPlanQueryOptions,
  updatePlanObjective,
  updateSupplierPlanSummary,
} from '@/lib/api';
import { useT } from '@/lib/i18n';
import { flash, useFlash } from '@/lib/flash';

const planPath = (relationshipId: string) =>
  `/lieferanten/${relationshipId}/strategie/lieferantenplan`;

export function PlanSummaryPage({ relationshipId }: { relationshipId: string }) {
  const t = useT();
  const accessToken = useToken();
  const supplier = useSupplier(relationshipId);
  const planQuery = useQuery({
    ...supplierPlanQueryOptions(accessToken, relationshipId),
    enabled: accessToken !== '',
  });

  if (!supplier.data) return null;
  return (
    <SupplierFrame
      relationshipId={relationshipId}
      area="strategy"
      current={t.supplierPlan.summaryPageTitle}
      header={
        <PageHeader
          title={t.supplierPlan.summaryPageTitle}
          purpose={t.supplierPlan.summaryPagePurpose}
        />
      }
      trail={() => [
        {
          label: t.supplierPlan.title,
          href: `${planPath(relationshipId)}`,
        },
      ]}
    >
      {() => {
        if (planQuery.isError) return <ErrorState title={t.supplierPlan.failed} />;
        if (!planQuery.data) return <LoadingState label={t.supplierPlan.loading} />;
        const plan = planQuery.data.plan;
        if (!plan) {
          return (
            <EmptyState
              size="lg"
              title={t.supplierPlan.noPlanTitle}
              description={t.supplierPlan.noPlanHint}
            />
          );
        }
        if (!plan.canManage) {
          return (
            <p role="status" className="rounded-lg bg-muted px-4 py-3 text-muted-foreground">
              {t.supplierPlan.noPermission}
            </p>
          );
        }
        return (
          <SummaryForm
            relationshipId={relationshipId}
            planId={plan.id}
            summary={plan.summary}
          />
        );
      }}
    </SupplierFrame>
  );
}

function SummaryForm({
  relationshipId,
  planId,
  summary,
}: {
  relationshipId: string;
  planId: string;
  summary: string;
}) {
  const t = useT();
  const accessToken = useToken();
  const queryClient = useQueryClient();
  const goBack = useGoBack(planPath(relationshipId));
  const [value, setValue] = useState(summary);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [message, hideMessage] = useFlash();

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setFailed(false);
    try {
      await updateSupplierPlanSummary(accessToken, relationshipId, planId, { summary: value });
      await queryClient.invalidateQueries({
        queryKey: ['suppliers', relationshipId, 'supplier-plan'],
      });
      flash.set(t.supplierPlan.saved);
      goBack();
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {failed && <StatusLine message={t.supplierPlan.saveFailed} tone="warning" />}
      {message && <StatusLine message={message} onHidden={hideMessage} />}
      <form className="flex max-w-3xl flex-col gap-6" onSubmit={(event) => void save(event)}>
        <FormField label={t.supplierPlan.summaryLabel} hint={t.supplierPlan.summaryHint}>
          {(field) => (
            <Textarea
              {...field}
              maxLength={5000}
              rows={6}
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
          )}
        </FormField>
        <FormActions>
          <Button type="button" variant="outline" onClick={goBack}>
            {t.supplierPlan.cancel}
          </Button>
          <Button type="submit" loading={saving}>
            {t.supplierPlan.save}
          </Button>
        </FormActions>
      </form>
    </>
  );
}

export function PlanObjectivePage({
  relationshipId,
  objectiveId,
}: {
  relationshipId: string;
  objectiveId?: string;
}) {
  const t = useT();
  const accessToken = useToken();
  const supplier = useSupplier(relationshipId);
  const planQuery = useQuery({
    ...supplierPlanQueryOptions(accessToken, relationshipId),
    enabled: accessToken !== '',
  });
  const assignmentQuery = useQuery({
    ...assignmentQueryOptions(accessToken, relationshipId),
    enabled: accessToken !== '',
  });

  if (!supplier.data) return null;
  const current = objectiveId ? t.supplierPlan.editGoal : t.supplierPlan.addGoal;
  return (
    <SupplierFrame
      relationshipId={relationshipId}
      area="strategy"
      current={current}
      header={<PageHeader title={current} purpose={t.supplierPlan.objectivePagePurpose} />}
      trail={() => [{ label: t.supplierPlan.title, href: planPath(relationshipId) }]}
    >
      {() => {
        if (planQuery.isError || assignmentQuery.isError) {
          return <ErrorState title={t.supplierPlan.failed} />;
        }
        if (!planQuery.data || !assignmentQuery.data) {
          return <LoadingState label={t.supplierPlan.loading} />;
        }
        const plan = planQuery.data.plan;
        if (!plan) {
          return (
            <EmptyState
              size="lg"
              title={t.supplierPlan.noPlanTitle}
              description={t.supplierPlan.noPlanHint}
            />
          );
        }
        const objective = objectiveId
          ? plan.objectives.find((entry) => entry.id === objectiveId)
          : undefined;
        if (objectiveId && !objective) {
          return (
            <EmptyState
              size="lg"
              title={t.notFound.title}
              description={t.notFound.description}
            />
          );
        }
        const canEdit = objective ? objective.canEdit : plan.canManage;
        if (!canEdit) {
          return (
            <p role="status" className="rounded-lg bg-muted px-4 py-3 text-muted-foreground">
              {t.supplierPlan.noPermission}
            </p>
          );
        }
        return (
          <ObjectiveForm
            relationshipId={relationshipId}
            planId={plan.id}
            objective={objective}
            categories={planQuery.data.categories}
            teamCandidates={planQuery.data.teamCandidates}
            businessUnits={assignmentQuery.data.businessUnits}
            materialGroups={assignmentQuery.data.materialGroups}
          />
        );
      }}
    </SupplierFrame>
  );
}

function ObjectiveForm({
  relationshipId,
  planId,
  objective,
  categories,
  teamCandidates,
  businessUnits,
  materialGroups,
}: {
  relationshipId: string;
  planId: string;
  objective: PlanObjective | undefined;
  categories: { key: string; name: string; active: boolean }[];
  teamCandidates: { userId: string; name: string }[];
  businessUnits: { id: string; name: string; active: boolean }[];
  materialGroups: { id: string; name: string; active: boolean }[];
}) {
  const t = useT();
  const accessToken = useToken();
  const queryClient = useQueryClient();
  const goBack = useGoBack(planPath(relationshipId));
  const [form, setForm] = useState({
    categoryKey: objective?.categoryKey ?? categories.find((category) => category.active)?.key ?? '',
    businessUnitId: objective?.businessUnit?.id ?? '',
    materialGroupId: objective?.materialGroup?.id ?? '',
    text: objective?.text ?? '',
    ownerUserId: objective?.owner.userId ?? teamCandidates[0]?.userId ?? '',
    targetYear: objective?.targetYear ?? new Date().getFullYear(),
  });
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [failure, setFailure] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (objective) {
      setForm({
        categoryKey: objective.categoryKey,
        businessUnitId: objective.businessUnit?.id ?? '',
        materialGroupId: objective.materialGroup?.id ?? '',
        text: objective.text,
        ownerUserId: objective.owner.userId,
        targetYear: objective.targetYear,
      });
    } else {
      setForm((current) => ({
        ...current,
        categoryKey: current.categoryKey || categories.find((category) => category.active)?.key || '',
        ownerUserId: current.ownerUserId || teamCandidates[0]?.userId || '',
      }));
    }
  }, [objective, categories, teamCandidates]);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFailure(false);
    setFieldError(null);
    const request = planObjectiveRequestSchema.safeParse({
      ...form,
      businessUnitId: form.businessUnitId || null,
      materialGroupId: form.materialGroupId || null,
    });
    if (!request.success) {
      setFieldError(
        request.error.issues[0]?.message === 'exactly_one_reference'
          ? t.supplierPlan.referenceRequired
          : t.supplierPlan.errors.invalid_input,
      );
      return;
    }
    setSaving(true);
    try {
      if (objective) {
        await updatePlanObjective(
          accessToken,
          relationshipId,
          planId,
          objective.id,
          request.data,
        );
      } else {
        await createPlanObjective(accessToken, relationshipId, planId, request.data);
      }
      await queryClient.invalidateQueries({
        queryKey: ['suppliers', relationshipId, 'supplier-plan'],
      });
      flash.set(t.supplierPlan.saved);
      goBack();
    } catch (error) {
      const code =
        error instanceof ApiError
          ? (error.body as { code?: string } | null)?.code
          : undefined;
      setFieldError(
        code && code in t.supplierPlan.errors
          ? t.supplierPlan.errors[code as keyof typeof t.supplierPlan.errors]
          : null,
      );
      if (!code || !(code in t.supplierPlan.errors)) setFailure(true);
    } finally {
      setSaving(false);
    }
  };

  const availableUnits = businessUnits.filter(
    (unit) => unit.active || unit.id === form.businessUnitId,
  );
  const availableGroups = materialGroups.filter(
    (group) => group.active || group.id === form.materialGroupId,
  );
  return (
    <>
      {failure && <StatusLine message={t.supplierPlan.saveFailed} tone="warning" />}
      {fieldError && <p role="alert" className="text-destructive">{fieldError}</p>}
      <form className="flex max-w-3xl flex-col gap-6" onSubmit={(event) => void save(event)}>
        <FormField label={t.supplierPlan.category}>
          {(field) => (
            <NativeSelect
              {...field}
              value={form.categoryKey}
              required
              onChange={(event) => setForm({ ...form, categoryKey: event.target.value })}
            >
              <option value="">{t.supplierPlan.choose}</option>
              {categories.map((category) => (
                <option key={category.key} value={category.key} disabled={!category.active}>
                  {category.name}
                </option>
              ))}
            </NativeSelect>
          )}
        </FormField>
        <fieldset className="grid gap-4 sm:grid-cols-2">
          <legend className="mb-2 font-medium text-base">{t.supplierPlan.reference}</legend>
          <FormField label={t.supplierPlan.businessUnit}>
            {(field) => (
              <NativeSelect
                {...field}
                value={form.businessUnitId}
                onChange={(event) =>
                  setForm({
                    ...form,
                    businessUnitId: event.target.value,
                    materialGroupId: '',
                  })
                }
              >
                <option value="">{t.supplierPlan.choose}</option>
                {availableUnits.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name}
                  </option>
                ))}
              </NativeSelect>
            )}
          </FormField>
          <FormField label={t.supplierPlan.materialGroup}>
            {(field) => (
              <NativeSelect
                {...field}
                value={form.materialGroupId}
                onChange={(event) =>
                  setForm({
                    ...form,
                    materialGroupId: event.target.value,
                    businessUnitId: '',
                  })
                }
              >
                <option value="">{t.supplierPlan.choose}</option>
                {availableGroups.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </NativeSelect>
            )}
          </FormField>
        </fieldset>
        <FormField label={t.supplierPlan.goalText}>
          {(field) => (
            <Textarea
              {...field}
              rows={4}
              maxLength={2000}
              value={form.text}
              onChange={(event) => setForm({ ...form, text: event.target.value })}
            />
          )}
        </FormField>
        <FormField label={t.supplierPlan.owner}>
          {(field) => (
            <NativeSelect
              {...field}
              value={form.ownerUserId}
              required
              onChange={(event) => setForm({ ...form, ownerUserId: event.target.value })}
            >
              <option value="">{t.supplierPlan.choose}</option>
              {teamCandidates.map((candidate) => (
                <option key={candidate.userId} value={candidate.userId}>
                  {candidate.name}
                </option>
              ))}
            </NativeSelect>
          )}
        </FormField>
        <FormField label={t.supplierPlan.targetYear}>
          {(field) => (
            <Input
              {...field}
              type="number"
              min={1900}
              max={9999}
              step={1}
              required
              value={form.targetYear}
              onChange={(event) => setForm({ ...form, targetYear: Number(event.target.value) })}
            />
          )}
        </FormField>
        <FormActions>
          <Button type="button" variant="outline" onClick={goBack}>
            {t.supplierPlan.cancel}
          </Button>
          <Button type="submit" loading={saving}>
            {t.supplierPlan.save}
          </Button>
        </FormActions>
      </form>
    </>
  );
}
