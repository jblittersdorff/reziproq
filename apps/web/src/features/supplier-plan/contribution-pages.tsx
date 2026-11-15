import {
  contributionObjectiveRequestSchema,
  requestContributionsSchema,
  type ContributionDetail,
} from '@reziproq/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorState } from '@/components/ui/error-state';
import { FormActions, FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { LoadingState } from '@/components/ui/loading-state';
import { NativeSelect } from '@/components/ui/native-select';
import { StatusLine } from '@/components/ui/status-line';
import { Textarea } from '@/components/ui/textarea';
import { useToken } from '@/features/ratings/use-rating';
import { useGoBack } from '@/features/shell/page-path';
import { formatDate } from '@/features/start/start-page';
import { PageHeader } from '@/features/shell/page-header';
import { SupplierFrame } from '@/features/suppliers/supplier-frame';
import { useSupplier } from '@/features/suppliers/use-supplier';
import {
  ApiError,
  completeContribution,
  contributionQueryOptions,
  contributionSuggestionsQueryOptions,
  createContributionObjective,
  requestContributions,
  supplierPlanQueryOptions,
} from '@/lib/api';
import { flash, useFlash } from '@/lib/flash';
import { useLocale, useT } from '@/lib/i18n';

const planPath = (relationshipId: string) =>
  `/lieferanten/${relationshipId}/strategie/lieferantenplan`;

const planQueryKey = (relationshipId: string) => ['suppliers', relationshipId, 'supplier-plan'];

function errorCode(error: unknown): string | undefined {
  return error instanceof ApiError ? (error.body as { code?: string } | null)?.code : undefined;
}

const today = () => new Date().toISOString().slice(0, 10);

/** Beiträge anfordern (SPL-03): eine Zeile je Business Unit und Warengruppe, ein Klick. */
export function ContributionRequestPage({ relationshipId }: { relationshipId: string }) {
  const t = useT();
  const supplier = useSupplier(relationshipId);
  if (!supplier.data) return null;
  return (
    <SupplierFrame
      relationshipId={relationshipId}
      area="strategy"
      current={t.supplierPlan.requestTitle}
      header={
        <PageHeader title={t.supplierPlan.requestTitle} purpose={t.supplierPlan.requestPurpose} />
      }
      trail={() => [{ label: t.supplierPlan.title, href: planPath(relationshipId) }]}
    >
      {() => <RequestContent relationshipId={relationshipId} />}
    </SupplierFrame>
  );
}

function RequestContent({ relationshipId }: { relationshipId: string }) {
  const t = useT();
  const accessToken = useToken();
  const planQuery = useQuery({
    ...supplierPlanQueryOptions(accessToken, relationshipId),
    enabled: accessToken !== '',
  });
  const plan = planQuery.data?.plan;
  const suggestions = useQuery({
    ...contributionSuggestionsQueryOptions(accessToken, relationshipId, plan?.id ?? ''),
    enabled: accessToken !== '' && Boolean(plan?.canManage),
  });

  if (planQuery.isError || suggestions.isError) {
    return <ErrorState title={t.supplierPlan.failed} />;
  }
  if (!planQuery.data) return <LoadingState label={t.supplierPlan.loading} />;
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
      <p role="status" className="rounded-lg bg-card px-4 py-3 text-muted-foreground">
        {t.supplierPlan.noPermission}
      </p>
    );
  }
  if (!suggestions.data) return <LoadingState label={t.supplierPlan.loading} />;
  return (
    <RequestForm
      relationshipId={relationshipId}
      planId={plan.id}
      rows={suggestions.data.rows}
      team={suggestions.data.teamCandidates}
    />
  );
}

function RequestForm({
  relationshipId,
  planId,
  rows,
  team,
}: {
  relationshipId: string;
  planId: string;
  rows: {
    businessUnit: { id: string; name: string } | null;
    materialGroup: { id: string; name: string } | null;
    suggestedUserId: string | null;
  }[];
  team: { userId: string; name: string }[];
}) {
  const t = useT();
  const accessToken = useToken();
  const queryClient = useQueryClient();
  const goBack = useGoBack(planPath(relationshipId));
  const [entries, setEntries] = useState(() =>
    rows.map((row) => ({ assigneeUserId: row.suggestedUserId ?? '', dueDate: '' })),
  );
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);

  if (rows.length === 0) {
    return (
      <EmptyState
        size="lg"
        title={t.supplierPlan.requestTitle}
        description={t.supplierPlan.requestEmpty}
      />
    );
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setMessage(null);
    setFailed(false);
    const request = requestContributionsSchema.safeParse({
      contributions: rows.map((row, index) => ({
        businessUnitId: row.businessUnit?.id ?? null,
        materialGroupId: row.materialGroup?.id ?? null,
        assigneeUserId: entries[index]?.assigneeUserId ?? '',
        dueDate: entries[index]?.dueDate ?? '',
      })),
    });
    if (!request.success) {
      setMessage(t.supplierPlan.dueRequired);
      return;
    }
    setSaving(true);
    try {
      await requestContributions(accessToken, relationshipId, planId, request.data);
      await queryClient.invalidateQueries({ queryKey: planQueryKey(relationshipId) });
      flash.set(t.supplierPlan.requested);
      goBack();
    } catch (error) {
      const code = errorCode(error);
      if (code && code in t.supplierPlan.errors) {
        setMessage(t.supplierPlan.errors[code as keyof typeof t.supplierPlan.errors]);
      } else {
        setFailed(true);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {failed && <StatusLine message={t.supplierPlan.requestFailed} tone="warning" />}
      {message && (
        <p role="alert" className="mb-4 text-destructive">
          {message}
        </p>
      )}
      <form className="flex max-w-3xl flex-col gap-6" onSubmit={(event) => void submit(event)}>
        <ul className="divide-y divide-line-soft">
          {rows.map((row, index) => {
            const name = (row.businessUnit ?? row.materialGroup)?.name ?? '';
            const entry = entries[index];
            return (
              <li key={row.businessUnit?.id ?? row.materialGroup?.id} className="space-y-3 py-4">
                <h2 className="font-medium">
                  <span className="text-muted-foreground text-sm">
                    {row.businessUnit ? t.supplierPlan.businessUnit : t.supplierPlan.materialGroup}
                  </span>
                  <br />
                  {name}
                </h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField label={`${t.supplierPlan.assignee} · ${name}`}>
                    {(field) => (
                      <NativeSelect
                        {...field}
                        required
                        value={entry?.assigneeUserId ?? ''}
                        onChange={(event) =>
                          setEntries(
                            entries.map((item, at) =>
                              at === index ? { ...item, assigneeUserId: event.target.value } : item,
                            ),
                          )
                        }
                      >
                        <option value="">{t.supplierPlan.choose}</option>
                        {team.map((person) => (
                          <option key={person.userId} value={person.userId}>
                            {person.name}
                          </option>
                        ))}
                      </NativeSelect>
                    )}
                  </FormField>
                  <FormField label={`${t.supplierPlan.dueDate} · ${name}`}>
                    {(field) => (
                      <Input
                        {...field}
                        type="date"
                        required
                        min={today()}
                        value={entry?.dueDate ?? ''}
                        onChange={(event) =>
                          setEntries(
                            entries.map((item, at) =>
                              at === index ? { ...item, dueDate: event.target.value } : item,
                            ),
                          )
                        }
                      />
                    )}
                  </FormField>
                </div>
              </li>
            );
          })}
        </ul>
        <FormActions>
          <Button type="button" variant="outline" onClick={goBack}>
            {t.supplierPlan.cancel}
          </Button>
          <Button type="submit" loading={saving}>
            {t.supplierPlan.requestSubmit}
          </Button>
        </FormActions>
      </form>
    </>
  );
}

/** Beitrag der Person (SPL-03): Rahmen lesen, Ziele je Kategorie erfassen, Beitrag abschließen. */
export function ContributionPage({
  relationshipId,
  contributionId,
}: {
  relationshipId: string;
  contributionId: string;
}) {
  const t = useT();
  const supplier = useSupplier(relationshipId);
  if (!supplier.data) return null;
  return (
    <SupplierFrame
      relationshipId={relationshipId}
      area="strategy"
      current={t.supplierPlan.contributionTitle}
      trail={() => [{ label: t.supplierPlan.title, href: planPath(relationshipId) }]}
    >
      {() => <ContributionContent relationshipId={relationshipId} contributionId={contributionId} />}
    </SupplierFrame>
  );
}

function ContributionContent({
  relationshipId,
  contributionId,
}: {
  relationshipId: string;
  contributionId: string;
}) {
  const t = useT();
  const accessToken = useToken();
  const query = useQuery({
    ...contributionQueryOptions(accessToken, relationshipId, contributionId),
    enabled: accessToken !== '',
  });
  if (query.error instanceof ApiError && query.error.status === 403) {
    return (
      <>
        <PageHeader title={t.supplierPlan.contributionTitle} />
        <p role="status" className="rounded-lg bg-card px-4 py-3 text-muted-foreground">
          {t.supplierPlan.contributionNoPermission}
        </p>
      </>
    );
  }
  if (query.isError) {
    return (
      <>
        <PageHeader title={t.supplierPlan.contributionTitle} />
        <ErrorState title={t.supplierPlan.contributionFailed} />
      </>
    );
  }
  if (!query.data) {
    return (
      <>
        <PageHeader title={t.supplierPlan.contributionTitle} />
        <LoadingState label={t.supplierPlan.contributionLoading} />
      </>
    );
  }
  return <ContributionView relationshipId={relationshipId} detail={query.data} />;
}

function ContributionView({
  relationshipId,
  detail,
}: {
  relationshipId: string;
  detail: ContributionDetail;
}) {
  const t = useT();
  const { locale } = useLocale();
  const accessToken = useToken();
  const queryClient = useQueryClient();
  const goBack = useGoBack(planPath(relationshipId));
  const [message, hideMessage] = useFlash();
  const [form, setForm] = useState({
    categoryKey: detail.categories[0]?.key ?? '',
    text: '',
    targetYear: new Date().getFullYear() + 1,
  });
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);

  const reference = (detail.businessUnit ?? detail.materialGroup)?.name ?? '';
  const refresh = () => queryClient.invalidateQueries({ queryKey: planQueryKey(relationshipId) });

  const addGoal = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFieldError(null);
    setFailed(false);
    const request = contributionObjectiveRequestSchema.safeParse(form);
    if (!request.success) {
      setFieldError(t.supplierPlan.errors.invalid_input);
      return;
    }
    setSaving(true);
    try {
      await createContributionObjective(accessToken, relationshipId, detail.id, request.data);
      await refresh();
      setForm({ ...form, text: '' });
      flash.set(t.supplierPlan.contributionGoalSaved);
    } catch (error) {
      const code = errorCode(error);
      if (code && code in t.supplierPlan.errors) {
        setFieldError(t.supplierPlan.errors[code as keyof typeof t.supplierPlan.errors]);
      } else {
        setFailed(true);
      }
    } finally {
      setSaving(false);
    }
  };

  const complete = async () => {
    setCompleting(true);
    setFailed(false);
    try {
      await completeContribution(accessToken, relationshipId, detail.id);
      await refresh();
      flash.set(t.supplierPlan.contributionCompleted);
      goBack();
    } catch {
      setFailed(true);
    } finally {
      setCompleting(false);
    }
  };

  const byCategory = new Map<string, typeof detail.objectives>();
  for (const objective of detail.objectives) {
    byCategory.set(objective.categoryName, [
      ...(byCategory.get(objective.categoryName) ?? []),
      objective,
    ]);
  }

  return (
    <>
      <PageHeader
        title={t.supplierPlan.contributionTitle}
        purpose={t.supplierPlan.contributionPurpose(reference)}
      />
      {message && <StatusLine message={message} onHidden={hideMessage} />}
      {failed && <StatusLine message={t.supplierPlan.saveFailed} tone="warning" />}
      <section aria-labelledby="contribution-context" className="mb-8 space-y-2">
        <h2 id="contribution-context" className="font-semibold text-lg">
          {t.supplierPlan.contributionContext}
        </h2>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-muted-foreground text-sm">
          <span>
            {t.supplierPlan.targetType}: {detail.targetType ?? '–'}
          </span>
          <span>{t.supplierPlan.contributionDue(formatDate(locale, detail.dueDate))}</span>
        </div>
        <p className="max-w-3xl whitespace-pre-wrap text-muted-foreground">
          {detail.summary || t.supplierPlan.summaryEmpty}
        </p>
      </section>

      <section aria-labelledby="contribution-goals" className="mb-8 space-y-4">
        <h2 id="contribution-goals" className="font-semibold text-lg">
          {t.supplierPlan.contributionGoals}
        </h2>
        {detail.objectives.length === 0 ? (
          <p className="text-muted-foreground">{t.supplierPlan.contributionNoGoals}</p>
        ) : (
          [...byCategory].map(([category, objectives]) => (
            <div key={category} className="space-y-2">
              <h3 className="font-medium">{category}</h3>
              <ul className="divide-y divide-line-soft">
                {objectives.map((objective) => (
                  <li key={objective.id} className="py-3">
                    <p className="font-medium">{objective.text}</p>
                    <p className="text-muted-foreground text-sm">
                      {objective.owner.name} · {t.supplierPlan.target(objective.targetYear)}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </section>

      {detail.canEdit ? (
        <>
          <form
            className="mb-8 flex max-w-3xl flex-col gap-6"
            onSubmit={(event) => void addGoal(event)}
          >
            {fieldError && (
              <p role="alert" className="text-destructive">
                {fieldError}
              </p>
            )}
            <FormField label={t.supplierPlan.category}>
              {(field) => (
                <NativeSelect
                  {...field}
                  required
                  value={form.categoryKey}
                  onChange={(event) => setForm({ ...form, categoryKey: event.target.value })}
                >
                  {detail.categories.map((category) => (
                    <option key={category.key} value={category.key}>
                      {category.name}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </FormField>
            <FormField label={t.supplierPlan.goalText}>
              {(field) => (
                <Textarea
                  {...field}
                  rows={3}
                  maxLength={2000}
                  value={form.text}
                  onChange={(event) => setForm({ ...form, text: event.target.value })}
                />
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
                  onChange={(event) =>
                    setForm({ ...form, targetYear: Number(event.target.value) })
                  }
                />
              )}
            </FormField>
            <FormActions>
              <Button type="submit" variant="outline" loading={saving}>
                {t.supplierPlan.contributionSaveGoal}
              </Button>
            </FormActions>
          </form>
          <div className="flex">
            <Button loading={completing} onClick={() => void complete()}>
              {t.supplierPlan.contributionComplete}
            </Button>
          </div>
        </>
      ) : (
        <p role="status" className="rounded-lg bg-card px-4 py-3 text-muted-foreground">
          {detail.status === 'done'
            ? t.supplierPlan.contributionDoneHint
            : t.supplierPlan.contributionNoPermission}
        </p>
      )}
    </>
  );
}
